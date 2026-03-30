#!/usr/bin/env python3
"""
Fetches Google Trends data directly (no pytrends) and pushes to Upstash Redis.
Category terms use category=0 (All). OEM brand terms use category=626 (Golf)
so that 'ping', 'mizuno' etc. resolve to the golf brands, not unrelated results.
"""

import json, time, random, sys, os, urllib.request, urllib.parse
import requests

UPSTASH_URL   = os.environ.get("UPSTASH_REDIS_REST_URL", "").rstrip("/")
UPSTASH_TOKEN = os.environ.get("UPSTASH_REDIS_REST_TOKEN", "")
TTL_SECONDS   = 86400 * 8

# ── Terms ──────────────────────────────────────────────────────────────────────
CATEGORY_TERMS = [
    "golf clubs",
    "golf balls",
    "golf bags",
    "golf",
    "golf equipment",
    "golf simulator",
]

# Shorter brand names — disambiguation handled by category=626 (Golf)
OEM_TERMS = [
    "callaway",
    "taylormade",
    "titleist",
    "ping",
    "mizuno",
]

TERMS = CATEGORY_TERMS + OEM_TERMS

GOOGLE_TRENDS_CATEGORY_GOLF = 261   # Sports > Individual Sports > Golf

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

def get_token(term, timeframe, geo="US", category=0):
    req_body = json.dumps({
        "comparisonItem": [{"keyword": term, "geo": geo, "time": timeframe}],
        "category": category,
        "property": ""
    })
    params = {"hl": "en-US", "tz": "360", "req": req_body}
    r = session.get(f"{BASE}/trends/api/explore", params=params, timeout=30)
    if r.status_code == 429:
        raise Exception("429 rate limited")
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
        val = pt["value"][0]
        result[date] = val.get("extractedValue", 0) if isinstance(val, dict) else int(val)
    return result

def monthly_bucket(data):
    from collections import defaultdict
    b = defaultdict(list)
    for d, v in data.items():
        b[d[:7]].append(v)
    return {k: round(sum(v)/len(v)) for k, v in b.items()}

def to_quarterly(m):
    from collections import defaultdict
    import math
    b = defaultdict(list)
    for k, v in m.items():
        if v is None: continue
        yr, mo = k.split("-")
        b[f"{yr}-Q{math.ceil(int(mo)/3)}"].append(v)
    return {k: round(sum(v)/len(v)) for k, v in b.items() if len(v) == 3}

def to_annual(m):
    from collections import defaultdict
    b = defaultdict(list)
    for k, v in m.items():
        if v is None: continue
        b[k[:4]].append(v)
    return {k: round(sum(v)/len(v)) for k, v in b.items() if len(v) >= 6}

def to_summer_peak(m):
    from collections import defaultdict
    b = defaultdict(list)
    for k, v in m.items():
        if v is None: continue
        yr, mo = k.split("-")
        if int(mo) in (6, 7, 8): b[yr].append(v)
    return {k: max(v) for k, v in b.items() if len(v) == 3}

def upstash_set(key, value, ttl):
    encoded_key = urllib.parse.quote(str(key), safe='')
    url = f"{UPSTASH_URL}/setex/{encoded_key}/{ttl}"
    body = value.encode('utf-8') if isinstance(value, str) else str(value).encode('utf-8')
    print(f"  Writing {key} ({len(body)} bytes) to Upstash...")
    req = urllib.request.Request(
        url, data=body,
        headers={"Authorization": f"Bearer {UPSTASH_TOKEN}", "Content-Type": "application/octet-stream"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        result = json.loads(resp.read())
        print(f"  Upstash response: {result}")
        return result

# ── Warm up ────────────────────────────────────────────────────────────────────
print("Warming up session...")
try:
    session.get("https://trends.google.com/trends/explore", timeout=15)
    time.sleep(3 + random.random() * 2)
except Exception as e:
    print(f"  warm-up warning: {e}")

# ── Fetch ──────────────────────────────────────────────────────────────────────
print(f"Fetching Google Trends data ({len(TERMS)} terms)...")
raw = {}

for i, term in enumerate(TERMS):
    if term == CATEGORY_TERMS[0]:
        print("\n── Category terms (category=0: All) ──")
    elif term == OEM_TERMS[0]:
        print(f"\n── OEM brand terms (category={GOOGLE_TRENDS_CATEGORY_GOLF}: Golf) ──")

    is_oem = term in OEM_TERMS
    cat = GOOGLE_TRENDS_CATEGORY_GOLF if is_oem else 0

    print(f"({i+1}/{len(TERMS)}) {term}...", end=" ", flush=True)
    retries = 2
    for attempt in range(retries):
        try:
            today = time.strftime("%Y-%m-%d", time.gmtime())
            token, request = get_token(term, timeframe=f"2017-01-01 {today}", category=cat)
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
    if i < len(TERMS) - 1:
        delay = random.uniform(4.0, 7.0)
        print(f"  sleeping {delay:.1f}s...")
        time.sleep(delay)

# ── Map → camelCase ────────────────────────────────────────────────────────────
term_map = {
    "golf clubs":     "golfClubs",
    "golf balls":     "golfBalls",
    "golf bags":      "golfBags",
    "golf":           "golf",
    "golf equipment": "golfEquipment",
    "golf simulator": "golfSimulator",
    # OEM — short names, disambiguated by Golf category
    "callaway":       "callaway",
    "taylormade":     "taylormade",
    "titleist":       "titleist",
    "ping":           "ping",
    "mizuno":         "mizuno",
}

monthly = {v: monthly_bucket(raw.get(k, {})) for k, v in term_map.items()}
fetched = sum(1 for v in monthly.values() if v)
print(f"\nTerms with data: {fetched}/{len(TERMS)}")
if fetched == 0:
    print("ERROR: No data fetched.")
    sys.exit(1)

clubs = monthly["golfClubs"]

payload = {
    "source": "live",
    "stale": False,
    "lastUpdated": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
    "data": {
        "monthly": monthly,
        "quarterly": {
            k: to_quarterly(monthly[k])
            for k in ["golfClubs", "golf", "golfEquipment", "golfSimulator",
                      "callaway", "taylormade", "titleist", "ping", "mizuno"]
        },
        "annual": {
            "golfClubs":  to_annual(clubs),
            "summerPeak": to_summer_peak(clubs),
            "callaway":   to_annual(monthly["callaway"]),
            "taylormade": to_annual(monthly["taylormade"]),
            "titleist":   to_annual(monthly["titleist"]),
            "ping":       to_annual(monthly["ping"]),
            "mizuno":     to_annual(monthly["mizuno"]),
        },
    },
}

print("\nPushing to Redis...")
upstash_set("golf_trends_data", json.dumps(payload), TTL_SECONDS)
upstash_set("golf_trends_last_updated", payload["lastUpdated"], TTL_SECONDS + 3600)
print("✓ Done! Dashboard will now serve live data.")
