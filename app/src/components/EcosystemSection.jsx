import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ecoClusters } from '../data/ecoClusters.js';
import { productSpecs } from '../data/productSpecs.js';
import { buildStackLayout, galaxyRepoPosition, galaxyClusterCentroid } from '../data/ecosystemLayout.js';
import ecosystemDawn from '../assets/ecosystem-dawn.png';
import ecosystemDusk from '../assets/ecosystem-dusk.png';

export function EcosystemSection({ mode }) {
  const navigate = useNavigate();
  /** stack: layer (Y) × category criteria avg (X), star-sized dots; galaxy: spiral hub layout */
  const [layoutMode, setLayoutMode] = useState('stack');
  const [hovCluster, setHovCluster] = useState(null);
  const [hovRepo, setHovRepo] = useState(null);
  const [focusId, setFocusId] = useState('overview');

  const goToCategoryExplorer = useCallback(
    (categoryId) => {
      const q = new URLSearchParams({ open: 'category', category: categoryId });
      navigate(`/app?${q.toString()}`);
    },
    [navigate],
  );

  const bgSrc = mode === 'dawn' ? ecosystemDawn : ecosystemDusk;
  const objectPosition = mode === 'dawn' ? 'center 52%' : '32% 52%';

  const focusSpec = useMemo(
    () => (focusId === 'overview' ? null : productSpecs.find((p) => p.slug === focusId) ?? null),
    [focusId],
  );

  const focusRepoSet = useMemo(() => {
    if (!focusSpec) return null;
    return new Set(focusSpec.repoProductIds);
  }, [focusSpec]);

  const focusClusterIds = useMemo(() => {
    if (!focusRepoSet) return null;
    const s = new Set();
    for (const c of ecoClusters) {
      if (c.repos.some((r) => focusRepoSet.has(r.productId))) s.add(c.id);
    }
    return s;
  }, [focusRepoSet]);

  const mapLayout = useMemo(() => {
    if (layoutMode === 'galaxy') {
      return ecoClusters.map((cluster) => ({
        cluster,
        centroid: galaxyClusterCentroid(cluster),
        items: cluster.repos.map((repo) => ({
          repo,
          x: galaxyRepoPosition(cluster, repo).x,
          y: galaxyRepoPosition(cluster, repo).y,
          starMul: 1,
        })),
      }));
    }
    return buildStackLayout(ecoClusters).map(({ cluster, centroid, reposLayout }) => ({
      cluster,
      centroid,
      items: reposLayout.map((rl) => ({
        repo: rl.repo,
        x: rl.x,
        y: rl.y,
        starMul: rl.starMul,
      })),
    }));
  }, [layoutMode]);

  const isClusterEmphasized = (clusterId) => {
    if (focusClusterIds == null) return true;
    if (hovCluster === clusterId) return true;
    return focusClusterIds.has(clusterId);
  };

  const hubEdges = useMemo(() => {
    if (!focusClusterIds || focusClusterIds.size < 2) return [];
    const centroids = {};
    for (const row of mapLayout) {
      if (focusClusterIds.has(row.cluster.id)) centroids[row.cluster.id] = row.centroid;
    }
    const ids = [...focusClusterIds].filter((id) => centroids[id]);
    const edges = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = centroids[ids[i]];
        const b = centroids[ids[j]];
        edges.push({ key: `${ids[i]}-${ids[j]}`, x1: a.cx, y1: a.cy, x2: b.cx, y2: b.cy });
      }
    }
    return edges;
  }, [focusClusterIds, mapLayout]);

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
        {layoutMode === 'stack' && (
          <div
            style={{
              position: 'absolute',
              left: '14%',
              right: '14%',
              bottom: 8,
              zIndex: 4,
              pointerEvents: 'none',
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: "'DM Mono', monospace",
              fontSize: 8,
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,.28)',
              textShadow: '0 1px 4px rgba(0,0,0,.85)',
            }}
          >
            <span>← Lower-rated stack areas</span>
            <span>Higher-rated stack areas →</span>
          </div>
        )}

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
          {mapLayout.map(({ cluster, centroid, items }) => {
            const { cx, cy } = centroid;
            const em = isClusterEmphasized(cluster.id);
            const isHov = hovCluster === cluster.id;
            return items.map((item, ri) => {
              const inList = focusRepoSet == null || focusRepoSet.has(item.repo.productId);
              const spokeOp =
                focusRepoSet == null
                  ? isHov
                    ? 0.2
                    : 0.09
                  : !em
                    ? 0.04
                    : isHov
                      ? 0.32
                      : inList
                        ? 0.26
                        : 0.1;
              return (
                <line
                  key={`${cluster.id}-${ri}`}
                  x1={`${cx}%`}
                  y1={`${cy}%`}
                  x2={`${item.x}%`}
                  y2={`${item.y}%`}
                  stroke={cluster.color}
                  strokeWidth=".9"
                  opacity={spokeOp}
                  style={{ transition: 'opacity 220ms ease' }}
                />
              );
            });
          })}
        </svg>

        {mapLayout.flatMap(({ cluster, items }) => {
          const em = isClusterEmphasized(cluster.id);
          const isHovC = hovCluster === cluster.id;
          return items.map(({ repo, x, y, starMul }, ri) => {
            const rk = `${cluster.id}-${ri}`;
            const isHovR = hovRepo === rk;
            const inProduct = focusRepoSet == null || focusRepoSet.has(repo.productId);
            let dotOp;
            if (focusRepoSet == null) {
              dotOp = isHovC || isHovR ? 0.95 : 0.52;
            } else if (!em) {
              dotOp = 0.14;
            } else {
              dotOp = inProduct ? (isHovR ? 1 : 0.92) : 0.26;
            }
            const baseDot = layoutMode === 'stack' ? 5.25 : 6;
            const w = Math.min(14, Math.max(4.5, (isHovR ? baseDot + 5 : em ? baseDot + 2.2 : baseDot) * starMul));
            return (
              <div
                key={rk}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    goToCategoryExplorer(cluster.id);
                  }
                }}
                onClick={() => goToCategoryExplorer(cluster.id)}
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
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: 'translate(-50%,-50%)',
                  zIndex: isHovR ? 9 : em ? 5 : 3,
                  cursor: 'pointer',
                  animation: `dot-emerge 400ms ${ri * 35}ms cubic-bezier(.16,1,.3,1) both`,
                  opacity: focusRepoSet != null && !em ? 0.35 : 1,
                  transition: 'opacity 220ms ease',
                }}
              >
                <div
                  style={{
                    width: w,
                    height: w,
                    borderRadius: '50%',
                    background: cluster.color,
                    opacity: layoutMode === 'stack' ? Math.min(1, dotOp * (0.92 + starMul * 0.06)) : dotOp,
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
                      padding: '6px 10px 7px',
                      fontFamily: "'DM Sans', system-ui, sans-serif",
                      fontSize: 10,
                      color: 'rgba(255,255,255,.88)',
                      maxWidth: 260,
                      textAlign: 'center',
                      zIndex: 20,
                      boxShadow: '0 4px 16px rgba(0,0,0,.5)',
                      letterSpacing: '.02em',
                      lineHeight: 1.35,
                      pointerEvents: 'none',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '.04em' }}>
                      {repo.name}
                    </div>
                    <div style={{ marginTop: 3, fontSize: 9, color: 'rgba(255,255,255,.55)', fontFamily: "'DM Mono', monospace", letterSpacing: '.06em' }}>
                      {cluster.label}
                    </div>
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 8,
                letterSpacing: '.16em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,.38)',
              }}
            >
              Map layout
            </span>
            <div
              role="group"
              aria-label="Map layout"
              style={{ display: 'flex', gap: 0, borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,.12)' }}
            >
              <button
                type="button"
                onClick={() => setLayoutMode('stack')}
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 9,
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                  padding: '6px 11px',
                  border: 'none',
                  cursor: 'pointer',
                  background: layoutMode === 'stack' ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.25)',
                  color: layoutMode === 'stack' ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.45)',
                }}
              >
                Stack
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('galaxy')}
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 9,
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                  padding: '6px 11px',
                  border: 'none',
                  borderLeft: '1px solid rgba(255,255,255,.1)',
                  cursor: 'pointer',
                  background: layoutMode === 'galaxy' ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.25)',
                  color: layoutMode === 'galaxy' ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.45)',
                }}
              >
                Galaxy
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 10,
            }}
          >
            <label
              htmlFor="ecosystem-query"
              style={{
                flexShrink: 0,
                margin: 0,
                fontFamily: "'DM Mono', monospace",
                fontSize: 8,
                letterSpacing: '.16em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,.38)',
              }}
            >
              Product focus
            </label>
            <select
              id="ecosystem-query"
              value={focusId}
              onChange={(e) => setFocusId(e.target.value)}
              style={{
                flex: 1,
                minWidth: 0,
                maxWidth: 280,
                fontFamily: "'DM Mono', monospace",
                fontSize: 9,
                letterSpacing: '.1em',
                fontWeight: 500,
                textTransform: 'none',
                color: 'rgba(255,255,255,.9)',
                background: 'rgba(0,0,0,.35)',
                border: '1px solid rgba(255,255,255,.14)',
                borderRadius: 6,
                padding: '6px 11px',
                paddingRight: 30,
                outline: 'none',
                cursor: 'pointer',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.45)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 10px center',
              }}
            >
              <option value="overview" style={{ color: '#0B1E2D', background: '#F5F2EE' }}>
                Overview — full map
              </option>
              {productSpecs.map((p) => (
                <option key={p.slug} value={p.slug} style={{ color: '#0B1E2D', background: '#F5F2EE' }}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

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
            {totalRepos} repos · {ecoClusters.length} stack categories
            {focusSpec && focusClusterIds && (
              <span style={{ display: 'block', marginTop: 4, color: 'rgba(255,255,255,.32)' }}>
                Spec: {focusSpec.repoProductIds.length} repos across {focusClusterIds.size} categories
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
