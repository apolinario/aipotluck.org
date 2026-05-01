import { useState, useMemo } from 'react';
import { ecoClusters, repoPosition, clusterCentroid } from '../data/ecoClusters.js';
import ecosystemDawn from '../assets/ecosystem-dawn.png';
import ecosystemDusk from '../assets/ecosystem-dusk.png';

export function EcosystemSection({ mode }) {
  const [hovCluster, setHovCluster] = useState(null);
  const [hovRepo, setHovRepo] = useState(null);
  const [focusId, setFocusId] = useState('overview');

  const bgSrc = mode === 'dawn' ? ecosystemDawn : ecosystemDusk;
  const objectPosition = mode === 'dawn' ? 'center 52%' : '32% 52%';

  const filterIds = useMemo(() => (focusId === 'overview' ? null : [focusId]), [focusId]);

  const isClusterEmphasized = (clusterId) => {
    if (!filterIds) return true;
    if (hovCluster === clusterId) return true;
    return filterIds.includes(clusterId);
  };

  const hubEdges = useMemo(() => {
    if (!filterIds || filterIds.length < 2) return [];
    const clusters = ecoClusters.filter((c) => filterIds.includes(c.id));
    const edges = [];
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const a = clusterCentroid(clusters[i]);
        const b = clusterCentroid(clusters[j]);
        edges.push({ key: `${clusters[i].id}-${clusters[j].id}`, x1: a.cx, y1: a.cy, x2: b.cx, y2: b.cy });
      }
    }
    return edges;
  }, [filterIds]);

  const totalRepos = ecoClusters.reduce((a, c) => a + c.repos.length, 0);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        position: 'relative',
        overflow: 'hidden',
        background: '#050811',
        display: 'flex',
        flexDirection: 'column',
      }}
      data-screen-label="01 Ecosystem"
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          overflow: 'hidden',
          background: '#050811',
        }}
        aria-hidden="true"
      >
        <img
          src={bgSrc}
          alt=""
          decoding="async"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'radial-gradient(ellipse 92% 88% at 50% 48%, transparent 25%, rgba(5,8,17,.42) 100%)',
          }}
        />
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 10,
          padding: '18px 24px 8px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
        }}
      >
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.25)' }}>
          Open source AI ecosystem
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1, flex: 1, minHeight: 0, width: '100%' }}>
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} aria-hidden="true">
          {hubEdges.map((e) => (
            <line
              key={e.key}
              x1={`${e.x1}%`}
              y1={`${e.y1}%`}
              x2={`${e.x2}%`}
              y2={`${e.y2}%`}
              stroke="rgba(255,255,255,.22)"
              strokeWidth="1.2"
              strokeDasharray="4 5"
              opacity={0.85}
              style={{ transition: 'opacity 280ms ease' }}
            />
          ))}
          {ecoClusters.map((cluster) => {
            const { cx, cy } = clusterCentroid(cluster);
            const em = isClusterEmphasized(cluster.id);
            const isHov = hovCluster === cluster.id;
            return cluster.repos.map((repo, ri) => {
              const pos = repoPosition(cluster, repo);
              const spokeOp = filterIds ? (em ? (isHov ? 0.32 : 0.24) : 0.04) : isHov ? 0.2 : 0.09;
              return (
                <line
                  key={`${cluster.id}-${ri}`}
                  x1={`${cx}%`}
                  y1={`${cy}%`}
                  x2={`${pos.x}%`}
                  y2={`${pos.y}%`}
                  stroke={cluster.color}
                  strokeWidth=".9"
                  opacity={spokeOp}
                  style={{ transition: 'opacity 220ms ease' }}
                />
              );
            });
          })}
        </svg>

        {ecoClusters.flatMap((cluster) => {
          const em = isClusterEmphasized(cluster.id);
          const isHovC = hovCluster === cluster.id;
          return cluster.repos.map((repo, ri) => {
            const pos = repoPosition(cluster, repo);
            const rk = `${cluster.id}-${ri}`;
            const isHovR = hovRepo === rk;
            const dotOp = filterIds ? (em ? (isHovR ? 1 : 0.92) : 0.14) : isHovC || isHovR ? 0.95 : 0.52;
            return (
              <div
                key={rk}
                onMouseEnter={() => {
                  setHovCluster(cluster.id);
                  setHovRepo(rk);
                }}
                onMouseLeave={() => {
                  setHovCluster(null);
                  setHovRepo(null);
                }}
                style={{
                  position: 'absolute',
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  transform: 'translate(-50%,-50%)',
                  zIndex: isHovR ? 9 : em ? 5 : 3,
                  cursor: 'default',
                  animation: `dot-emerge 400ms ${ri * 35}ms cubic-bezier(.16,1,.3,1) both`,
                  opacity: filterIds && !em ? 0.35 : 1,
                  transition: 'opacity 220ms ease',
                }}
              >
                <div
                  style={{
                    width: isHovR ? 12 : em ? 8 : 6,
                    height: isHovR ? 12 : em ? 8 : 6,
                    borderRadius: '50%',
                    background: cluster.color,
                    opacity: dotOp,
                    boxShadow: isHovR ? `0 0 14px ${cluster.color}` : em ? `0 0 7px ${cluster.color}70` : 'none',
                    transition: 'all 200ms ease',
                  }}
                />
                {isHovR && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '140%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'rgba(8,12,24,.96)',
                      border: '1px solid rgba(255,255,255,.1)',
                      borderRadius: 5,
                      padding: '5px 10px',
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 9,
                      color: 'rgba(255,255,255,.75)',
                      whiteSpace: 'nowrap',
                      zIndex: 20,
                      boxShadow: '0 4px 16px rgba(0,0,0,.5)',
                      letterSpacing: '.04em',
                    }}
                  >
                    {repo.name}
                  </div>
                )}
              </div>
            );
          });
        })}
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 10,
          flexShrink: 0,
          padding: '12px 20px 18px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 460,
            background: 'rgba(6,10,20,.72)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,.1)',
            borderRadius: 8,
            padding: '12px 14px 14px',
            boxShadow: '0 6px 28px rgba(0,0,0,.35)',
          }}
        >
          <label
            htmlFor="ecosystem-query"
            style={{
              display: 'block',
              fontFamily: "'DM Mono', monospace",
              fontSize: 8,
              letterSpacing: '.16em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,.38)',
              marginBottom: 8,
            }}
          >
            Product focus
          </label>
          <select
            id="ecosystem-query"
            value={focusId}
            onChange={(e) => setFocusId(e.target.value)}
            style={{
              width: '100%',
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: 13,
              fontWeight: 500,
              color: 'rgba(255,255,255,.9)',
              background: 'rgba(0,0,0,.35)',
              border: '1px solid rgba(255,255,255,.14)',
              borderRadius: 6,
              padding: '10px 12px',
              outline: 'none',
              cursor: 'pointer',
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.45)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 12px center',
              paddingRight: 36,
            }}
          >
            <option value="overview" style={{ color: '#0B1E2D', background: '#F5F2EE' }}>
              Overview — all layers
            </option>
            {ecoClusters.map((c) => (
              <option key={c.id} value={c.id} style={{ color: '#0B1E2D', background: '#F5F2EE' }}>
                {c.label}
              </option>
            ))}
          </select>

          <div
            style={{
              marginTop: 10,
              fontFamily: "'DM Mono', monospace",
              fontSize: 8,
              color: 'rgba(255,255,255,.22)',
              letterSpacing: '.06em',
              lineHeight: 1.4,
            }}
          >
            {totalRepos} repos · {ecoClusters.length} clusters
            {filterIds && (
              <span style={{ display: 'block', marginTop: 4, color: 'rgba(255,255,255,.32)' }}>
                Showing one layer focus on the map
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
