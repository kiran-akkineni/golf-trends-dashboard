interface LegendItem {
  color: string;
  label: string;
  dashed?: boolean;
}

interface ChartCardProps {
  title: string;
  legend?: LegendItem[];
  footnote?: string;
  children: React.ReactNode;
  below?: React.ReactNode;
  onDownload?: () => void;
}

export default function ChartCard({ title, legend, footnote, children, below, onDownload }: ChartCardProps) {
  return (
    <div className="chart-card">
      <div className="chart-header">
        <span className="chart-title">{title}</span>
        <div className="chart-header-right">
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
          {onDownload && (
            <button
              className="download-btn"
              onClick={onDownload}
              title="Download CSV"
              aria-label="Download chart data as CSV"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 1v7M3.5 5.5L6 8l2.5-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M1.5 10h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              CSV
            </button>
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
