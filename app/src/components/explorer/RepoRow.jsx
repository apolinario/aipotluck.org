import { Sparkline } from './Sparkline.jsx';
import { HealthBadge } from './HealthBadge.jsx';
import { formatStars, formatCount } from '../../utils/format.js';

const GRID = '3fr 1fr 1.4fr 1fr 1fr 40px';

const cellStyle = {
  padding: '0 12px',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 13,
  color: 'rgba(255,255,255,.7)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const monoStyle = {
  ...cellStyle,
  fontFamily: "'DM Mono', monospace",
  fontSize: 12,
};

export { GRID };

export function RepoRow({ repo, sparkline, healthScore, onClick, style }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: GRID,
        alignItems: 'center',
        height: 44,
        borderBottom: '1px solid rgba(255,255,255,.04)',
        cursor: 'pointer',
        transition: 'background 120ms ease',
        ...style,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.04)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ ...cellStyle, fontWeight: 500, color: 'rgba(255,255,255,.88)' }}>
        {repo.repo.includes('/') ? (
          <>
            <span style={{ color: 'rgba(255,255,255,.3)', fontWeight: 400, fontSize: 12 }}>{repo.repo.split('/')[0]}/</span>
            {repo.repo.split('/')[1]}
          </>
        ) : repo.repo}
        {repo.subcategory && (
          <span style={{ marginLeft: 8, fontSize: 11, color: 'rgba(255,255,255,.25)' }}>
            {repo.subcategory}
          </span>
        )}
      </div>
      <div style={{ ...monoStyle, textAlign: 'right' }}>{formatStars(repo.stars)}</div>
      <div style={{ padding: '0 8px' }}>
        <Sparkline data={sparkline?.stars} width={84} height={24} color="#1b9e8a" />
      </div>
      <div style={{ ...monoStyle, textAlign: 'right' }}>{formatCount(repo.total_contributors)}</div>
      <div style={{ ...cellStyle, fontSize: 12, color: 'rgba(255,255,255,.45)' }}>
        {repo.country || '—'}
      </div>
      <div style={{ padding: '0 8px', display: 'flex', justifyContent: 'center' }}>
        {healthScore != null && <HealthBadge score={healthScore} />}
      </div>
    </div>
  );
}
