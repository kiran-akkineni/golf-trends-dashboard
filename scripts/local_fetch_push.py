#!/usr/bin/env python3
"""
local_fetch_push.py — Fetch Google Trends data and push to Upstash Redis.
Patches urllib3.util.retry.Retry for compatibility with pytrends on urllib3 v2.
"""

import json
import time
import random
import sys
import os
import urllib.request

# ── Patch urllib3 Retry for pytrends compatibility ────────────────────────────
try:
    from urllib3.util.retry import Retry
    _orig_init = Retry.__init__
    def _patched_init(self, *args, **kwargs):
        if 'method_whitelist' in kwargs:
            kwargs['allowed_methods'] = kwargs.pop('method_whitelist')
        _orig_init(self, *args, **kwargs)
    Retry.__init__ = _patched_init
except Exception as e:
    print(f"[warn] Could not patch Retry: {e}", file=sys.stderr)

# ── Config ────────────────────────────────────────────────────────────────────
UPSTASH_URL   = os.environ.get("UPSTASH_REDIS_REST_URL", "").rstrip("/")
UPSTASH_TOKEN = os.environ.get("UPSTASH_REDIS_REST_TOKEN", "")
TTL_SECONDS   = 86400 * 8  # 8 days

TERMS = [
    "golf clubs", "golf balls", "golf bags",
    "golf", "golf equipment", "golf simulator",
]

if not UPSTASH_URL or not UPSTASH_TOKEN:
    print("ERROR: Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars.")
    sys.exit(1)

try:
    from pytrends.request import TrendReq
except ImportError:
    print("ERROR: pytrends not installed. Run: pip install pytrends")
    sys.exit(1)


def fetch_term(pytrends, term, timeframe="today 5-y", geo="US"):
    pytrends.build_payload([term], cat=0, timeframe=timeframe, geo=geo)
    df = pytrends.interest_over_time()
    if df.empty:
        print(f"  ⚠  Empty response for: {term}", file=sys.stderr)
        return {}
    df = df.drop(columns=["isPartial"], errors="ignore")
    return {str(k): int(v) for k, v in df[term].items()}


def monthly_bucket(weekly):
    from collections import defaultdict
    buckets = defaultdict(list)
    for iso_date, val in weekly.items():
        try:
            parts = iso_date.split(" ")[0].split("-")
            key = f"{parts[0]}-{parts[1].zfill(2)}"
            buckets[key].append(val)
        except Exception:
            continue
    result = {}
    for key, vals in buckets.items():
        result[key] = round(sum(vals) / len(vals)) if len(vals) >= 2 else None
    return result


def to_quarterly(monthly):
    from collections import defaultdict
    import math
    buckets = defaultdict(list)
    for key, val in monthly.items():
        if val is None:
            continue
        year, month = key.split("-")
        q = math.ceil(int(month) / 3)
        buckets[f"{year}-Q{q}"].append(val)
    return {k: round(sum(v) / len(v)) for k, v in buckets.items() if len(v) == 3}


def to_annual(monthly):
    from collections import defaultdict
    buckets = defaultdict(list)
    for key, val in monthly.items():
        if val is None:
            continue
        buckets[key.split("-")[0]].append(val)
    return {k: round(sum(v) / len(v)) for k, v in buckets.items() if len(v) >= 6}


def to_summer_peak(monthly):
    from collections import defaultdict
    buckets = defaultdict(list)
    for key, val in monthly.items():
        if val is None:
            continue
        year, month = key.split("-")
        if int(month) in (6, 7, 8):
            buckets[year].append(val)
    return {k: max(v) for k, v in buckets.items() if len(v) == 3}


def upstash_set(key, value, ttl):
    url = f"{UPSTASH_URL}/set/{urllib.parse.quote(key, safe='')}"
    body = json.dumps([value, "EX", ttl]).encode()
    req = urllib.request.Request(
        url, data=body,
        headers={"Authorization": f"Bearer {UPSTASH_TOKEN}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


import urllib.parse

print("Initializing pytrends...")
pytrends = TrendReq(hl="en-US", tz=360, timeout=(10, 25), retries=2, backoff_factor=0.3)

raw = {}
for i, term in enumerate(TERMS):
    print(f"Fetching ({i+1}/{len(TERMS)}): {term} ...", end=" ", flush=True)
    try:
        data = fetch_term(pytrends, term)
        raw[term] = data
        print(f"✓ {len(data)} points")
    except Exception as e:
        print(f"✗ {e}")
        raw[term] = {}
    if i < len(TERMS) - 1:
        delay = random.uniform(2.5, 4.5)
        print(f"  Sleeping {delay:.1f}s...")
        time.sleep(delay)

print("\nTransforming data...")
term_map = {
    "golf clubs": "golfClubs", "golf balls": "golfBalls", "golf bags": "golfBags",
    "golf": "golf", "golf equipment": "golfEquipment", "golf simulator": "golfSimulator",
}

monthly = {}
for term, key in term_map.items():
    monthly[key] = monthly_bucket(raw.get(term, {}))

clubs_monthly = monthly["golfClubs"]
payload = {
    "source": "live", "stale": False,
    "lastUpdated": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
    "data": {
        "monthly": monthly,
        "quarterly": {
            "golfClubs": to_quarterly(monthly["golfClubs"]),
            "golf": to_quarterly(monthly["golf"]),
            "golfEquipment": to_quarterly(monthly["golfEquipment"]),
            "golfSimulator": to_quarterly(monthly["golfSimulator"]),
        },
        "annual": {
            "golfClubs": to_annual(clubs_monthly),
            "summerPeak": to_summer_peak(clubs_monthly),
        },
    },
}

fetched = sum(1 for v in monthly.values() if v)
print(f"Terms with data: {fetched}/6")

if fetched == 0:
    print("\nERROR: No terms returned data.")
    sys.exit(1)

print("\nPushing to Upstash Redis...")
json_str = json.dumps(payload)
try:
    r1 = upstash_set("golf_trends_data", json_str, TTL_SECONDS)
    r2 = upstash_set("golf_trends_last_updated", payload["lastUpdated"], TTL_SECONDS + 3600)
    print(f"✓ golf_trends_data saved: {r1}")
    print(f"✓ golf_trends_last_updated saved: {r2}")
    print(f"\nDone! Dashboard will now serve live data.")
except Exception as e:
    print(f"✗ Redis push failed: {e}")
    sys.exit(1)
