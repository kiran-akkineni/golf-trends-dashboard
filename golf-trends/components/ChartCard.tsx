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
}

export default function ChartCard({ title, legend, footnote, children, below }: ChartCardProps) {
  return (
    <div className="chart-card">
      <div className="chart-header">
        <span className="chart-title">{title}</span>
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
