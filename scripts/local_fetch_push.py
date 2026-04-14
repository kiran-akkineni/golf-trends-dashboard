#!/usr/bin/env python3
"""
Fetches Google Trends data directly (no pytrends) and pushes to Upstash Redis.
Includes both equipment terms and OEM brand terms (Golf category = 261).

OEM brands are fetched in a SINGLE comparison query so they're normalized
relative to each other (matching how Google Trends displays them).
"""

import json, time, random, sys, os, urllib.request, urllib.parse
import requests

UPSTASH_URL   = os.environ.get("UPSTASH_REDIS_REST_URL", "").rstrip("/")
UPSTASH_TOKEN = os.environ.get("UPSTASH_REDIS_REST_TOKEN", "")
TTL_SECONDS   = 86400 * 8

# Equipment terms (general category, fetched individually)
EQUIPMENT_TERMS = [
    "golf clubs", "golf balls", "golf bags",
    "golf", "golf equipment", "golf simulator"
]

# OEM brand terms (Golf category = 261, fetched together for relative comparison)
OEM_TERMS = ["Callaway", "Taylormade", "Titleist", "Ping", "Mizuno"]

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

def get_token(term, timeframe="2017-01-01 2026-04-30", geo="US", category=0):
    """Get token for a single term."""
    req_body = json.dumps({
        "comparisonItem": [{"keyword": term, "geo": geo, "time": timeframe}],
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
        raise ValueError(f"No TIMESERIES widget for '{term}'")
    return w["token"], w["request"]

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

def get_series(token, request):
    """Get time series for a single term."""
    params = {"hl": "en-US", "tz": "360", "req": json.dumps(request), "token": token}
    r = session.get(f"{BASE}/trends/api/widgetdata/multiline", params=params, timeout=30)
    r.raise_for_status()
    data = json.loads(strip_xssi(r.text))
    result = {}
    for pt in data.get("default", {}).get("timelineData", []):
        date = time.strftime("%Y-%m-%d", time.gmtime(int(pt["time"])))
        val = pt["value"][0]
        if isinstance(val, dict):
            result[date] = val.get("extractedValue", 0)
        else:
            result[date] = int(val)
    return result

def get_comparison_series(token, request, terms):
    """Get time series for multiple terms (returns dict of term -> data)."""
    params = {"hl": "en-US", "tz": "360", "req": json.dumps(request), "token": token}
    r = session.get(f"{BASE}/trends/api/widgetdata/multiline", params=params, timeout=30)
    r.raise_for_status()
    data = json.loads(strip_xssi(r.text))
    
    # Initialize result dict for each term
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
    """Convert weekly or monthly data to monthly buckets."""
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

def fetch_single_terms(terms, category=0, label=""):
    """Fetch terms one at a time (each normalized independently)."""
    raw = {}
    today = time.strftime("%Y-%m-%d", time.gmtime())
    
    for i, term in enumerate(terms):
        print(f"[{label}] ({i+1}/{len(terms)}) {term}...", end=" ", flush=True)
        retries = 2
        for attempt in range(retries):
            try:
                token, request = get_token(term, timeframe=f"2017-01-01 {today}", category=category)
                time.sleep(1 + random.random())
                series = get_series(token, request)
                raw[term] = series
                print(f"✓ {len(series)} points")
                break
            except Exception as e:
                if attempt < retries - 1:
                    wait = 10 + random.uniform(5, 10)
                    print(f"  retrying in {wait:.0f}s ({e})...")
                    time.sleep(wait)
                else:
                    print(f"✗ {e}")
                    raw[term] = {}
        if i < len(terms)-1:
            delay = random.uniform(4.0, 7.0)
            print(f"  sleeping {delay:.1f}s...")
            time.sleep(delay)
    
    return raw

def fetch_comparison_terms(terms, category=0, label=""):
    """Fetch multiple terms in one query (normalized relative to each other)."""
    today = time.strftime("%Y-%m-%d", time.gmtime())
    print(f"[{label}] Fetching {len(terms)} terms together for relative comparison...")
    
    retries = 2
    for attempt in range(retries):
        try:
            token, request = get_comparison_token(terms, timeframe=f"2017-01-01 {today}", category=category)
            time.sleep(1 + random.random())
            results = get_comparison_series(token, request, terms)
            for t in terms:
                print(f"  {t}: {len(results.get(t, {}))} points")
            return results
        except Exception as e:
            if attempt < retries - 1:
                wait = 15 + random.uniform(5, 10)
                print(f"  retrying in {wait:.0f}s ({e})...")
                time.sleep(wait)
            else:
                print(f"✗ Failed: {e}")
                return {t: {} for t in terms}

# ── Warm up session with a page visit first ───────────────────────────────────
print("Warming up session...")
try:
    session.get("https://trends.google.com/trends/explore", timeout=15)
    time.sleep(3 + random.random() * 2)
except Exception as e:
    print(f"  warm-up warning: {e}")

# ── Fetch equipment terms (category=0, individually) ──────────────────────────
print("\nFetching equipment terms (individually)...")
raw_equipment = fetch_single_terms(EQUIPMENT_TERMS, category=0, label="EQUIP")

# ── Pause between batches ─────────────────────────────────────────────────────
print("\nPausing between batches...")
time.sleep(10 + random.uniform(5, 10))

# ── Fetch OEM brand terms together (category=261, relative comparison) ────────
print("\nFetching OEM brand terms (Golf category, relative comparison)...")
raw_oem = fetch_comparison_terms(OEM_TERMS, category=261, label="OEM")

# ── Combine and transform ─────────────────────────────────────────────────────
equipment_map = {
    "golf clubs": "golfClubs",
    "golf balls": "golfBalls",
    "golf bags": "golfBags",
    "golf": "golf",
    "golf equipment": "golfEquipment",
    "golf simulator": "golfSimulator"
}

oem_map = {
    "Callaway": "callaway",
    "Taylormade": "taylormade",
    "Titleist": "titleist",
    "Ping": "ping",
    "Mizuno": "mizuno"
}

monthly = {}

# Process equipment terms
for term, key in equipment_map.items():
    monthly[key] = monthly_bucket(raw_equipment.get(term, {}))

# Process OEM terms
for term, key in oem_map.items():
    monthly[key] = monthly_bucket(raw_oem.get(term, {}))

# Count fetched
fetched_equip = sum(1 for k in equipment_map.values() if monthly.get(k))
fetched_oem = sum(1 for k in oem_map.values() if monthly.get(k))
print(f"\nEquipment terms with data: {fetched_equip}/6")
print(f"OEM terms with data: {fetched_oem}/5")

if fetched_equip == 0 and fetched_oem == 0:
    print("ERROR: No data fetched.")
    sys.exit(1)

clubs = monthly.get("golfClubs", {})
payload = {
    "source": "live",
    "stale": False,
    "lastUpdated": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
    "data": {
        "monthly": monthly,
        "quarterly": {
            k: to_quarterly(monthly.get(k, {})) 
            for k in ["golfClubs", "golf", "golfEquipment", "golfSimulator"]
        },
        "annual": {
            "golfClubs": to_annual(clubs),
            "summerPeak": to_summer_peak(clubs)
        },
    },
}

print("\nPushing to Redis...")
upstash_set("golf_trends_data", json.dumps(payload), TTL_SECONDS)
upstash_set("golf_trends_last_updated", payload["lastUpdated"], TTL_SECONDS+3600)
print("✓ Done! Dashboard will now serve live data with relative OEM comparison.")
