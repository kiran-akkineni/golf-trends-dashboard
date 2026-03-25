// Chart.js global config helpers
// Chart.js cannot read CSS variables — colors must be hardcoded hex.
// We detect prefers-color-scheme at import time (client-side only).

const isDark =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : true; // SSR fallback: assume dark

// ── Palette ───────────────────────────────────────────────────────────────────
export const COLORS = {
  blue:    isDark ? '#60a5fa' : '#2563eb',
  green:   isDark ? '#4ade80' : '#16a34a',
  teal:    isDark ? '#2dd4bf' : '#0d9488',
  purple:  isDark ? '#a78bfa' : '#7c3aed',
  gold:    isDark ? '#fbbf24' : '#d97706',
  red:     isDark ? '#f87171' : '#dc2626',
  grid:    isDark ? '#334155' : '#e2e8f0',
  tick:    isDark ? '#94a3b8' : '#64748b',
  surface: isDark ? '#1e293b' : '#ffffff',
} as const;

export const TOOLTIP_CONFIG = {
  backgroundColor: isDark ? '#0f172a' : '#1e293b',
  borderColor: isDark ? '#334155' : '#475569',
  borderWidth: 1,
  titleColor: isDark ? '#fbbf24' : '#f8fafc',
  bodyColor: isDark ? '#94a3b8' : '#cbd5e1',
  padding: 10,
  titleFont: { family: "'IBM Plex Mono'" },
  bodyFont:  { family: "'IBM Plex Mono'" },
};

export const SCALE_CONFIG = {
  x: {
    ticks: { color: COLORS.tick, font: { family: "'IBM Plex Mono'", size: 10 } },
    grid:  { color: COLORS.grid },
  },
  y: {
    ticks: { color: COLORS.tick, font: { family: "'IBM Plex Mono'", size: 10 } },
    grid:  { color: COLORS.grid },
    min: 0,
    max: 105,
  },
};

// Bar color tiers for the annual chart (blue ramp)
export function barColor(value: number): string {
  if (isDark) {
    if (value >= 75) return '#60a5fa';  // bright blue
    if (value >= 65) return '#3b82f6';  // mid blue
    if (value >= 58) return '#1d4ed8';  // deep blue
    return '#1e3a5f';                    // muted slate-blue
  }
  // light mode
  if (value >= 75) return '#2563eb';
  if (value >= 65) return '#3b82f6';
  if (value >= 58) return '#93c5fd';
  return '#bfdbfe';
}

// Reference line colors (translucent)
export const REF_LINES = {
  prePandemic: isDark ? 'rgba(251,191,36,0.3)' : 'rgba(217,119,6,0.25)',
  postPandemic: isDark ? 'rgba(96,165,250,0.3)' : 'rgba(37,99,235,0.25)',
} as const;

// Chart fill alphas
export const FILLS = {
  clubs:  isDark ? 'rgba(96,165,250,0.08)' : 'rgba(37,99,235,0.06)',
  balls:  isDark ? 'rgba(74,222,128,0.05)' : 'rgba(22,163,74,0.04)',
  gold55: isDark ? 'rgba(251,191,36,0.55)' : 'rgba(217,119,6,0.55)',
} as const;

// YoY delta bar colors
export function yoyBarColor(value: number | null, partial: boolean): string {
  if (value === null) return 'transparent';
  if (partial) return FILLS.gold55;
  return value >= 0 ? COLORS.green : COLORS.red;
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
