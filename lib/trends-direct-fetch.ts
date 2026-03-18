/**
 * lib/trends-direct-fetch.ts
 * Uses Node.js built-in https module + https-proxy-agent for reliable proxy support.
 */

import https from 'https';
import type { RawTrendsRecord } from './types';

const BASE_HOST = 'trends.google.com';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://trends.google.com/trends/explore',
};

function stripXssi(text: string): string {
  return text.replace(/^\)\]\}',?\n/, '').trim();
}

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proxyUrl = process.env.PROXY_URL;
    const parsed = new URL(url);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let agent: any = undefined;
    if (proxyUrl) {
      // eslint-disable-next-line no-eval
      const { HttpsProxyAgent } = eval('require')('https-proxy-agent');
      agent = new HttpsProxyAgent(proxyUrl);
    }

    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: HEADERS,
      agent,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        } else {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy(new Error('Request timeout'));
    });
    req.end();
  });
}

async function getToken(term: string, timeframe = 'today 5-y', geo = 'US') {
  const comparisonItem = [{ keyword: term, geo, time: timeframe }];
  const req = JSON.stringify({ comparisonItem, category: 0, property: '' });
  const params = new URLSearchParams({ hl: 'en-US', tz: '360', req });
  const url = `https://${BASE_HOST}/trends/api/explore?${params}`;

  const text = await httpsGet(url);
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
  const url = `https://${BASE_HOST}/trends/api/widgetdata/multiline?${params}`;

  const text = await httpsGet(url);
  const json = JSON.parse(stripXssi(text));
  const timelineData: Array<{ time: string; value: Array<{ extractedValue: number }> }> =
    json?.default?.timelineData ?? [];

  const result: Record<string, number> = {};
  for (const point of timelineData) {
    const date = new Date(parseInt(point.time, 10) * 1000);
    result[date.toISOString().split('T')[0]] = point.value?.[0]?.extractedValue ?? 0;
  }
  return result;
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

const TERMS = ['golf clubs', 'golf balls', 'golf bags', 'golf', 'golf equipment', 'golf simulator'] as const;

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
