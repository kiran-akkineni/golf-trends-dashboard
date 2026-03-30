import type { TrendsResponse, RawTrendsRecord } from './types';

// Convert raw pytrends output (weekly ISO timestamps → values)
// to monthly buckets by averaging weeks whose start date falls within that month.
// Marks null if fewer than 2 data points fall in a month.
export function weeklyToMonthly(
  weekly: Record<string, number>
): Record<string, number | null> {
  const monthBuckets: Record<string, number[]> = {};

  for (const [isoDate, value] of Object.entries(weekly)) {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) continue;
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const key = `${year}-${month}`;
    if (!monthBuckets[key]) monthBuckets[key] = [];
    monthBuckets[key].push(value);
  }

  const result: Record<string, number | null> = {};
  for (const [key, vals] of Object.entries(monthBuckets)) {
    if (vals.length < 2) {
      result[key] = null;
    } else {
      result[key] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    }
  }
  return result;
}

// Quarterly aggregation: average 3 months per quarter.
// Only emits a quarter if all 3 constituent months are non-null.
export function monthlyToQuarterly(
  monthly: Record<string, number | null>
): Record<string, number> {
  const buckets: Record<string, (number | null)[]> = {};

  for (const [key, val] of Object.entries(monthly)) {
    const [yearStr, monthStr] = key.split('-');
    const month = parseInt(monthStr, 10);
    const q = Math.ceil(month / 3);
    const qKey = `${yearStr}-Q${q}`;
    if (!buckets[qKey]) buckets[qKey] = [];
    buckets[qKey].push(val);
  }

  const result: Record<string, number> = {};
  for (const [qKey, vals] of Object.entries(buckets)) {
    if (vals.length === 3 && vals.every((v) => v !== null)) {
      const nums = vals as number[];
      result[qKey] = Math.round(nums.reduce((a, b) => a + b, 0) / 3);
    }
  }
  return result;
}

// Annual aggregation: average all non-null months within a year.
// Requires at least 6 months of data to emit an annual value.
export function monthlyToAnnual(
  monthly: Record<string, number | null>
): Record<string, number> {
  const buckets: Record<string, number[]> = {};

  for (const [key, val] of Object.entries(monthly)) {
    if (val === null) continue;
    const year = key.split('-')[0];
    if (!buckets[year]) buckets[year] = [];
    buckets[year].push(val);
  }

  const result: Record<string, number> = {};
  for (const [year, vals] of Object.entries(buckets)) {
    if (vals.length >= 6) {
      result[year] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    }
  }
  return result;
}

// Summer peak: max of Jun/Jul/Aug for years with all 3 months present.
export function monthlyToSummerPeak(
  monthly: Record<string, number | null>
): Record<string, number> {
  const summer: Record<string, number[]> = {};

  for (const [key, val] of Object.entries(monthly)) {
    if (val === null) continue;
    const [yearStr, monthStr] = key.split('-');
    const month = parseInt(monthStr, 10);
    if (month >= 6 && month <= 8) {
      if (!summer[yearStr]) summer[yearStr] = [];
      summer[yearStr].push(val);
    }
  }

  const result: Record<string, number> = {};
  for (const [year, vals] of Object.entries(summer)) {
    if (vals.length === 3) result[year] = Math.max(...vals);
  }
  return result;
}

// Build a full TrendsResponse from the raw pytrends dict output
export function buildTrendsResponse(
  raw: RawTrendsRecord,
  source: 'live' | 'seed' = 'live',
  lastUpdated: string | null = new Date().toISOString()
): TrendsResponse {
  const termMap: Record<string, keyof TrendsResponse['data']['monthly']> = {
    'golf clubs':        'golfClubs',
    'golf balls':        'golfBalls',
    'golf bags':         'golfBags',
    'golf':              'golf',
    'golf equipment':    'golfEquipment',
    'golf simulator':    'golfSimulator',
    // OEM brands
    'callaway golf':     'callaway',
    'taylormade golf':   'taylormade',
    'titleist':          'titleist',
    'ping golf':         'ping',
    'mizuno golf':       'mizuno',
  };

  const monthly: TrendsResponse['data']['monthly'] = {
    golfClubs: {}, golfBalls: {}, golfBags: {},
    golf: {}, golfEquipment: {}, golfSimulator: {},
    callaway: {}, taylormade: {}, titleist: {}, ping: {}, mizuno: {},
  };

  for (const [term, key] of Object.entries(termMap)) {
    const rawTerm = raw[term];
    if (!rawTerm || 'error' in rawTerm) continue;
    monthly[key] = weeklyToMonthly(rawTerm as Record<string, number>);
  }

  return {
    source,
    stale: false,
    lastUpdated,
    data: {
      monthly,
      quarterly: {
        golfClubs:     monthlyToQuarterly(monthly.golfClubs),
        golf:          monthlyToQuarterly(monthly.golf),
        golfEquipment: monthlyToQuarterly(monthly.golfEquipment),
        golfSimulator: monthlyToQuarterly(monthly.golfSimulator),
        callaway:      monthlyToQuarterly(monthly.callaway),
        taylormade:    monthlyToQuarterly(monthly.taylormade),
        titleist:      monthlyToQuarterly(monthly.titleist),
        ping:          monthlyToQuarterly(monthly.ping),
        mizuno:        monthlyToQuarterly(monthly.mizuno),
      },
      annual: {
        golfClubs:  monthlyToAnnual(monthly.golfClubs),
        summerPeak: monthlyToSummerPeak(monthly.golfClubs),
        callaway:   monthlyToAnnual(monthly.callaway),
        taylormade: monthlyToAnnual(monthly.taylormade),
        titleist:   monthlyToAnnual(monthly.titleist),
        ping:       monthlyToAnnual(monthly.ping),
        mizuno:     monthlyToAnnual(monthly.mizuno),
      },
    },
  };
}
