#!/usr/bin/env python3
"""
Fetches Google Trends data directly (no pytrends) and pushes to Upstash Redis.

Terms are fetched in COMPARISON GROUPS so they're normalized relative to each other:
- Chart 2 group: golf, golf clubs, golf equipment, golf simulator
- Chart 3 group: golf clubs, golf balls, golf bags
- Chart 7 group: Callaway, TaylorMade, Titleist, Ping, Mizuno (Golf category=261)
"""

import json, time, random, sys, os, urllib.request, urllib.parse
import requests

UPSTASH_URL   = os.environ.get("UPSTASH_REDIS_REST_URL", "").rstrip("/")
UPSTASH_TOKEN = os.environ.get("UPSTASH_REDIS_REST_TOKEN", "")
TTL_SECONDS   = 86400 * 8

# Comparison groups - terms fetched together for relative scaling
CHART2_GROUP = ["golf", "golf clubs", "golf equipment", "golf simulator"]  # Broad/participation
CHART3_GROUP = ["golf clubs", "golf balls", "golf bags"]  # Equipment breakdown
OEM_GROUP = ["Callaway", "Taylormade", "Titleist", "Ping", "Mizuno"]  # Brands (cat=261)

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

def get_comparison_token(terms, timeframe="2017-01-01 2026-04-30", geo="US", category=0):
    """Get token for multiple terms compared together (relative scaling)."""
    comparison_items = [{"keyword": t, "geo": geo, "time": timeframe} for t in terms]
    req_body = json.dumps({
        "comparisonItem": comparison_items,
        "category": category,
        "property": ""
    })
    params = {"hl": "en-US", "tz": "360", "req": req_body}
    r = session.get(f"{BASE}/trends/api/explore", params=params, timeout=30)
    if r.status_code == 429:
        raise Exception(f"429 rate limited")
    r.raise_for_status()
    data = json.loads(strip_xssi(r.text))
    widgets = data.get("widgets", [])
    w = next((w for w in widgets if w["id"] == "TIMESERIES"), None)
    if not w:
        raise ValueError(f"No TIMESERIES widget for comparison query")
    return w["token"], w["request"]

def get_comparison_series(token, request, terms):
    """Get time series for multiple terms (returns dict of term -> data)."""
    params = {"hl": "en-US", "tz": "360", "req": json.dumps(request), "token": token}
    r = session.get(f"{BASE}/trends/api/widgetdata/multiline", params=params, timeout=30)
    r.raise_for_status()
    data = json.loads(strip_xssi(r.text))
    
    results = {t: {} for t in terms}
    
    for pt in data.get("default", {}).get("timelineData", []):
        date = time.strftime("%Y-%m-%d", time.gmtime(int(pt["time"])))
        values = pt["value"]
        for i, t in enumerate(terms):
            if i < len(values):
                val = values[i]
                if isinstance(val, dict):
                    results[t][date] = val.get("extractedValue", 0)
                else:
                    results[t][date] = int(val)
    
    return results

def monthly_bucket(data):
    """Convert weekly/daily data to monthly buckets."""
    from collections import defaultdict
    b = defaultdict(list)
    for d, v in data.items():
        b[d[:7]].append(v)
    return {k: round(sum(v)/len(v)) for k,v in b.items()}

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
    encoded_key = urllib.parse.quote(str(key), safe='')
    url = f"{UPSTASH_URL}/setex/{encoded_key}/{ttl}"
    body = value.encode('utf-8') if isinstance(value, str) else str(value).encode('utf-8')
    print(f"  Writing {key} ({len(body)} bytes) to Upstash...")
    req = urllib.request.Request(url, data=body,
        headers={"Authorization": f"Bearer {UPSTASH_TOKEN}", "Content-Type": "application/octet-stream"},
        method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())
            print(f"  Upstash response: {result}")
            return result
    except Exception as e:
        print(f"  Upstash ERROR: {e}")
        raise

def fetch_comparison_group(terms, category=0, label=""):
    """Fetch multiple terms in one query (normalized relative to each other)."""
    today = time.strftime("%Y-%m-%d", time.gmtime())
    print(f"\n[{label}] Fetching {len(terms)} terms together for relative comparison...")
    print(f"  Terms: {', '.join(terms)}")
    
    retries = 2
    for attempt in range(retries):
        try:
            token, request = get_comparison_token(terms, timeframe=f"2017-01-01 {today}", category=category)
            time.sleep(1 + random.random())
            results = get_comparison_series(token, request, terms)
            for t in terms:
                print(f"  ✓ {t}: {len(results.get(t, {}))} points")
            return results
        except Exception as e:
            if attempt < retries - 1:
                wait = 15 + random.uniform(5, 10)
                print(f"  retrying in {wait:.0f}s ({e})...")
                time.sleep(wait)
            else:
                print(f"  ✗ Failed: {e}")
                return {t: {} for t in terms}

# ── Warm up session ───────────────────────────────────────────────────────────
print("Warming up session...")
try:
    session.get("https://trends.google.com/trends/explore", timeout=15)
    time.sleep(3 + random.random() * 2)
except Exception as e:
    print(f"  warm-up warning: {e}")

# ── Fetch comparison groups ───────────────────────────────────────────────────

# Chart 2 group: broad/participation terms
print("\n" + "="*60)
raw_chart2 = fetch_comparison_group(CHART2_GROUP, category=0, label="CHART2")

time.sleep(8 + random.uniform(3, 6))

# Chart 3 group: equipment breakdown
print("\n" + "="*60)
raw_chart3 = fetch_comparison_group(CHART3_GROUP, category=0, label="CHART3")

time.sleep(8 + random.uniform(3, 6))

# Chart 7 group: OEM brands (Golf category = 261)
print("\n" + "="*60)
raw_oem = fetch_comparison_group(OEM_GROUP, category=261, label="OEM")

# ── Transform and combine ─────────────────────────────────────────────────────
print("\n" + "="*60)
print("Transforming data...")

# Chart 2 terms (for quarterly chart and simulator comparison)
chart2_map = {
    "golf": "golf",
    "golf clubs": "golfClubs",
    "golf equipment": "golfEquipment",
    "golf simulator": "golfSimulator"
}

# Chart 3 terms (for equipment breakdown) - prefixed to distinguish from chart2
chart3_map = {
    "golf clubs": "golfClubsEquip",
    "golf balls": "golfBalls",
    "golf bags": "golfBags"
}

# OEM terms
oem_map = {
    "Callaway": "callaway",
    "Taylormade": "taylormade",
    "Titleist": "titleist",
    "Ping": "ping",
    "Mizuno": "mizuno"
}

monthly = {}

# Process Chart 2 group
for term, key in chart2_map.items():
    monthly[key] = monthly_bucket(raw_chart2.get(term, {}))
    
# Process Chart 3 group  
for term, key in chart3_map.items():
    monthly[key] = monthly_bucket(raw_chart3.get(term, {}))

# Process OEM group
for term, key in oem_map.items():
    monthly[key] = monthly_bucket(raw_oem.get(term, {}))

# Count fetched
fetched_chart2 = sum(1 for k in chart2_map.values() if monthly.get(k))
fetched_chart3 = sum(1 for k in chart3_map.values() if monthly.get(k))
fetched_oem = sum(1 for k in oem_map.values() if monthly.get(k))

print(f"\nChart 2 terms with data: {fetched_chart2}/4")
print(f"Chart 3 terms with data: {fetched_chart3}/3")
print(f"OEM terms with data: {fetched_oem}/5")

if fetched_chart2 == 0 and fetched_chart3 == 0 and fetched_oem == 0:
    print("ERROR: No data fetched.")
    sys.exit(1)

# Use chart2's golfClubs for annual/summerPeak (it's the primary clubs metric)
clubs = monthly.get("golfClubs", {})

payload = {
    "source": "live",
    "stale": False,
    "lastUpdated": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
    "data": {
        "monthly": monthly,
        "quarterly": {
            # Chart 2 terms for quarterly view
            "golfClubs": to_quarterly(monthly.get("golfClubs", {})),
            "golf": to_quarterly(monthly.get("golf", {})),
            "golfEquipment": to_quarterly(monthly.get("golfEquipment", {})),
            "golfSimulator": to_quarterly(monthly.get("golfSimulator", {})),
        },
        "annual": {
            "golfClubs": to_annual(clubs),
            "summerPeak": to_summer_peak(clubs),
        },
    },
}

print("\n" + "="*60)
print("Pushing to Redis...")
upstash_set("golf_trends_data", json.dumps(payload), TTL_SECONDS)
upstash_set("golf_trends_last_updated", payload["lastUpdated"], TTL_SECONDS+3600)
print("\n✓ Done! All comparison groups fetched with relative scaling.")
