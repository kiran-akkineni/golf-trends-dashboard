'use client';

interface StaleIndicatorProps {
  lastUpdated: string | null;
  stale: boolean;
  source: 'live' | 'seed';
}

export default function StaleIndicator({ lastUpdated, stale, source }: StaleIndicatorProps) {
  const formattedDate = lastUpdated
    ? new Date(lastUpdated).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
      })
    : null;

  return (
    <div className={`stale-indicator ${stale ? 'is-stale' : ''}`}>
      {stale ? (
        <>
          <div className="stale-warning">
            <span>⚠</span>
            <span>{source === 'seed' ? 'Using seed data' : 'Cached data'}</span>
          </div>
          {formattedDate && <div>As of: {formattedDate}</div>}
        </>
      ) : (
        <>
          {formattedDate && <div>Updated: {formattedDate}</div>}
          <div style={{ color: 'var(--dim)' }}>Refreshes daily 06:00 UTC</div>
        </>
      )}
    </div>
  );
}
