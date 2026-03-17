'use client';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function cellStyle(value: number | null | undefined): { bg: string; color: string } {
  if (value === null || value === undefined) return { bg: '#0d1810', color: '#1c2e20' };
  if (value >= 90) return { bg: '#39d353', color: '#080e0a' };
  if (value >= 80) return { bg: '#26a641', color: '#080e0a' };
  if (value >= 70) return { bg: '#1a6b2e', color: '#cae8d0' };
  if (value >= 60) return { bg: '#154d22', color: '#cae8d0' };
  if (value >= 50) return { bg: '#0f3318', color: '#cae8d0' };
  if (value >= 40) return { bg: '#0d2614', color: '#6b8f7a' };
  if (value >= 30) return { bg: '#0a1c10', color: '#4d6b56' };
  return { bg: '#080e0a', color: '#2a3f2d' };
}

interface HeatmapProps {
  monthly: Record<string, number | null>;
}

export default function Heatmap({ monthly }: HeatmapProps) {
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
                const { bg, color } = cellStyle(value);

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
