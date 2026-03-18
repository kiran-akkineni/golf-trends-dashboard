#!/usr/bin/env python3
"""
Fetches Google Trends data directly (no pytrends) and pushes to Upstash Redis.
"""

import json, time, random, sys, os, urllib.request, urllib.parse
import requests

UPSTASH_URL   = os.environ.get("UPSTASH_REDIS_REST_URL", "").rstrip("/")
UPSTASH_TOKEN = os.environ.get("UPSTASH_REDIS_REST_TOKEN", "")
TTL_SECONDS   = 86400 * 8

TERMS = ["golf clubs","golf balls","golf bags","golf","golf equipment","golf simulator"]

if not UPSTASH_URL or not UPSTASH_TOKEN:
    print("ERROR: Missing Upstash env vars.")
    sys.exit(1)

BASE = "https://trends.google.com"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://trends.google.com/trends/explore",
}

session = requests.Session()
session.headers.update(HEADERS)

def strip_xssi(text):
    return text.lstrip(")]}',\n").strip()

def get_token(term, timeframe="today 5-y", geo="US"):
    req_body = json.dumps({"comparisonItem": [{"keyword": term, "geo": geo, "time": timeframe}], "category": 0, "property": ""})
    params = {"hl": "en-US", "tz": "360", "req": req_body}
    r = session.get(f"{BASE}/trends/api/explore", params=params, timeout=30)
    r.raise_for_status()
    data = json.loads(strip_xssi(r.text))
    widgets = data.get("widgets", [])
    w = next((w for w in widgets if w["id"] == "TIMESERIES"), None)
    if not w:
        raise ValueError(f"No TIMESERIES widget for '{term}'")
    return w["token"], w["request"]

def get_series(token, request):
    params = {"hl": "en-US", "tz": "360", "req": json.dumps(request), "token": token}
    r = session.get(f"{BASE}/trends/api/widgetdata/multiline", params=params, timeout=30)
    r.raise_for_status()
    data = json.loads(strip_xssi(r.text))
    result = {}
    for pt in data.get("default", {}).get("timelineData", []):
        date = time.strftime("%Y-%m-%d", time.gmtime(int(pt["time"])))
        result[date] = pt["value"][0]["extractedValue"]
    return result

def monthly_bucket(weekly):
    from collections import defaultdict
    b = defaultdict(list)
    for d, v in weekly.items():
        key = d[:7]
        b[key].append(v)
    return {k: round(sum(v)/len(v)) if len(v)>=2 else None for k,v in b.items()}

def to_quarterly(m):
    from collections import defaultdict
    import math
    b = defaultdict(list)
    for k,v in m.items():
        if v is None: continue
        yr,mo = k.split("-")
        b[f"{yr}-Q{math.ceil(int(mo)/3)}"].append(v)
    return {k: round(sum(v)/len(v)) for k,v in b.items() if len(v)==3}

def to_annual(m):
    from collections import defaultdict
    b = defaultdict(list)
    for k,v in m.items():
        if v is None: continue
        b[k[:4]].append(v)
    return {k: round(sum(v)/len(v)) for k,v in b.items() if len(v)>=6}

def to_summer_peak(m):
    from collections import defaultdict
    b = defaultdict(list)
    for k,v in m.items():
        if v is None: continue
        yr,mo = k.split("-")
        if int(mo) in (6,7,8): b[yr].append(v)
    return {k: max(v) for k,v in b.items() if len(v)==3}

def upstash_set(key, value, ttl):
    url = f"{UPSTASH_URL}/set/{urllib.parse.quote(key, safe='')}"
    body = json.dumps([value, "EX", ttl]).encode()
    req = urllib.request.Request(url, data=body,
        headers={"Authorization": f"Bearer {UPSTASH_TOKEN}", "Content-Type": "application/json"},
        method="POST")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

# ── Fetch ─────────────────────────────────────────────────────────────────────
print("Fetching Google Trends data...")
raw = {}
for i, term in enumerate(TERMS):
    print(f"({i+1}/{len(TERMS)}) {term}...", end=" ", flush=True)
    try:
        token, request = get_token(term)
        time.sleep(0.5 + random.random() * 0.5)
        series = get_series(token, request)
        raw[term] = series
        print(f"✓ {len(series)} points")
    except Exception as e:
        print(f"✗ {e}")
        raw[term] = {}
    if i < len(TERMS)-1:
        delay = random.uniform(3.0, 5.0)
        print(f"  sleeping {delay:.1f}s...")
        time.sleep(delay)

term_map = {"golf clubs":"golfClubs","golf balls":"golfBalls","golf bags":"golfBags",
            "golf":"golf","golf equipment":"golfEquipment","golf simulator":"golfSimulator"}

monthly = {v: monthly_bucket(raw.get(k,{})) for k,v in term_map.items()}
fetched = sum(1 for v in monthly.values() if v)
print(f"\nTerms with data: {fetched}/6")
if fetched == 0:
    print("ERROR: No data fetched.")
    sys.exit(1)

clubs = monthly["golfClubs"]
payload = {
    "source": "live", "stale": False,
    "lastUpdated": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
    "data": {
        "monthly": monthly,
        "quarterly": {k: to_quarterly(monthly[k]) for k in ["golfClubs","golf","golfEquipment","golfSimulator"]},
        "annual": {"golfClubs": to_annual(clubs), "summerPeak": to_summer_peak(clubs)},
    },
}

print("Pushing to Redis...")
upstash_set("golf_trends_data", json.dumps(payload), TTL_SECONDS)
upstash_set("golf_trends_last_updated", payload["lastUpdated"], TTL_SECONDS+3600)
print("✓ Done!")
