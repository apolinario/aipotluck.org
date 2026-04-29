import { Sparkline } from './Sparkline.jsx';
import { HealthBadge } from './HealthBadge.jsx';
import { formatStars, formatCount } from '../../utils/format.js';

const GRID = '2fr 1.2fr 72px 100px 80px 72px 36px';

const cellStyle = {
  padding: '0 10px',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 12.5,
  color: 'rgba(255,255,255,.7)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const monoStyle = {
  ...cellStyle,
  fontFamily: "'DM Mono', monospace",
  fontSize: 11.5,
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
        height: 42,
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
            <span style={{ color: 'rgba(255,255,255,.35)', fontWeight: 400 }}>{repo.repo.split('/')[0]}/</span>
            {repo.repo.split('/')[1]}
          </>
        ) : repo.repo}
      </div>
      <div style={{ ...cellStyle, fontSize: 11.5, color: 'rgba(255,255,255,.5)' }}>
        {repo.subcategory || repo.category || '—'}
      </div>
      <div style={monoStyle}>{formatStars(repo.stars)}</div>
      <div style={{ padding: '0 6px' }}>
        <Sparkline data={sparkline?.stars} width={88} height={22} color="#1b9e8a" />
      </div>
      <div style={monoStyle}>{formatCount(repo.total_contributors)}</div>
      <div style={{ ...cellStyle, fontSize: 11.5, color: 'rgba(255,255,255,.5)' }}>
        {repo.country || '—'}
      </div>
      <div style={{ padding: '0 10px', display: 'flex', justifyContent: 'center' }}>
        {healthScore != null && <HealthBadge score={healthScore} />}
      </div>
    </div>
  );
}
