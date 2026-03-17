import { NextRequest, NextResponse } from 'next/server';
import { runPythonFetch, runNodeFetch } from '@/lib/fetch-trends';
import { buildTrendsResponse } from '@/lib/transform';
import { setTrendsData } from '@/lib/redis';

export const runtime = 'nodejs';
export const maxDuration = 150; // seconds

export async function GET(req: NextRequest) {
  // ── Auth guard ────────────────────────────────────────────────────────────
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') ?? '';
    const provided = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
    if (provided !== secret) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  const startedAt = Date.now();
  let raw;
  let fetchMethod = 'python';

  try {
    // Try Python/pytrends first
    console.log('[refresh] Starting Python fetch…');
    raw = await runPythonFetch();
  } catch (pythonErr) {
    console.warn('[refresh] Python failed, trying Node fallback:', String(pythonErr));
    fetchMethod = 'node';
    try {
      raw = await runNodeFetch();
    } catch (nodeErr) {
      console.error('[refresh] Node fallback also failed:', String(nodeErr));
      return NextResponse.json(
        {
          ok: false,
          error: `Both fetch methods failed. Python: ${String(pythonErr)}. Node: ${String(nodeErr)}`,
          stale: true,
        },
        { status: 200 } // always 200 so Vercel cron doesn't alert
      );
    }
  }

  const lastUpdated = new Date().toISOString();
  let trendsResponse;
  try {
    trendsResponse = buildTrendsResponse(raw, 'live', lastUpdated);
  } catch (transformErr) {
    return NextResponse.json(
      { ok: false, error: `Transform failed: ${String(transformErr)}`, stale: true },
      { status: 200 }
    );
  }

  // Count actually-fetched terms (no error key)
  const termsFetched = Object.values(raw).filter(
    (v) => !('error' in (v as object))
  ).length;

  const saved = await setTrendsData(trendsResponse);

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[refresh] Done — ${termsFetched}/6 terms, ${elapsed}s, saved=${saved}, method=${fetchMethod}`);

  return NextResponse.json({
    ok: true,
    termsFetched,
    lastUpdated,
    elapsed: `${elapsed}s`,
    fetchMethod,
    redisSaved: saved,
  });
}
