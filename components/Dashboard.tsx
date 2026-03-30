'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { TrendsResponse } from '@/lib/types';
import StaleIndicator from './StaleIndicator';
import ChartCard from './ChartCard';
import Heatmap from './Heatmap';
import {
  TOOLTIP_CONFIG, SCALE_CONFIG, barColor,
  sortedEntries, fmtMonthLabel, fmtQuarterLabel,
  lastNMonths, yoyDeltas,
} from '@/lib/chart-helpers';

// ── Types ─────────────────────────────────────────────────────────────────────
interface DashboardProps {
  initialData: TrendsResponse;
}

// ── Chart.js dynamic import ───────────────────────────────────────────────────
async function loadChartJs() {
  const { Chart, registerables } = await import('chart.js');
  Chart.register(...registerables);
  return Chart;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard({ initialData }: DashboardProps) {
  const [data, setData] = useState<TrendsResponse>(initialData);
  const [chartJsReady, setChartJsReady] = useState(false);
  const ChartRef = useRef<any>(null);

  // Canvas refs
  const c1 = useRef<HTMLCanvasElement>(null);
  const c2 = useRef<HTMLCanvasElement>(null);
  const c3 = useRef<HTMLCanvasElement>(null);
  const c4 = useRef<HTMLCanvasElement>(null);
  const c6 = useRef<HTMLCanvasElement>(null);
  const c7 = useRef<HTMLCanvasElement>(null);

  // Chart instance refs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inst1 = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inst2 = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inst3 = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inst4 = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inst6 = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inst7 = useRef<any>(null);

  // Load Chart.js once
  useEffect(() => {
    loadChartJs().then((Chart) => {
      ChartRef.current = Chart;
      setChartJsReady(true);
    });
  }, []);

  // Hydrate with live data on mount
  useEffect(() => {
    fetch('/api/data')
      .then((r) => r.json())
      .then((fresh: TrendsResponse) => {
        if (fresh?.data?.monthly?.golfClubs) setData(fresh);
      })
      .catch(() => { /* keep initialData */ });
  }, []);

  // Destroy a chart instance safely
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function destroy(ref: React.MutableRefObject<any>) {
    if (ref.current) {
      ref.current.destroy();
      ref.current = null;
    }
  }

  // ── Chart 1: Long-Run Annual ────────────────────────────────────────────────
  const buildChart1 = useCallback(() => {
    const Chart = ChartRef.current;
    if (!Chart || !c1.current) return;
    destroy(inst1);

    const { annual } = data.data;
    const allYears = ['2017','2018','2019','2020','2021','2022','2023','2024','2025','2026*'];
    const clubVals = allYears.map((y) => annual.golfClubs[y === '2026*' ? '2026' : y] ?? null);
    const peakVals = allYears.map((y) => annual.summerPeak[y === '2026*' ? '2026' : y] ?? null);

    inst1.current = new Chart(c1.current, {
      type: 'bar',
      data: {
        labels: allYears,
        datasets: [
          {
            type: 'bar',
            label: 'Annual Avg',
            data: clubVals,
            backgroundColor: clubVals.map((v) => v !== null ? barColor(v) : 'transparent'),
            borderRadius: 3,
            order: 2,
          },
          {
            type: 'line',
            label: 'Summer Peak',
            data: peakVals,
            borderColor: '#e3b341',
            backgroundColor: 'transparent',
            pointRadius: 4,
            pointBackgroundColor: '#e3b341',
            borderWidth: 1.5,
            tension: 0.3,
            order: 1,
          },
          {
            type: 'line',
            label: 'Pre-pandemic baseline (52)',
            data: allYears.map(() => 52),
            borderColor: 'rgba(227,179,65,0.35)',
            borderDash: [5, 4],
            pointRadius: 0,
            borderWidth: 1,
            order: 3,
          },
          {
            type: 'line',
            label: 'Post-pandemic normal (67)',
            data: allYears.map(() => 67),
            borderColor: 'rgba(57,211,83,0.35)',
            borderDash: [5, 4],
            pointRadius: 0,
            borderWidth: 1,
            order: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            ...TOOLTIP_CONFIG,
            callbacks: {
              title: ([item]: [{ label: string }]) => {
                const y = item.label;
                return y === '2026*' ? '2026 (partial — Jan/Feb avg)' : y;
              },
            },
          },
        },
        scales: {
          x: {
            ...SCALE_CONFIG.x,
            ticks: {
              ...SCALE_CONFIG.x.ticks,
              color: (ctx) => ctx.tick?.label === '2026*' ? '#e3b341' : '#4d6b56',
            },
          },
          y: SCALE_CONFIG.y,
        },
      },
    });
  }, [data]);

  // ── Chart 2: Quarterly Time Series ─────────────────────────────────────────
  const buildChart2 = useCallback(() => {
    const Chart = ChartRef.current;
    if (!Chart || !c2.current) return;
    destroy(inst2);

    const { quarterly } = data.data;
    const allQKeys = Array.from(
      new Set([
        ...Object.keys(quarterly.golf),
        ...Object.keys(quarterly.golfClubs),
        ...Object.keys(quarterly.golfEquipment),
        ...Object.keys(quarterly.golfSimulator),
      ])
    ).sort();

    const labels = allQKeys.map(fmtQuarterLabel);

    inst2.current = new Chart(c2.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Golf (broad)',
            data: allQKeys.map((k) => quarterly.golf[k] ?? null),
            borderColor: '#39d353',
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 2,
            tension: 0.3,
            spanGaps: false,
          },
          {
            label: 'Golf Clubs',
            data: allQKeys.map((k) => quarterly.golfClubs[k] ?? null),
            borderColor: '#e3b341',
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 2,
            tension: 0.3,
            spanGaps: false,
          },
          {
            label: 'Golf Equipment',
            data: allQKeys.map((k) => quarterly.golfEquipment[k] ?? null),
            borderColor: '#58a6ff',
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderDash: [3, 2],
            pointRadius: 1.5,
            tension: 0.3,
            spanGaps: false,
          },
          {
            label: 'Golf Simulator',
            data: allQKeys.map((k) => quarterly.golfSimulator[k] ?? null),
            borderColor: '#bc8cff',
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderDash: [5, 3],
            pointRadius: 1.5,
            tension: 0.3,
            spanGaps: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: TOOLTIP_CONFIG },
        scales: {
          x: {
            ...SCALE_CONFIG.x,
            ticks: { ...SCALE_CONFIG.x.ticks, maxRotation: 45, font: { family: "'IBM Plex Mono'", size: 9 } },
          },
          y: SCALE_CONFIG.y,
        },
      },
    });
  }, [data]);

  // ── Chart 3: Monthly Equipment (last 24 months) ─────────────────────────────
  const buildChart3 = useCallback(() => {
    const Chart = ChartRef.current;
    if (!Chart || !c3.current) return;
    destroy(inst3);

    const { monthly } = data.data;
    const { keys, values: clubsVals } = lastNMonths(monthly.golfClubs, 24);
    const ballsVals = keys.map((k) => monthly.golfBalls[k] ?? null);
    const bagsVals  = keys.map((k) => monthly.golfBags[k] ?? null);
    const labels    = keys.map(fmtMonthLabel);

    const clubPeakIdx = clubsVals.reduce((mi, v, i) => (v ?? 0) > (clubsVals[mi] ?? 0) ? i : mi, 0);
    const ballPeakIdx = ballsVals.reduce((mi, v, i) => (v ?? 0) > (ballsVals[mi] ?? 0) ? i : mi, 0);
    const bagsPeakIdx = bagsVals.reduce((mi, v, i) => (v ?? 0) > (bagsVals[mi] ?? 0) ? i : mi, 0);

    const clubsPointRadius = clubsVals.map((_, i) => i === clubPeakIdx ? 6 : 3);
    const ballsPointRadius = ballsVals.map((_, i) => i === ballPeakIdx ? 6 : 3);
    const bagsPointRadius  = bagsVals.map((_, i) => i === bagsPeakIdx ? 5 : 2);

    inst3.current = new Chart(c3.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Golf Clubs',
            data: clubsVals,
            borderColor: '#e3b341',
            backgroundColor: 'rgba(227,179,65,0.08)',
            fill: true,
            tension: 0.4,
            borderWidth: 2.5,
            pointRadius: clubsPointRadius,
            pointBackgroundColor: '#e3b341',
            spanGaps: false,
          },
          {
            label: 'Golf Balls',
            data: ballsVals,
            borderColor: '#39d353',
            backgroundColor: 'rgba(57,211,83,0.05)',
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: ballsPointRadius,
            pointBackgroundColor: '#39d353',
            spanGaps: false,
          },
          {
            label: 'Golf Bags',
            data: bagsVals,
            borderColor: '#58a6ff',
            backgroundColor: 'transparent',
            fill: false,
            borderDash: [4, 3],
            tension: 0.4,
            borderWidth: 1.5,
            pointRadius: bagsPointRadius,
            pointBackgroundColor: '#58a6ff',
            spanGaps: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            ...TOOLTIP_CONFIG,
            callbacks: {
              afterLabel: (ctx) => {
                const dsLabel = ctx.dataset.label ?? '';
                const idx = ctx.dataIndex;
                if (dsLabel === 'Golf Clubs' && idx === clubPeakIdx) return '▲ Peak month';
                if (dsLabel === 'Golf Balls' && idx === ballPeakIdx) return '▲ Peak month';
                if (dsLabel === 'Golf Bags'  && idx === bagsPeakIdx) return '▲ Nov spike';
                return '';
              },
            },
          },
        },
        scales: {
          x: { ...SCALE_CONFIG.x, ticks: { ...SCALE_CONFIG.x.ticks, maxRotation: 45 } },
          y: SCALE_CONFIG.y,
        },
      },
    });
  }, [data]);

  // ── Chart 4: Simulator vs Clubs ─────────────────────────────────────────────
  const buildChart4 = useCallback(() => {
    const Chart = ChartRef.current;
    if (!Chart || !c4.current) return;
    destroy(inst4);

    const { monthly } = data.data;
    const { keys, values: clubsVals } = lastNMonths(monthly.golfClubs, 24);
    const simVals = keys.map((k) => monthly.golfSimulator[k] ?? null);
    const labels  = keys.map(fmtMonthLabel);

    inst4.current = new Chart(c4.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Golf Clubs',
            data: clubsVals,
            borderColor: '#e3b341',
            backgroundColor: 'transparent',
            fill: false,
            tension: 0.4,
            borderWidth: 2.5,
            pointRadius: 2,
            spanGaps: false,
          },
          {
            label: 'Golf Simulator',
            data: simVals,
            borderColor: '#bc8cff',
            backgroundColor: 'transparent',
            fill: false,
            borderDash: [4, 2],
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 2,
            spanGaps: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: TOOLTIP_CONFIG },
        scales: {
          x: { ...SCALE_CONFIG.x, ticks: { ...SCALE_CONFIG.x.ticks, maxRotation: 45 } },
          y: { ...SCALE_CONFIG.y, max: 105 },
        },
      },
    });
  }, [data]);

  // ── Chart 6: YoY Delta ──────────────────────────────────────────────────────
  const buildChart6 = useCallback(() => {
    const Chart = ChartRef.current;
    if (!Chart || !c6.current) return;
    destroy(inst6);

    const { annual, monthly } = data.data;
    const clubs2026Jan = monthly.golfClubs['2026-01'] ?? null;
    const clubs2026Feb = monthly.golfClubs['2026-02'] ?? null;
    const { labels, values, isPartial } = yoyDeltas(
      annual.summerPeak as Record<string, number>,
      clubs2026Jan as number | null,
      clubs2026Feb as number | null
    );

    const colors = values.map((v, i) => {
      if (v === null) return 'transparent';
      if (isPartial[i]) return 'rgba(227,179,65,0.55)';
      return (v ?? 0) >= 0 ? '#26a641' : '#7d2025';
    });

    inst6.current = new Chart(c6.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'YoY Summer Peak Δ',
            data: values,
            backgroundColor: colors,
            borderRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            ...TOOLTIP_CONFIG,
            callbacks: {
              label: (ctx) => {
                const val = ctx.raw as number;
                const i = ctx.dataIndex;
                const sign = val >= 0 ? '+' : '';
                const suffix = isPartial[i] ? ' (Jan–Feb partial)' : ' (summer peak)';
                return `${sign}${val}${suffix}`;
              },
            },
          },
        },
        scales: {
          x: {
            ...SCALE_CONFIG.x,
            ticks: {
              ...SCALE_CONFIG.x.ticks,
              color: (ctx) => ctx.tick?.label?.includes('*') ? '#e3b341' : '#4d6b56',
            },
          },
          y: {
            ticks: { color: '#4d6b56', font: { family: "'IBM Plex Mono'", size: 10 } },
            grid:  { color: '#1c2e20' },
          },
        },
      },
    });
  }, [data]);

  // ── Chart 7: OEM Brand Quarterly ────────────────────────────────────────────
  const buildChart7 = useCallback(() => {
    const Chart = ChartRef.current;
    if (!Chart || !c7.current) return;
    destroy(inst7);

    const { quarterly } = data.data;

    // Union of all OEM quarter keys, sorted
    const allQKeys = Array.from(
      new Set([
        ...Object.keys(quarterly.callaway   ?? {}),
        ...Object.keys(quarterly.taylormade ?? {}),
        ...Object.keys(quarterly.titleist   ?? {}),
        ...Object.keys(quarterly.ping       ?? {}),
        ...Object.keys(quarterly.mizuno     ?? {}),
      ])
    ).sort();

    const labels = allQKeys.map(fmtQuarterLabel);

    // OEM color palette — distinct from the category chart colors
    const OEM_COLORS = {
      callaway:   { line: '#e3b341', dash: undefined },           // gold  — Callaway (largest)
      taylormade: { line: '#39d353', dash: undefined },           // green — TaylorMade
      titleist:   { line: '#58a6ff', dash: undefined },           // blue  — Titleist
      ping:       { line: '#f0883e', dash: [4, 2] as number[] },  // orange — Ping
      mizuno:     { line: '#bc8cff', dash: [6, 3] as number[] },  // purple — Mizuno
    };

    inst7.current = new Chart(c7.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Callaway Golf',
            data: allQKeys.map((k) => quarterly.callaway?.[k] ?? null),
            borderColor: OEM_COLORS.callaway.line,
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 2,
            tension: 0.3,
            spanGaps: false,
          },
          {
            label: 'TaylorMade Golf',
            data: allQKeys.map((k) => quarterly.taylormade?.[k] ?? null),
            borderColor: OEM_COLORS.taylormade.line,
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 2,
            tension: 0.3,
            spanGaps: false,
          },
          {
            label: 'Titleist',
            data: allQKeys.map((k) => quarterly.titleist?.[k] ?? null),
            borderColor: OEM_COLORS.titleist.line,
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 2,
            tension: 0.3,
            spanGaps: false,
          },
          {
            label: 'Ping',
            data: allQKeys.map((k) => quarterly.ping?.[k] ?? null),
            borderColor: OEM_COLORS.ping.line,
            backgroundColor: 'transparent',
            borderDash: OEM_COLORS.ping.dash,
            borderWidth: 1.5,
            pointRadius: 1.5,
            tension: 0.3,
            spanGaps: false,
          },
          {
            label: 'Mizuno',
            data: allQKeys.map((k) => quarterly.mizuno?.[k] ?? null),
            borderColor: OEM_COLORS.mizuno.line,
            backgroundColor: 'transparent',
            borderDash: OEM_COLORS.mizuno.dash,
            borderWidth: 1.5,
            pointRadius: 1.5,
            tension: 0.3,
            spanGaps: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            ...TOOLTIP_CONFIG,
            mode: 'index',
            intersect: false,
          },
        },
        scales: {
          x: {
            ...SCALE_CONFIG.x,
            ticks: {
              ...SCALE_CONFIG.x.ticks,
              maxRotation: 45,
              font: { family: "'IBM Plex Mono'", size: 9 },
            },
          },
          y: {
            ...SCALE_CONFIG.y,
            max: 105,
            ticks: {
              ...SCALE_CONFIG.y.ticks,
              stepSize: 10,
            },
          },
        },
        interaction: {
          mode: 'index',
          intersect: false,
        },
      },
    });
  }, [data]);

  // ── Build / rebuild all charts when data + Chart.js are ready ────────────────
  useEffect(() => {
    if (!chartJsReady) return;
    buildChart1();
    buildChart2();
    buildChart3();
    buildChart4();
    buildChart6();
    buildChart7();
    return () => {
      destroy(inst1); destroy(inst2); destroy(inst3);
      destroy(inst4); destroy(inst6); destroy(inst7);
    };
  }, [chartJsReady, buildChart1, buildChart2, buildChart3, buildChart4, buildChart6, buildChart7]);

  // ── Derived callout stats ───────────────────────────────────────────────────
  const { annual } = data.data;

  const prePandemicAvg = (() => {
    const vals = ['2017','2018','2019'].map((y) => annual.golfClubs[y]).filter(Boolean) as number[];
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  })();

  const pandemicPeak = annual.golfClubs['2021'] ?? null;

  const newNormalAvg = (() => {
    const vals = ['2022','2023','2024'].map((y) => annual.golfClubs[y]).filter(Boolean) as number[];
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  })();

  const delta = (newNormalAvg && prePandemicAvg)
    ? `+${newNormalAvg - prePandemicAvg} vs pre-pandemic avg`
    : null;

  // ── OEM callout stats — latest full year annual averages ─────────────────────
  const oemLatestYear = (() => {
    const candidates = ['2025', '2024', '2023'];
    for (const y of candidates) {
      if (annual.callaway?.[y]) return y;
    }
    return '2024';
  })();

  const oemStats = {
    callaway:   annual.callaway?.[oemLatestYear]   ?? null,
    taylormade: annual.taylormade?.[oemLatestYear] ?? null,
    titleist:   annual.titleist?.[oemLatestYear]   ?? null,
    ping:       annual.ping?.[oemLatestYear]        ?? null,
    mizuno:     annual.mizuno?.[oemLatestYear]      ?? null,
  };

  // Rank brands by latest annual avg for the callout labels
  const oemRanked = (Object.entries(oemStats) as [string, number | null][])
    .filter(([, v]) => v !== null)
    .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0));

  const oemDisplayName: Record<string, string> = {
    callaway: 'Callaway Golf',
    taylormade: 'TaylorMade Golf',
    titleist: 'Titleist',
    ping: 'Ping',
    mizuno: 'Mizuno',
  };

  const oemColor: Record<string, string> = {
    callaway: '#e3b341',
    taylormade: '#39d353',
    titleist: '#58a6ff',
    ping: '#f0883e',
    mizuno: '#bc8cff',
  };

  return (
    <main>
      <div className="container">
        {/* ── Masthead ─────────────────────────────────────────────────────── */}
        <header className="masthead">
          <div className="masthead-inner">
            <div className="masthead-content">
              <div className="tag-pill">Google Trends · US</div>
              <h1>
                Golf Search Volume /{' '}
                <strong>Time Series</strong>
              </h1>
              <p className="lede">
                Normalized search interest (0–100) for golf equipment and participation
                terms, tracked from 2017 through the present via Google Trends.
              </p>
              <div className="meta-row">
                <span>Source: Google Trends</span>
                <span>Geography: United States</span>
                <span>Compiled: {new Date().getFullYear()}</span>
                <span>Index: Relative (100 = peak)</span>
              </div>
            </div>
            <StaleIndicator
              lastUpdated={data.lastUpdated}
              stale={data.stale}
              source={data.source}
            />
          </div>
        </header>

        {/* ── 01: Long-Run Annual ──────────────────────────────────────────── */}
        <section className="section">
          <div className="section-label">01 — Long-Run Annual Trend</div>
          <ChartCard
            title="Golf Clubs · Annual Average vs Summer Peak"
            legend={[
              { color: '#39d353', label: 'Annual avg ≥75' },
              { color: '#26a641', label: '≥65' },
              { color: '#1a6b2e', label: '≥58' },
              { color: '#e3b341', label: 'Summer peak' },
            ]}
            footnote="Bar shading encodes magnitude. Summer peak = max of Jun/Jul/Aug. 2026* = Jan–Feb average only."
            below={
              <div style={{ padding: '0 24px 20px' }}>
                <div className="callouts">
                  <div className="callout">
                    <div className="callout-label">Pre-Pandemic Avg (2017–19)</div>
                    <div className="callout-value">{prePandemicAvg ?? '—'}</div>
                    <div className="callout-desc">Average annual index before COVID disruption</div>
                  </div>
                  <div className="callout hot">
                    <div className="callout-label">Pandemic Peak (2021)</div>
                    <div className="callout-value">{pandemicPeak ?? '—'}</div>
                    <div className="callout-desc">Highest annual average on record — outdoor activity surge</div>
                    {pandemicPeak && prePandemicAvg && (
                      <div className="callout-delta">+{pandemicPeak - prePandemicAvg} vs prior avg</div>
                    )}
                  </div>
                  <div className="callout">
                    <div className="callout-label">New Normal (2022–2024 avg)</div>
                    <div className="callout-value">{newNormalAvg ?? '—'}</div>
                    <div className="callout-desc">Rolling 3-year average post-pandemic normalization</div>
                    {delta && <div className="callout-delta">{delta}</div>}
                  </div>
                </div>
              </div>
            }
          >
            {chartJsReady ? (
              <canvas ref={c1} />
            ) : (
              <div className="chart-placeholder skeleton" />
            )}
          </ChartCard>
        </section>

        {/* ── 02: Quarterly ───────────────────────────────────────────────── */}
        <section className="section">
          <div className="section-label">02 — Quarterly Granularity</div>
          <ChartCard
            title="All Terms · Quarterly Average (2017–present)"
            legend={[
              { color: '#39d353', label: 'Golf (broad)' },
              { color: '#e3b341', label: 'Golf Clubs' },
              { color: '#58a6ff', label: 'Golf Equipment', dashed: true },
              { color: '#bc8cff', label: 'Golf Simulator', dashed: true },
            ]}
            footnote="Each quarter is the average of its 3 constituent monthly values. Quarters with any null month are omitted."
          >
            {chartJsReady ? (
              <canvas ref={c2} />
            ) : (
              <div className="chart-placeholder skeleton" />
            )}
          </ChartCard>
        </section>

        {/* ── 03: Monthly Equipment ───────────────────────────────────────── */}
        <section className="section">
          <div className="section-label">03 — Monthly Equipment Breakdown</div>
          <ChartCard
            title="Golf Clubs / Balls / Bags · Last 24 Months"
            legend={[
              { color: '#e3b341', label: 'Clubs' },
              { color: '#39d353', label: 'Balls' },
              { color: '#58a6ff', label: 'Bags', dashed: true },
            ]}
            footnote="Peak month marked with larger point radius. Bags exhibit a November gifting spike distinct from the summer equipment pattern."
          >
            {chartJsReady ? (
              <canvas ref={c3} />
            ) : (
              <div className="chart-placeholder skeleton" />
            )}
          </ChartCard>
        </section>

        {/* ── 04: Simulator vs Clubs ──────────────────────────────────────── */}
        <section className="section">
          <div className="section-label">04 — Inverse Seasonality: Simulator vs. Clubs</div>
          <ChartCard
            title="Golf Simulator vs. Golf Clubs · Last 24 Months"
            legend={[
              { color: '#e3b341', label: 'Golf Clubs' },
              { color: '#bc8cff', label: 'Golf Simulator', dashed: true },
            ]}
            footnote="Simulator interest peaks Nov–Feb when outdoor play declines. Clubs peak Jun–Aug. Two distinct consumer windows per year."
            below={
              <div style={{ padding: '0 24px 20px' }}>
                <div className="insights">
                  <div className="insight">
                    <div className="insight-title">Two Consumer Windows</div>
                    <div className="insight-body">
                      Golf clubs search peaks in summer (Jun–Aug) while simulator interest
                      peaks in winter (Nov–Feb), creating two distinct high-intent buying
                      windows per calendar year.
                    </div>
                  </div>
                  <div className="insight">
                    <div className="insight-title">Structural Off-Season Growth</div>
                    <div className="insight-body">
                      Simulator search has grown roughly 36% from 2019 to 2023 and has
                      stabilized at that elevated level — reflecting durable interest in
                      year-round indoor golf, not just a pandemic anomaly.
                    </div>
                  </div>
                  <div className="insight">
                    <div className="insight-title">TGL Launch Effect (Jan 2025)</div>
                    <div className="insight-body">
                      The Tiger Woods / Rory McIlroy TGL simulator league launched
                      January 2025, coinciding with a sustained lift in simulator search
                      during the typically high winter window.
                    </div>
                  </div>
                </div>
              </div>
            }
          >
            {chartJsReady ? (
              <canvas ref={c4} />
            ) : (
              <div className="chart-placeholder skeleton" />
            )}
          </ChartCard>
        </section>

        {/* ── 05: Heatmap ─────────────────────────────────────────────────── */}
        <section className="section">
          <div className="section-label">05 — Seasonal Heatmap · Golf Clubs</div>
          <ChartCard
            title="Golf Clubs · Monthly Index Heatmap (2017–present)"
            footnote="Color encodes search index intensity. 2026* row shows only completed months — future months appear as null (—) cells."
          >
            <Heatmap monthly={data.data.monthly.golfClubs} />
          </ChartCard>
        </section>

        {/* ── 06: YoY Delta ───────────────────────────────────────────────── */}
        <section className="section">
          <div className="section-label">06 — Year-over-Year Delta</div>
          <ChartCard
            title="Golf Clubs · YoY Summer Peak Change"
            legend={[
              { color: '#26a641', label: 'Positive YoY' },
              { color: '#7d2025', label: 'Negative YoY' },
              { color: 'rgba(227,179,65,0.55)', label: '2026* partial' },
            ]}
            footnote="YoY = current year summer peak minus prior year summer peak. 2026* uses Jan–Feb average as a partial proxy."
          >
            {chartJsReady ? (
              <canvas ref={c6} />
            ) : (
              <div className="chart-placeholder skeleton" />
            )}
          </ChartCard>
        </section>

        {/* ── 07: OEM Brand Comparison ────────────────────────────────────── */}
        <section className="section">
          <div className="section-label">07 — OEM Brand Search Volume</div>
          <ChartCard
            title="Top Golf OEMs · Quarterly Search Interest (2017–present)"
            legend={[
              { color: '#e3b341', label: 'Callaway' },
              { color: '#39d353', label: 'TaylorMade' },
              { color: '#58a6ff', label: 'Titleist' },
              { color: '#f0883e', label: 'Ping', dashed: true },
              { color: '#bc8cff', label: 'Mizuno', dashed: true },
            ]}
            footnote="Brand search terms: 'callaway golf', 'taylormade golf', 'titleist', 'ping golf', 'mizuno golf'. Each quarter averaged from 3 monthly values. Index is relative to each term's own peak within the same fetch window — cross-brand absolute comparisons indicate relative consumer search footprint, not sales rank. Tooltip shows all 5 brands simultaneously (hover mode: index)."
            below={
              <div style={{ padding: '0 24px 20px' }}>
                {/* Rank callout row */}
                <div className="oem-rank-row">
                  {oemRanked.map(([brand, val], rank) => (
                    <div key={brand} className="oem-rank-card">
                      <div className="oem-rank-badge" style={{ color: oemColor[brand] }}>
                        #{rank + 1}
                      </div>
                      <div
                        className="oem-rank-name"
                        style={{ color: oemColor[brand] }}
                      >
                        {oemDisplayName[brand]}
                      </div>
                      <div className="oem-rank-value">{val}</div>
                      <div className="oem-rank-label">{oemLatestYear} avg</div>
                    </div>
                  ))}
                </div>
                {/* Insight boxes */}
                <div className="insights" style={{ marginTop: '16px' }}>
                  <div className="insight">
                    <div className="insight-title">Pandemic Surge — All Brands Lifted</div>
                    <div className="insight-body">
                      The 2020–21 outdoor activity boom raised search interest across every
                      OEM, but Callaway and TaylorMade captured a disproportionate share —
                      both carry broad consumer product lines that attract casual buyers
                      entering the game for the first time.
                    </div>
                  </div>
                  <div className="insight">
                    <div className="insight-title">Titleist: Loyal but Narrow</div>
                    <div className="insight-body">
                      Titleist maintains a stable, premium-skewed search base driven largely
                      by Pro V1 ball loyalists. Its search curve is notably flatter across
                      seasons compared to equipment-heavy brands — ball buyers shop year-round.
                    </div>
                  </div>
                  <div className="insight">
                    <div className="insight-title">Ping &amp; Mizuno: Fitting-First Brands</div>
                    <div className="insight-body">
                      Ping and Mizuno command lower consumer search volumes but high
                      conversion intent — shoppers tend to search these brands later in the
                      purchase funnel after visiting a fitting studio, compressing their
                      search-to-purchase window.
                    </div>
                  </div>
                </div>
              </div>
            }
          >
            {chartJsReady ? (
              <canvas ref={c7} style={{ height: '320px' }} />
            ) : (
              <div className="chart-placeholder skeleton" style={{ height: '320px' }} />
            )}
          </ChartCard>
        </section>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer className="page-footer">
          <p className="footer-note">
            <strong>Methodology note:</strong>{' '}
            Google Trends reports normalized search interest on a 0–100 scale where 100 = peak
            interest for the selected time period and geography. Values are relative — not
            absolute search volume counts. The index for any two separate API calls is not
            directly comparable; all series in this dashboard are fetched under the same
            timeframe window to preserve comparability. Quarterly and annual values are derived
            by averaging constituent monthly values. Summer peak = maximum of June, July, August
            for each year. Data refreshes daily at 06:00 UTC. When live data is unavailable,
            the dashboard serves seed data estimated from published industry reports, confirmed
            by Accio.com&apos;s direct Google Trends export (key anchors:{' '}
            <strong>&quot;golf clubs&quot; Aug 2025 = 91, Feb 2025 = 29; &quot;golf balls&quot; Aug 2025 = 46</strong>).
            OEM brand terms fetched as: &quot;callaway golf&quot;, &quot;taylormade golf&quot;,
            &quot;titleist&quot;, &quot;ping golf&quot;, &quot;mizuno golf&quot;.
            Partial-year data (current calendar year) is labeled with an asterisk.
          </p>
        </footer>
      </div>
    </main>
  );
}
