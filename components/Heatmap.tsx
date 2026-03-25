'use client';

import { useEffect, useState } from 'react';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function useDarkMode() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return dark;
}

function cellStyle(value: number | null | undefined, dark: boolean): { bg: string; color: string } {
  if (value === null || value === undefined) {
    return dark
      ? { bg: '#1e293b', color: '#475569' }
      : { bg: '#f1f5f9', color: '#94a3b8' };
  }
  if (dark) {
    if (value >= 90) return { bg: '#2563eb', color: '#eff6ff' };
    if (value >= 80) return { bg: '#1d4ed8', color: '#eff6ff' };
    if (value >= 70) return { bg: '#1e40af', color: '#dbeafe' };
    if (value >= 60) return { bg: '#1e3a8a', color: '#bfdbfe' };
    if (value >= 50) return { bg: '#172554', color: '#93c5fd' };
    if (value >= 40) return { bg: '#1e293b', color: '#60a5fa' };
    if (value >= 30) return { bg: '#0f172a', color: '#3b82f6' };
    return { bg: '#0c0f1a', color: '#1d4ed8' };
  }
  // light mode
  if (value >= 90) return { bg: '#2563eb', color: '#ffffff' };
  if (value >= 80) return { bg: '#3b82f6', color: '#ffffff' };
  if (value >= 70) return { bg: '#60a5fa', color: '#1e3a8a' };
  if (value >= 60) return { bg: '#93c5fd', color: '#1e3a8a' };
  if (value >= 50) return { bg: '#bfdbfe', color: '#1e40af' };
  if (value >= 40) return { bg: '#dbeafe', color: '#1e40af' };
  if (value >= 30) return { bg: '#eff6ff', color: '#3b82f6' };
  return { bg: '#f8fafc', color: '#93c5fd' };
}

interface HeatmapProps {
  monthly: Record<string, number | null>;
}

export default function Heatmap({ monthly }: HeatmapProps) {
  const dark = useDarkMode();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  const years: number[] = [];
  for (let y = 2017; y <= currentYear; y++) years.push(y);

  return (
    <div className="heatmap">
      <div className="heatmap-grid">
        {/* Header row */}
        <div className="heatmap-month-label" />
        {MONTHS.map((m) => (
          <div key={m} className="heatmap-month-label">{m}</div>
        ))}

        {/* Data rows */}
        {years.map((year) => {
          const isCurrent = year === currentYear;
          return (
            <div key={year} style={{ display: 'contents' }}>
              <div className={`heatmap-year-label${isCurrent ? ' current' : ''}`}>
                {isCurrent ? `${year}*` : year}
              </div>
              {MONTHS.map((_, mi) => {
                const key = `${year}-${String(mi + 1).padStart(2, '0')}`;
                const isFuture = isCurrent && mi > currentMonth;
                const value = isFuture ? null : (monthly[key] ?? null);
                const isNull = value === null;
                const { bg, color } = cellStyle(value, dark);

                return (
                  <div
                    key={key}
                    className={`heatmap-cell${isNull ? ' null-cell' : ''}`}
                    style={{ background: bg, color }}
                    title={isNull ? key : `${key}: ${value}`}
                  >
                    {isNull ? '—' : value}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
