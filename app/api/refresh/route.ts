import { NextRequest, NextResponse } from 'next/server';
import { fetchAllTerms } from '@/lib/trends-direct-fetch';
import { buildTrendsResponse } from '@/lib/transform';
import { setTrendsData } from '@/lib/redis';

export const runtime = 'nodejs';
export const maxDuration = 150;

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
  console.log('[refresh] Starting Google Trends fetch via proxy...');

  let raw;
  try {
    raw = await fetchAllTerms('today 5-y', 'US');
  } catch (err) {
    console.error('[refresh] Fetch failed:', String(err));
    return NextResponse.json(
      { ok: false, error: String(err), stale: true },
      { status: 200 }
    );
  }

  const termsFetched = Object.values(raw).filter(
    (v) => typeof v === 'object' && !('error' in v) && Object.keys(v).length > 0
  ).length;

  if (termsFetched === 0) {
    return NextResponse.json(
      { ok: false, error: 'All terms returned empty — proxy may be blocked', stale: true },
      { status: 200 }
    );
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

  const saved = await setTrendsData(trendsResponse);
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[refresh] Done — ${termsFetched}/6 terms, ${elapsed}s, redisSaved=${saved}`);

  return NextResponse.json({
    ok: true,
    termsFetched,
    lastUpdated,
    elapsed: `${elapsed}s`,
    redisSaved: saved,
  });
}
