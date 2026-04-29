import { Sparkline } from './Sparkline.jsx';
import { HealthBadge } from './HealthBadge.jsx';
import { formatStars, formatCount } from '../../utils/format.js';

const cellStyle = {
  padding: '0 8px',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 12,
  color: 'rgba(255,255,255,.75)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const monoStyle = {
  ...cellStyle,
  fontFamily: "'DM Mono', monospace",
  fontSize: 11,
};

export function RepoRow({ repo, sparkline, packageCount, modelCount, healthScore, onClick, style }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '1.8fr 0.8fr 0.8fr 65px 90px 75px 90px 70px 50px 50px 32px',
        alignItems: 'center',
        height: 40,
        borderBottom: '1px solid rgba(255,255,255,.04)',
        cursor: 'pointer',
        transition: 'background 120ms ease',
        ...style,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.04)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ ...cellStyle, fontWeight: 500, color: 'rgba(255,255,255,.9)' }}>
        {repo.repo.includes('/') ? (
          <>
            <span style={{ color: 'rgba(255,255,255,.4)', fontWeight: 400 }}>{repo.repo.split('/')[0]}/</span>
            {repo.repo.split('/')[1]}
          </>
        ) : repo.repo}
      </div>
      <div style={cellStyle}>{repo.category || '—'}</div>
      <div style={cellStyle}>{repo.subcategory || '—'}</div>
      <div style={monoStyle}>{formatStars(repo.stars)}</div>
      <div style={{ padding: '0 4px' }}>
        <Sparkline data={sparkline?.stars} width={80} height={20} color="#1b9e8a" />
      </div>
      <div style={monoStyle}>{formatCount(repo.total_contributors)}</div>
      <div style={monoStyle}>{repo.license || '—'}</div>
      <div style={cellStyle}>{repo.country || '—'}</div>
      <div style={monoStyle}>{packageCount > 0 ? packageCount : '—'}</div>
      <div style={monoStyle}>{modelCount > 0 ? modelCount : '—'}</div>
      <div style={{ padding: '0 8px', display: 'flex', justifyContent: 'center' }}>
        {healthScore != null && <HealthBadge score={healthScore} />}
      </div>
    </div>
  );
}
