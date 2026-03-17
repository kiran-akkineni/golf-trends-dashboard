import { execFile } from 'child_process';
import path from 'path';
import type { RawTrendsRecord } from './types';

export async function runPythonFetch(): Promise<RawTrendsRecord> {
  const pythonPath = process.env.PYTHON_PATH || 'python3';
  const scriptPath = path.join(process.cwd(), 'scripts', 'fetch_trends.py');

  return new Promise((resolve, reject) => {
    execFile(
      pythonPath,
      [scriptPath],
      {
        timeout: 120_000, // 2 min — sequential fetches with delays
        maxBuffer: 1024 * 1024, // 1MB
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error('[fetch-trends] Python error:', error.message);
          if (stderr) console.error('[fetch-trends] stderr:', stderr.slice(0, 500));
          reject(new Error(`Python script failed: ${error.message}`));
          return;
        }
        if (stderr) {
          // pytrends logs to stderr — not fatal
          console.warn('[fetch-trends] Python stderr (non-fatal):', stderr.slice(0, 500));
        }
        try {
          const data = JSON.parse(stdout.trim()) as RawTrendsRecord;
          resolve(data);
        } catch (parseErr) {
          reject(new Error(`Failed to parse Python output: ${(parseErr as Error).message}`));
        }
      }
    );
  });
}

// Node.js fallback via google-trends-api npm package
// Used when Python/pytrends is unavailable.
export async function runNodeFetch(): Promise<RawTrendsRecord> {
  // Dynamic import so the server doesn't crash if package isn't installed
  const googleTrends = await import('google-trends-api').catch(() => null);
  if (!googleTrends) {
    throw new Error('google-trends-api not available — install it as a fallback');
  }

  const terms = [
    'golf clubs', 'golf balls', 'golf bags',
    'golf', 'golf equipment', 'golf simulator',
  ] as const;

  const results: RawTrendsRecord = {};
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  for (const term of terms) {
    try {
      const raw = await googleTrends.default.interestOverTime({
        keyword: term,
        startTime: new Date('2017-01-01'),
        geo: 'US',
      });
      const parsed = JSON.parse(raw as string);
      const timeline: Array<{ time: string; value: number[] }> =
        parsed?.default?.timelineData ?? [];
      const record: Record<string, number> = {};
      for (const point of timeline) {
        const ts = new Date(parseInt(point.time, 10) * 1000).toISOString().split('T')[0];
        record[ts] = point.value[0] ?? 0;
      }
      results[term] = record;
      // Throttle
      await delay(2500 + Math.random() * 2000);
    } catch (err) {
      results[term] = { error: String(err) };
    }
  }

  return results;
}
