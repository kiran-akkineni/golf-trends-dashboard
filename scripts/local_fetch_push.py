#!/usr/bin/env python3
"""
local_fetch_push.py — Run from your Mac to fetch Google Trends data
and push it directly to Upstash Redis.

Usage:
  pip install pytrends requests
  python3 local_fetch_push.py
"""

import json
import time
import random
import sys
import os
import urllib.request

# ── Config ────────────────────────────────────────────────────────────────────
UPSTASH_URL   = os.environ.get("UPSTASH_REDIS_REST_URL", "").rstrip("/")
UPSTASH_TOKEN = os.environ.get("UPSTASH_REDIS_REST_TOKEN", "")
TTL_SECONDS   = 86400  # 24 hours

TERMS = [
    "golf clubs",
    "golf balls",
    "golf bags",
    "golf",
    "golf equipment",
    "golf simulator",
]

# ── Validate env ──────────────────────────────────────────────────────────────
if not UPSTASH_URL or not UPSTASH_TOKEN:
    print("ERROR: Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars.")
    print("  export UPSTASH_REDIS_REST_URL=https://your-url.upstash.io")
    print("  export UPSTASH_REDIS_REST_TOKEN=your-token")
    sys.exit(1)

# ── pytrends fetch ────────────────────────────────────────────────────────────
try:
    from pytrends.request import TrendReq
except ImportError:
    print("ERROR: pytrends not installed. Run: pip install pytrends")
    sys.exit(1)


def fetch_term(pytrends, term, timeframe="today 5-y", geo="US"):
    pytrends.build_payload([term], cat=0, timeframe=timeframe, geo=geo)
    df = pytrends.interest_over_time()
    if df.empty:
        print(f"  ⚠  Empty response for: {term}")
        return {}
    df = df.drop(columns=["isPartial"], errors="ignore")
    return {str(k): int(v) for k, v in df[term].items()}


def monthly_bucket(weekly):
    """Average weekly data points into monthly buckets (null if < 2 points)."""
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


# ── Fetch all terms ───────────────────────────────────────────────────────────
print("Initializing pytrends...")
pytrends = TrendReq(hl="en-US", tz=360, timeout=(10, 25), retries=3, backoff_factor=0.5)

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

# ── Transform ─────────────────────────────────────────────────────────────────
print("\nTransforming data...")

term_map = {
    "golf clubs":     "golfClubs",
    "golf balls":     "golfBalls",
    "golf bags":      "golfBags",
    "golf":           "golf",
    "golf equipment": "golfEquipment",
    "golf simulator": "golfSimulator",
}

monthly = {}
for term, key in term_map.items():
    weekly = raw.get(term, {})
    monthly[key] = monthly_bucket(weekly)

clubs_monthly = monthly["golfClubs"]

payload = {
    "source": "live",
    "stale": False,
    "lastUpdated": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
    "data": {
        "monthly": monthly,
        "quarterly": {
            "golfClubs":     to_quarterly(monthly["golfClubs"]),
            "golf":          to_quarterly(monthly["golf"]),
            "golfEquipment": to_quarterly(monthly["golfEquipment"]),
            "golfSimulator": to_quarterly(monthly["golfSimulator"]),
        },
        "annual": {
            "golfClubs":  to_annual(clubs_monthly),
            "summerPeak": to_summer_peak(clubs_monthly),
        },
    },
}

fetched = sum(1 for v in monthly.values() if v)
print(f"Terms with data: {fetched}/6")

if fetched == 0:
    print("\nERROR: No terms returned data. Google may be rate-limiting even on residential IP.")
    print("Try again in a few minutes.")
    sys.exit(1)

# ── Push to Upstash ───────────────────────────────────────────────────────────
print("\nPushing to Upstash Redis...")

json_str = json.dumps(payload)

def upstash_set(key, value, ttl):
    url = f"{UPSTASH_URL}/set/{key}"
    body = json.dumps([value, "EX", ttl]).encode()
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Bearer {UPSTASH_TOKEN}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

try:
    r1 = upstash_set("golf_trends_data", json_str, TTL_SECONDS)
    r2 = upstash_set("golf_trends_last_updated", payload["lastUpdated"], TTL_SECONDS + 3600)
    print(f"✓ golf_trends_data saved: {r1}")
    print(f"✓ golf_trends_last_updated saved: {r2}")
    print(f"\nDone! Dashboard will now serve live data.")
    print(f"Visit: https://golf-trends-dashboard.vercel.app")
except Exception as e:
    print(f"✗ Redis push failed: {e}")
    sys.exit(1)
