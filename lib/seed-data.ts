import type { TrendsResponse } from './types';

// ─── Golf Clubs raw monthly (2017-2026) ──────────────────────────────────────
const CLUBS_MONTHLY: Record<string, number> = {
  '2017-01': 25, '2017-02': 23, '2017-03': 30, '2017-04': 50,
  '2017-05': 72, '2017-06': 77, '2017-07': 78, '2017-08': 75,
  '2017-09': 59, '2017-10': 42, '2017-11': 33, '2017-12': 28,
  '2018-01': 26, '2018-02': 23, '2018-03': 31, '2018-04': 51,
  '2018-05': 74, '2018-06': 79, '2018-07': 81, '2018-08': 77,
  '2018-09': 60, '2018-10': 44, '2018-11': 34, '2018-12': 29,
  '2019-01': 27, '2019-02': 24, '2019-03': 31, '2019-04': 52,
  '2019-05': 76, '2019-06': 81, '2019-07': 83, '2019-08': 79,
  '2019-09': 62, '2019-10': 45, '2019-11': 35, '2019-12': 29,
  '2020-01': 28, '2020-02': 25, '2020-03': 33, '2020-04': 55,
  '2020-05': 80, '2020-06': 85, '2020-07': 87, '2020-08': 83,
  '2020-09': 65, '2020-10': 47, '2020-11': 37, '2020-12': 31,
  '2021-01': 34, '2021-02': 32, '2021-03': 58, '2021-04': 79,
  '2021-05': 94, '2021-06': 100, '2021-07': 98, '2021-08': 94,
  '2021-09': 72, '2021-10': 55, '2021-11': 43, '2021-12': 37,
  '2022-01': 34, '2022-02': 32, '2022-03': 52, '2022-04': 72,
  '2022-05': 87, '2022-06': 93, '2022-07': 92, '2022-08': 88,
  '2022-09': 68, '2022-10': 49, '2022-11': 39, '2022-12': 33,
  '2023-01': 33, '2023-02': 31, '2023-03': 50, '2023-04': 70,
  '2023-05': 84, '2023-06': 90, '2023-07': 88, '2023-08': 85,
  '2023-09': 66, '2023-10': 47, '2023-11': 37, '2023-12': 31,
  '2024-01': 33, '2024-02': 34, '2024-03': 52, '2024-04': 66,
  '2024-05': 77, '2024-06': 88, '2024-07': 90, '2024-08': 90,
  '2024-09': 72, '2024-10': 54, '2024-11': 47, '2024-12': 38,
  '2025-01': 32, '2025-02': 29, '2025-03': 46, '2025-04': 63,
  '2025-05': 76, '2025-06': 85, '2025-07': 88, '2025-08': 91,
  '2025-09': 75, '2025-10': 57, '2025-11': 50, '2025-12': 42,
  '2026-01': 36, '2026-02': 29,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function applyMultiplier(base: Record<string, number>, mult: number): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(base)) {
    result[k] = Math.max(1, Math.round(v * mult));
  }
  return result;
}

const BALLS_MONTHLY: Record<string, number> = {
  ...applyMultiplier(CLUBS_MONTHLY, 0.50),
  '2025-02': 14,
  '2025-08': 46,
};

const BAGS_MONTHLY: Record<string, number> = {
  ...applyMultiplier(CLUBS_MONTHLY, 0.14),
  '2025-02': 5,
  '2025-11': 16,
};

const GOLF_MONTHLY = applyMultiplier(CLUBS_MONTHLY, 1.08);
const EQUIP_MONTHLY = applyMultiplier(CLUBS_MONTHLY, 0.94);

// ─── Golf Simulator (inverted seasonal) ──────────────────────────────────────
const SIM_BASE = [72, 68, 54, 40, 30, 25, 23, 22, 34, 52, 68, 74];
const SIM_SCALE: Record<number, number> = {
  2017: 0.857, 2018: 0.926, 2019: 1.0,
  2020: 1.08,  2021: 1.166, 2022: 1.260,
  2023: 1.360, 2024: 1.360, 2025: 1.360, 2026: 1.360,
};

const SIM_MONTHLY: Record<string, number> = {};
for (const [yearStr, scale] of Object.entries(SIM_SCALE)) {
  const year = parseInt(yearStr);
  const months = year === 2026 ? 2 : 12;
  for (let m = 0; m < months; m++) {
    const key = `${year}-${String(m + 1).padStart(2, '0')}`;
    SIM_MONTHLY[key] = Math.min(100, Math.round(SIM_BASE[m] * scale));
  }
}

// ─── OEM Brand Seed Data ──────────────────────────────────────────────────────
//
// Brand search follows the same summer-peak seasonality as equipment terms but at
// much lower absolute indices (brand searches are a small subset of category searches).
//
// Scale factors vs CLUBS_MONTHLY are derived from relative brand prominence:
//   Callaway Golf:  ~0.38× (largest publicly-traded OEM, high consumer awareness)
//   TaylorMade Golf: ~0.36× (close competitor; strong driver/iron marketing)
//   Titleist:        ~0.28× (premium/loyal base; less mass-market search)
//   Ping:            ~0.16× (respected but lower share-of-voice)
//   Mizuno:          ~0.08× (niche/tour-oriented; smallest consumer search footprint)
//
// Brand-specific adjustments layered on top:
//   Callaway 2020: Acquired Odyssey/TM discussion lifted; slight boost during pandemic surge
//   TaylorMade 2021: Spin-off from KPS Capital completed — independent brand buzz peak
//   Titleist 2021: Steady — ACUSHNET (parent) not a consumer search driver; slight bump
//   Ping: stable relative to category; no major brand event spikes modeled
//   Mizuno 2023-24: JPX 925/923 launch cycle gives modest lift to already-low base

function oemSeries(
  base: Record<string, number>,
  mult: number,
  overrides: Record<string, number> = {}
): Record<string, number> {
  const result = applyMultiplier(base, mult);
  for (const [k, v] of Object.entries(overrides)) {
    result[k] = v;
  }
  return result;
}

// Callaway Golf — strong pandemic lift, mature brand, slight softening post-2022
const CALLAWAY_MONTHLY = oemSeries(CLUBS_MONTHLY, 0.38, {
  // Pandemic outdoor surge gave Callaway outsized lift (Big Bertha nostalgia + Epic driver)
  '2020-06': 35, '2020-07': 36, '2020-08': 34,
  '2021-05': 39, '2021-06': 42, '2021-07': 41, '2021-08': 38,
  // Steady post-pandemic; TOPGOLF merger created some brand confusion in search
  '2022-06': 37, '2022-07': 37, '2022-08': 35,
  '2023-06': 35, '2023-07': 36, '2023-08': 34,
  '2024-06': 34, '2024-07': 35, '2024-08': 35,
  '2025-02': 12, '2025-08': 35,
  '2026-01': 14, '2026-02': 11,
});

// TaylorMade Golf — strong driver-led marketing, close to Callaway in search volume
// TaylorMade became independent brand 2017 (sold by Adidas); modest brand rebuild 2017-18
const TAYLORMADE_MONTHLY = oemSeries(CLUBS_MONTHLY, 0.36, {
  // 2017-18: slightly depressed — brand transition from Adidas ownership
  '2017-05': 24, '2017-06': 26, '2017-07': 27, '2017-08': 25,
  '2018-05': 26, '2018-06': 28, '2018-07': 29, '2018-08': 28,
  // Stealth driver launch Jan 2022 drove winter search spike
  '2022-01': 18, '2022-02': 20, '2022-03': 22,
  '2022-06': 36, '2022-07': 35, '2022-08': 33,
  '2023-06': 34, '2023-07': 34, '2023-08': 33,
  '2024-06': 34, '2024-07': 35, '2024-08': 34,
  '2025-02': 11, '2025-08': 34,
  '2026-01': 14, '2026-02': 11,
});

// Titleist — premium, stable, loyal demographic; lower search but very consistent
// Slightly less seasonal than equipment — dedicated ball buyers search year-round
const TITLEIST_MONTHLY = oemSeries(CLUBS_MONTHLY, 0.28, {
  // Pro V1 ball loyalty creates somewhat flatter seasonal curve
  '2017-01': 8,  '2017-12': 9,   '2018-01': 9,  '2018-12': 9,
  '2019-01': 9,  '2019-12': 10,
  '2021-05': 29, '2021-06': 31, '2021-07': 30, '2021-08': 29,
  '2022-06': 28, '2022-07': 28, '2022-08': 27,
  '2023-06': 27, '2023-07': 27, '2023-08': 26,
  '2024-06': 27, '2024-07': 27, '2024-08': 27,
  '2025-02': 9,  '2025-08': 27,
  '2026-01': 11, '2026-02': 9,
});

// Ping — premium/fitting-focused; lower consumer search volume; stable share
const PING_MONTHLY = oemSeries(CLUBS_MONTHLY, 0.16, {
  '2021-05': 17, '2021-06': 18, '2021-07': 18, '2021-08': 17,
  '2022-06': 16, '2022-07': 16, '2022-08': 15,
  '2023-06': 15, '2023-07': 16, '2023-08': 15,
  '2024-06': 15, '2024-07': 16, '2024-08': 16,
  '2025-02': 5,  '2025-08': 16,
  '2026-01': 6,  '2026-02': 5,
});

// Mizuno — niche/tour iron brand; smallest search footprint; slight 2023-24 uptick (JPX launch)
const MIZUNO_MONTHLY = oemSeries(CLUBS_MONTHLY, 0.08, {
  '2021-05': 9,  '2021-06': 10, '2021-07': 10, '2021-08': 9,
  // JPX 923/925 iron launches lifted search modestly
  '2023-03': 8,  '2023-04': 9,
  '2023-06': 9,  '2023-07': 9,  '2023-08': 8,
  '2024-02': 7,  '2024-03': 8,
  '2024-06': 8,  '2024-07': 9,  '2024-08': 8,
  '2025-02': 3,  '2025-08': 8,
  '2026-01': 3,  '2026-02': 3,
});

// ─── Transform helpers ────────────────────────────────────────────────────────
function toQuarterly(monthly: Record<string, number>): Record<string, number> {
  const quarters: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(monthly)) {
    const [year, month] = k.split('-').map(Number);
    const q = Math.ceil(month / 3);
    const qKey = `${year}-Q${q}`;
    if (!quarters[qKey]) quarters[qKey] = [];
    quarters[qKey].push(v);
  }
  const result: Record<string, number> = {};
  for (const [k, vals] of Object.entries(quarters)) {
    if (vals.length === 3) {
      result[k] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    }
  }
  return result;
}

function toAnnual(monthly: Record<string, number>): Record<string, number> {
  const years: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(monthly)) {
    const year = k.split('-')[0];
    if (!years[year]) years[year] = [];
    years[year].push(v);
  }
  const result: Record<string, number> = {};
  for (const [k, vals] of Object.entries(years)) {
    if (vals.length >= 6) {
      result[k] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    }
  }
  return result;
}

function toSummerPeak(monthly: Record<string, number>): Record<string, number> {
  const peaks: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(monthly)) {
    const [year, month] = k.split('-').map(Number);
    if (month >= 6 && month <= 8) {
      if (!peaks[year]) peaks[year] = [];
      peaks[year].push(v);
    }
  }
  const result: Record<string, number> = {};
  for (const [k, vals] of Object.entries(peaks)) {
    if (vals.length === 3) result[k] = Math.max(...vals);
  }
  return result;
}

// ─── Assemble seed TrendsResponse ────────────────────────────────────────────
export const SEED_DATA: TrendsResponse = {
  source: 'seed',
  stale: true,
  lastUpdated: null,
  data: {
    monthly: {
      golfClubs:     CLUBS_MONTHLY,
      golfBalls:     BALLS_MONTHLY,
      golfBags:      BAGS_MONTHLY,
      golf:          GOLF_MONTHLY,
      golfEquipment: EQUIP_MONTHLY,
      golfSimulator: SIM_MONTHLY,
      callaway:      CALLAWAY_MONTHLY,
      taylormade:    TAYLORMADE_MONTHLY,
      titleist:      TITLEIST_MONTHLY,
      ping:          PING_MONTHLY,
      mizuno:        MIZUNO_MONTHLY,
    },
    quarterly: {
      golfClubs:     toQuarterly(CLUBS_MONTHLY),
      golf:          toQuarterly(GOLF_MONTHLY),
      golfEquipment: toQuarterly(EQUIP_MONTHLY),
      golfSimulator: toQuarterly(SIM_MONTHLY),
      callaway:      toQuarterly(CALLAWAY_MONTHLY),
      taylormade:    toQuarterly(TAYLORMADE_MONTHLY),
      titleist:      toQuarterly(TITLEIST_MONTHLY),
      ping:          toQuarterly(PING_MONTHLY),
      mizuno:        toQuarterly(MIZUNO_MONTHLY),
    },
    annual: {
      golfClubs:  toAnnual(CLUBS_MONTHLY),
      summerPeak: toSummerPeak(CLUBS_MONTHLY),
      callaway:   toAnnual(CALLAWAY_MONTHLY),
      taylormade: toAnnual(TAYLORMADE_MONTHLY),
      titleist:   toAnnual(TITLEIST_MONTHLY),
      ping:       toAnnual(PING_MONTHLY),
      mizuno:     toAnnual(MIZUNO_MONTHLY),
    },
  },
};
