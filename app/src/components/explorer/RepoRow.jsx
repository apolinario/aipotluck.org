import { Sparkline } from './Sparkline.jsx';
import { HealthBadge } from './HealthBadge.jsx';
import { formatStars, formatCount } from '../../utils/format.js';

export const TABLE_COLS = '40% 12% 16% 12% 12% 8%';

export function RepoRow({ repo, sparkline, healthScore, onClick, style }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: TABLE_COLS,
        alignItems: 'center',
        height: 48,
        padding: '0 20px',
        borderBottom: '1px solid rgba(255,255,255,.05)',
        cursor: 'pointer',
        transition: 'background 100ms',
        ...style,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.04)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Repository */}
      <div style={{
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        paddingRight: 16,
      }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,.88)' }}>
          {repo.repo.includes('/') && (
            <span style={{ color: 'rgba(255,255,255,.3)', fontWeight: 400 }}>
              {repo.repo.split('/')[0]}/
            </span>
          )}
          {repo.repo.split('/').pop()}
        </span>
        {repo.subcategory && (
          <span style={{
            display: 'inline-block',
            marginLeft: 8,
            fontSize: 10,
            padding: '1px 6px',
            borderRadius: 3,
            background: 'rgba(255,255,255,.06)',
            color: 'rgba(255,255,255,.35)',
            verticalAlign: 'middle',
          }}>
            {repo.subcategory}
          </span>
        )}
      </div>

      {/* Stars */}
      <div style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: 12,
        color: 'rgba(255,255,255,.65)',
        textAlign: 'right',
        paddingRight: 16,
      }}>
        {formatStars(repo.stars)}
      </div>

      {/* Sparkline */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Sparkline data={sparkline?.stars} width={100} height={26} color="#1b9e8a" />
      </div>

      {/* Contributors */}
      <div style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: 12,
        color: 'rgba(255,255,255,.55)',
        textAlign: 'right',
        paddingRight: 16,
      }}>
        {formatCount(repo.total_contributors)}
      </div>

      {/* Country */}
      <div style={{
        fontSize: 12,
        color: 'rgba(255,255,255,.4)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {repo.country || ''}
      </div>

      {/* Health */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {healthScore != null ? <HealthBadge score={healthScore} /> : null}
      </div>
    </div>
  );
}
