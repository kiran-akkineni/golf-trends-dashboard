# Golf Search Volume / Time Series Dashboard

An auto-updating Next.js dashboard that fetches live Google Trends data for golf-related
search terms and renders six Chart.js time-series visualizations.

## Stack

- **Framework**: Next.js 14 (App Router, TypeScript)
- **Deployment**: Vercel (serverless + cron)
- **Data**: Python `pytrends` → Node.js `google-trends-api` fallback
- **Cache**: Upstash Redis (24h TTL) with hardcoded seed data fallback
- **Charts**: Chart.js 4.4.x (dynamic import, no SSR)
- **Styling**: Vanilla CSS custom properties — no Tailwind, no CSS-in-JS

## Quick Start

```bash
# 1. Install JS deps
npm install

# 2. Install Python deps (for the fetch script)
pip install -r requirements.txt

# 3. Copy env vars
cp .env.local.example .env.local
# → Fill in UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN

# 4. Run dev server
npm run dev
```

The dashboard runs immediately on seed data — no Redis required for local dev.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | Prod only | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Prod only | Upstash Redis token |
| `CRON_SECRET` | Prod only | 32-char hex — protects `/api/refresh` |
| `PYTHON_PATH` | Optional | Path to python3 binary (default: `python3`) |

## Architecture

```
Browser  ──GET /──►  page.tsx (Server Component)
                         │ pre-fetches Redis or seed
                         ▼
                     Dashboard.tsx (Client Component)
                         │ useEffect → fetch /api/data
                         │ re-hydrates with latest
                         ▼
                     6× Chart.js canvases
                     1× DOM heatmap

Vercel Cron ──GET /api/refresh──► runs fetch_trends.py
                                      │ stdout JSON
                                      ▼
                                  buildTrendsResponse()
                                      │
                                      ▼
                                  Redis SET (24h TTL)
```

## Data Flow

1. **`/api/refresh`** (cron-protected, runs daily 06:00 UTC):
   - Calls `scripts/fetch_trends.py` via `child_process.execFile`
   - Falls back to `google-trends-api` npm package if Python fails
   - Transforms weekly → monthly → quarterly/annual
   - Writes `TrendsResponse` JSON to Upstash Redis with 24h TTL

2. **`/api/data`** (public):
   - Reads from Redis → returns with `source: 'live'`
   - If Redis miss → returns hardcoded seed data with `source: 'seed', stale: true`

3. **Dashboard**:
   - Server-renders with pre-fetched data (no layout shift)
   - Re-fetches `/api/data` on client mount to hydrate with freshest data
   - Shows `⚠ Using cached data` banner when `stale === true`

## Charts

| # | Type | Terms |
|---|---|---|
| 01 | Bar + Line | Annual avg + summer peak, 2017–2026* |
| 02 | Multi-line | Quarterly: golf, clubs, equipment, simulator |
| 03 | Multi-line + fill | Monthly: clubs, balls, bags (last 24 mo) |
| 04 | Dual-line | Simulator vs. clubs — inverse seasonality |
| 05 | DOM heatmap | Golf clubs monthly index, 2017–present |
| 06 | Bar (YoY Δ) | Summer peak year-over-year delta |

## Rate Limit Strategy

Google Trends has no official API. The Python script fetches **one term at a time**
with 2.5–4.5s randomized delays between requests. Total fetch time: ~20–30 seconds.
The 24h Redis TTL means this only runs once per day.

## Deployment (Vercel)

1. Push to GitHub → connect repo to Vercel
2. Add env vars in Vercel dashboard
3. Create Upstash Redis instance → copy credentials
4. Add `CRON_SECRET` to env vars (used as `Authorization: Bearer <secret>`)
5. Deploy — the cron in `vercel.json` activates automatically

To trigger a manual refresh:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/refresh
```
