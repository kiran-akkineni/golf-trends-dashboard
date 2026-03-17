#!/usr/bin/env python3
"""
Golf Trends Fetcher — fetches 6 terms from Google Trends via pytrends.
Fetches one at a time with randomized delays to avoid rate limiting.
Outputs JSON to stdout; all logs go to stderr.
"""

import json
import time
import random
import sys


def fetch_term(pytrends, term: str, timeframe: str = 'today 5-y', geo: str = 'US') -> dict:
    """Fetch a single term and return {ISO_date_str: int} dict."""
    pytrends.build_payload([term], cat=0, timeframe=timeframe, geo=geo)
    df = pytrends.interest_over_time()
    if df.empty:
        print(f'[warn] Empty response for: {term}', file=sys.stderr)
        return {}
    df = df.drop(columns=['isPartial'], errors='ignore')
    return {str(k): int(v) for k, v in df[term].items()}


def main():
    try:
        from pytrends.request import TrendReq
    except ImportError:
        print('{"error": "pytrends not installed"}')
        sys.exit(1)

    pytrends = TrendReq(
        hl='en-US',
        tz=360,
        timeout=(10, 25),
        retries=3,
        backoff_factor=0.5,
    )

    terms = [
        'golf clubs',
        'golf balls',
        'golf bags',
        'golf',
        'golf equipment',
        'golf simulator',
    ]

    results = {}

    for i, term in enumerate(terms):
        print(f'[fetch] ({i+1}/{len(terms)}) {term}', file=sys.stderr)
        try:
            data = fetch_term(pytrends, term)
            results[term] = data
            print(f'[fetch] OK — {len(data)} data points', file=sys.stderr)
        except Exception as e:
            print(f'[fetch] ERROR for {term!r}: {e}', file=sys.stderr)
            results[term] = {'error': str(e)}

        # Randomized delay — never batch to avoid 429s
        if i < len(terms) - 1:
            delay = random.uniform(2.5, 4.5)
            print(f'[fetch] Sleeping {delay:.1f}s…', file=sys.stderr)
            time.sleep(delay)

    print(json.dumps(results))


if __name__ == '__main__':
    main()
