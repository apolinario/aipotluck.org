import { useEffect, useCallback } from 'react';
import { Sparkline } from './Sparkline.jsx';
import { HealthBadge } from './HealthBadge.jsx';
import { PackageList, ModelList } from './ArtifactList.jsx';
import { formatStars, formatCount } from '../../utils/format.js';
import { healthColor } from '../../utils/health.js';

function SectionHeader({ children }) {
  return (
    <div style={{
      fontFamily: "'DM Mono', monospace",
      fontSize: 10,
      letterSpacing: '.08em',
      textTransform: 'uppercase',
      color: 'rgba(255,255,255,.3)',
      marginTop: 24,
      marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 18, fontWeight: 500, color: '#fff' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', marginTop: 2, letterSpacing: '.04em' }}>{label}</div>
    </div>
  );
}

export function DetailDrawer({ repo, project, taxonomy, packages, models, sparkline, adjacentProjects, onClose, onNavigate }) {
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!repo) return null;

  const displayName = project?.display_name || repo.repo;
  const gapScore = taxonomy?.[0]?.gap_score;
  const healthScore = gapScore != null ? Math.round((gapScore / 5) * 100) : null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(2,5,8,.65)',
          backdropFilter: 'blur(2px)',
          zIndex: 80,
        }}
      />

      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 'min(600px, 92vw)',
        background: 'rgba(10,12,18,.97)',
        backdropFilter: 'blur(20px)',
        borderLeft: '1px solid rgba(255,255,255,.08)',
        zIndex: 90,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-24px 0 60px -30px rgba(0,0,0,.6)',
      }}>
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid rgba(255,255,255,.06)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <div>
            {taxonomy?.length > 0 && (
              <div style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,.3)',
                marginBottom: 6,
              }}>
                {taxonomy[0].osai_layer} · {taxonomy[0].osai_subcategory}
              </div>
            )}
            <div style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 28,
              fontWeight: 300,
              color: '#fff',
              lineHeight: 1.1,
            }}>
              {displayName}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
              {repo.repo.includes('/') && (
                <span style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 11,
                  color: 'rgba(255,255,255,.45)',
                }}>
                  {repo.repo.split('/')[0]}
                </span>
              )}
              {repo.country && (
                <span style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 11,
                  color: 'rgba(255,255,255,.45)',
                }}>
                  {repo.country}
                </span>
              )}
              {repo.language && (
                <span style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 11,
                  color: 'rgba(255,255,255,.45)',
                }}>
                  {repo.language}
                </span>
              )}
              {repo.license && (
                <span style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 11,
                  padding: '1px 6px',
                  border: '1px solid rgba(255,255,255,.12)',
                  borderRadius: 3,
                  color: 'rgba(255,255,255,.45)',
                }}>
                  {repo.license}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,.06)',
              border: '1px solid rgba(255,255,255,.10)',
              borderRadius: '50%',
              width: 30,
              height: 30,
              color: 'rgba(255,255,255,.5)',
              cursor: 'pointer',
              fontSize: 14,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        <div className="drawer-body" style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px', scrollbarWidth: 'thin' }}>
          {healthScore != null && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 16px',
              marginTop: 16,
              background: 'rgba(255,255,255,.03)',
              border: '1px solid rgba(255,255,255,.06)',
              borderRadius: 10,
            }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: `conic-gradient(${healthColor(healthScore)} ${healthScore * 3.6}deg, rgba(255,255,255,.06) 0)`,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}>
                <span style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'rgba(10,12,18,.97)',
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 14,
                  fontWeight: 500,
                  color: '#fff',
                }}>
                  {healthScore}
                </span>
              </div>
              <div>
                <HealthBadge score={healthScore} showLabel />
                {taxonomy?.[0]?.parity_verdict && (
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginTop: 2 }}>
                    {taxonomy[0].parity_verdict}
                  </div>
                )}
              </div>
            </div>
          )}

          {project && (
            <>
              <SectionHeader>Overview</SectionHeader>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 12,
                padding: '12px 0',
              }}>
                <StatBox label="Stars" value={formatStars(project.total_stars)} />
                <StatBox label="Contributors (28d)" value={formatCount(project.contributors_28d)} />
                <StatBox label="Full-time (28d)" value={formatCount(project.full_time_28d)} />
                <StatBox label="Repos" value={project.repo_count} />
                <StatBox label="Packages" value={project.package_count || '—'} />
                <StatBox label="Models" value={project.model_count || '—'} />
              </div>
            </>
          )}

          {sparkline && (
            <>
              <SectionHeader>Activity (90 days)</SectionHeader>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 12,
              }}>
                {[
                  { key: 'stars', label: 'Stars', color: '#1b9e8a' },
                  { key: 'forks', label: 'Forks', color: '#d9952a' },
                  { key: 'contributors', label: 'Contributors', color: '#E8796A' },
                ].map(({ key, label, color }) => (
                  <div key={key}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', marginBottom: 4, letterSpacing: '.04em' }}>{label}</div>
                    <Sparkline data={sparkline[key]} width={160} height={40} color={color} filled />
                  </div>
                ))}
              </div>
            </>
          )}

          {packages?.length > 0 && (
            <>
              <SectionHeader>Packages · {packages.length}</SectionHeader>
              <PackageList packages={packages} />
            </>
          )}

          {models?.length > 0 && (
            <>
              <SectionHeader>Models · {models.length}</SectionHeader>
              <ModelList models={models} />
            </>
          )}

          {project && (project.direct_dependents > 0 || project.max_fragility_score > 0) && (
            <>
              <SectionHeader>Dependencies</SectionHeader>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 12,
                padding: '12px 0',
              }}>
                <StatBox label="Direct dependents" value={formatCount(project.direct_dependents)} />
                <StatBox label="Total dependents" value={formatCount(project.total_dependents)} />
                <StatBox label="Fragility" value={project.max_fragility_score?.toFixed(2) || '—'} />
              </div>
            </>
          )}

          {taxonomy?.length > 1 && (
            <>
              <SectionHeader>Taxonomy placements · {taxonomy.length}</SectionHeader>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {taxonomy.map((t, i) => (
                  <span key={i} style={{
                    fontSize: 11,
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,.04)',
                    border: '1px solid rgba(255,255,255,.08)',
                    color: 'rgba(255,255,255,.6)',
                  }}>
                    {t.osai_layer} → {t.osai_subcategory}
                  </span>
                ))}
              </div>
            </>
          )}

          {adjacentProjects?.length > 0 && (
            <>
              <SectionHeader>Related projects</SectionHeader>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {adjacentProjects.map((p) => (
                  <button
                    key={p.project_slug}
                    onClick={() => onNavigate(p)}
                    style={{
                      fontSize: 11,
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: 'rgba(255,255,255,.04)',
                      border: '1px solid rgba(255,255,255,.10)',
                      color: 'rgba(255,255,255,.7)',
                      cursor: 'pointer',
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {p.display_name || p.project_slug} · {formatStars(p.total_stars)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
