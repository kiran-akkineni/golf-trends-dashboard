// Chart.js global config helpers

export const TOOLTIP_CONFIG = {
  backgroundColor: '#0d1810',
  borderColor: '#1c2e20',
  borderWidth: 1,
  titleColor: '#e3b341',
  bodyColor: '#6b8f76',
  padding: 10,
  titleFont: { family: "'IBM Plex Mono'" },
  bodyFont:  { family: "'IBM Plex Mono'" },
};

export const SCALE_CONFIG = {
  x: {
    ticks: { color: '#4d6b56', font: { family: "'IBM Plex Mono'", size: 10 } },
    grid:  { color: '#1c2e20' },
  },
  y: {
    ticks: { color: '#4d6b56', font: { family: "'IBM Plex Mono'", size: 10 } },
    grid:  { color: '#1c2e20' },
    min: 0,
    max: 105,
  },
};

export function barColor(value: number): string {
  if (value >= 75) return '#39d353';
  if (value >= 65) return '#26a641';
  if (value >= 58) return '#1a6b2e';
  return '#1c2e20';
}

// Sort object keys and return [keys, values] arrays
export function sortedEntries(
  obj: Record<string, number | null | undefined>
): [string[], (number | null)[]] {
  const entries = Object.entries(obj).sort(([a], [b]) => a.localeCompare(b));
  return [entries.map(([k]) => k), entries.map(([, v]) => v ?? null)];
}

// Format YYYY-MM → "Mon'YY"
export function fmtMonthLabel(key: string): string {
  const [year, month] = key.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(month, 10) - 1]}'${year.slice(2)}`;
}

// Format YYYY-QN → "Q1'17"
export function fmtQuarterLabel(key: string): string {
  const [year, q] = key.split('-');
  return `${q}'${year.slice(2)}`;
}

// Get last N months of data sorted by key
export function lastNMonths(
  monthly: Record<string, number | null>,
  n: number
): { keys: string[]; values: (number | null)[] } {
  const sorted = Object.keys(monthly).sort();
  const last = sorted.slice(-n);
  return {
    keys: last,
    values: last.map((k) => monthly[k] ?? null),
  };
}

// Derive YoY summer peak delta series
export function yoyDeltas(
  summerPeak: Record<string, number>,
  clubs2026Jan: number | null,
  clubs2026Feb: number | null
): { labels: string[]; values: (number | null)[]; isPartial: boolean[] } {
  const baseYears = ['2019','2020','2021','2022','2023','2024','2025'];
  const labels: string[] = [];
  const values: (number | null)[] = [];
  const isPartial: boolean[] = [];

  for (const year of baseYears) {
    const cur = summerPeak[year];
    const prev = summerPeak[String(parseInt(year) - 1)];
    if (cur !== undefined && prev !== undefined) {
      labels.push(year);
      values.push(cur - prev);
      isPartial.push(false);
    }
  }

  // 2026 partial — use Jan+Feb avg delta vs prior year Jan+Feb
  const jan25 = 32; const feb25 = 29; // from seed
  if (clubs2026Jan !== null && clubs2026Feb !== null) {
    const cur2026 = Math.round((clubs2026Jan + clubs2026Feb) / 2);
    const prior   = Math.round((jan25 + feb25) / 2);
    labels.push('2026*');
    values.push(cur2026 - prior);
    isPartial.push(true);
  }

  return { labels, values, isPartial };
}
