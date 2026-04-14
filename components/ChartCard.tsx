'use client';

interface LegendItem {
  color: string;
  label: string;
  dashed?: boolean;
}

interface CsvData {
  filename: string;
  headers: string[];
  rows: (string | number | null)[][];
}

interface ChartCardProps {
  title: string;
  legend?: LegendItem[];
  footnote?: string;
  children: React.ReactNode;
  below?: React.ReactNode;
  csvData?: CsvData;
}

function downloadCsv(data: CsvData) {
  const csvContent = [
    data.headers.join(','),
    ...data.rows.map(row => 
      row.map(cell => {
        if (cell === null || cell === undefined) return '';
        if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${data.filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function ChartCard({ title, legend, footnote, children, below, csvData }: ChartCardProps) {
  return (
    <div className="chart-card">
      <div className="chart-header">
        <span className="chart-title">{title}</span>
        <div className="chart-header-right">
          {csvData && (
            <button
              className="csv-download-btn"
              onClick={() => downloadCsv(csvData)}
              title="Download CSV"
              aria-label="Download data as CSV"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>CSV</span>
            </button>
          )}
          {legend && legend.length > 0 && (
            <div className="chart-legend">
              {legend.map((item) => (
                <div key={item.label} className="legend-item">
                  {item.dashed ? (
                    <div
                      className="legend-line"
                      style={{
                        background: `repeating-linear-gradient(90deg, ${item.color} 0, ${item.color} 5px, transparent 5px, transparent 9px)`,
                      }}
                    />
                  ) : (
                    <div className="legend-dot" style={{ background: item.color }} />
                  )}
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="chart-body">{children}</div>
      {below}
      {footnote && (
        <div className="chart-footer">
          <p className="chart-footnote">{footnote}</p>
        </div>
      )}
    </div>
  );
}
