/**
 * lib/trends-direct-fetch.ts
 *
 * Fetches Google Trends data directly via the unofficial API endpoints,
 * routing through a residential proxy using undici ProxyAgent (compatible
 * with Node.js 18+ native fetch on Vercel).
 */

import type { RawTrendsRecord } from './types';

const BASE = 'https://trends.google.com';
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://trends.google.com/trends/explore',
};

function stripXssi(text: string): string {
  return text.replace(/^\)\]\}',?\n/, '').trim();
}

async function proxyFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const proxyUrl = process.env.PROXY_URL;

  if (proxyUrl) {
    // Use undici ProxyAgent — works with Node.js 18+ native fetch
    // eslint-disable-next-line no-eval
    const { ProxyAgent, fetch: undiciFetch } = eval('require')('undici');
    const dispatcher = new ProxyAgent(proxyUrl);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return undiciFetch(url, { ...init, dispatcher } as any) as unknown as Response;
  }

  return fetch(url, init);
}

async function getToken(
  term: string,
  timeframe = 'today 5-y',
  geo = 'US'
): Promise<{ token: string; request: object }> {
  const comparisonItem = [{ keyword: term, geo, time: timeframe }];
  const req = JSON.stringify({ comparisonItem, category: 0, property: '' });
  const params = new URLSearchParams({ hl: 'en-US', tz: '360', req });
  const url = `${BASE}/trends/api/explore?${params}`;

  const resp = await proxyFetch(url, { headers: HEADERS });
  if (!resp.ok) throw new Error(`explore HTTP ${resp.status} for "${term}"`);

  const text = await resp.text();
  const json = JSON.parse(stripXssi(text));
  const widgets: Array<{ id: string; token: string; request: object }> = json?.widgets ?? [];
  const timeWidget = widgets.find((w) => w.id === 'TIMESERIES');
  if (!timeWidget) throw new Error(`No TIMESERIES widget for "${term}"`);

  return { token: timeWidget.token, request: timeWidget.request };
}

async function getTimeSeries(token: string, request: object): Promise<Record<string, number>> {
  const params = new URLSearchParams({
    hl: 'en-US', tz: '360',
    req: JSON.stringify(request),
    token,
  });
  const url = `${BASE}/trends/api/widgetdata/multiline?${params}`;

  const resp = await proxyFetch(url, { headers: HEADERS });
  if (!resp.ok) throw new Error(`widgetdata HTTP ${resp.status}`);

  const text = await resp.text();
  const json = JSON.parse(stripXssi(text));
  const timelineData: Array<{
    time: string;
    value: Array<{ extractedValue: number }>;
  }> = json?.default?.timelineData ?? [];

  const result: Record<string, number> = {};
  for (const point of timelineData) {
    const date = new Date(parseInt(point.time, 10) * 1000);
    const iso = date.toISOString().split('T')[0];
    result[iso] = point.value?.[0]?.extractedValue ?? 0;
  }
  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const TERMS = [
  'golf clubs', 'golf balls', 'golf bags',
  'golf', 'golf equipment', 'golf simulator',
] as const;

export async function fetchAllTerms(timeframe = 'today 5-y', geo = 'US'): Promise<RawTrendsRecord> {
  const results: RawTrendsRecord = {};

  for (let i = 0; i < TERMS.length; i++) {
    const term = TERMS[i];
    console.log(`[trends] (${i + 1}/${TERMS.length}) fetching "${term}"...`);
    try {
      const { token, request } = await getToken(term, timeframe, geo);
      await sleep(500 + Math.random() * 500);
      const series = await getTimeSeries(token, request);
      results[term] = series;
      console.log(`[trends] ✓ "${term}" — ${Object.keys(series).length} points`);
    } catch (err) {
      console.error(`[trends] ✗ "${term}": ${String(err)}`);
      results[term] = { error: String(err) };
    }
    if (i < TERMS.length - 1) {
      const delay = 3000 + Math.random() * 4000;
      console.log(`[trends] sleeping ${(delay / 1000).toFixed(1)}s...`);
      await sleep(delay);
    }
  }

  return results;
}
