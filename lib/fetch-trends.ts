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
        timeout: 120_000,
        maxBuffer: 1024 * 1024,
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

// Node.js fallback — uses eval('require') to prevent webpack from attempting
// to resolve 'google-trends-api' at build time (it is an optional runtime dep).
export async function runNodeFetch(): Promise<RawTrendsRecord> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let googleTrends: any;
  try {
    googleTrends = require('google-trends-api');
  } catch {
    throw new Error('google-trends-api not available — run: npm install google-trends-api');
  }

  const terms = [
    'golf clubs', 'golf balls', 'golf bags',
    'golf', 'golf equipment', 'golf simulator',
  ] as const;

  const results: RawTrendsRecord = {};
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  for (const term of terms) {
    try {
      const raw = await googleTrends.interestOverTime({
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
      await delay(2500 + Math.random() * 2000);
    } catch (err) {
      results[term] = { error: String(err) };
    }
  }

  return results;
}
