import { useState } from 'react';
import { Link } from 'react-router-dom';
import { STARS } from '../data/stars.js';
import { ecoClusters } from '../data/ecoClusters.js';

export function EcosystemSection() {
  const [hovCluster, setHovCluster] = useState(null);
  const [hovRepo, setHovRepo] = useState(null);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: '#050811' }} data-screen-label="01 Ecosystem">
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        {STARS.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.r}
            fill="white"
            opacity={0.1 + (i % 7) * 0.06}
            style={{ animation: `twinkle ${s.dur}s ease-in-out infinite`, animationDelay: `${s.delay}s` }}
          />
        ))}
        <ellipse cx="300" cy="300" rx="500" ry="200" fill="#1E4A60" opacity=".035" style={{ filter: 'blur(60px)' }} />
        <ellipse cx="1100" cy="600" rx="420" ry="180" fill="#E8796A" opacity=".025" style={{ filter: 'blur(60px)' }} />
      </svg>

      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.25)' }}>
          Open source AI ecosystem
        </div>
        <Link
          to="/explore"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            fontWeight: 500,
            color: '#fff',
            textDecoration: 'none',
            background: 'rgba(255,255,255,.07)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,.15)',
            borderRadius: 6,
            padding: '7px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 200ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,.14)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,.07)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,.15)';
          }}
        >
          Go to Ecosystem App
          <span style={{ opacity: 0.7 }}>→</span>
        </Link>
      </div>

      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} aria-hidden="true">
        {ecoClusters.map((cluster) => {
          const isHov = hovCluster === cluster.id;
          const cx = cluster.repos.reduce((a, r) => a + r.x, 0) / cluster.repos.length;
          const cy = cluster.repos.reduce((a, r) => a + r.y, 0) / cluster.repos.length;
          return cluster.repos.map((repo, ri) => (
            <line
              key={`${cluster.id}-${ri}`}
              x1={`${cx}%`}
              y1={`${cy}%`}
              x2={`${repo.x}%`}
              y2={`${repo.y}%`}
              stroke={cluster.color}
              strokeWidth=".8"
              opacity={isHov ? 0.18 : 0.06}
              style={{ transition: 'opacity 200ms ease' }}
            />
          ));
        })}
      </svg>

      {ecoClusters.map((cluster) => {
        const isHovC = hovCluster === cluster.id;
        return (
          <div key={cluster.id}>
            <div style={{ position: 'absolute', left: `${cluster.lx}%`, top: `${cluster.ly}%`, transform: 'translate(-50%,-50%)', zIndex: 5 }}>
              <div
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 11,
                  fontWeight: 500,
                  color: isHovC ? '#fff' : cluster.color,
                  background: isHovC ? `${cluster.color}18` : 'rgba(255,255,255,.03)',
                  border: `1px solid ${cluster.color}${isHovC ? '88' : '40'}`,
                  borderRadius: 5,
                  padding: '5px 11px',
                  whiteSpace: 'nowrap',
                  backdropFilter: 'blur(8px)',
                  boxShadow: isHovC ? `0 0 20px ${cluster.color}20` : 'none',
                  transition: 'all 200ms ease',
                  cursor: 'default',
                }}
              >
                {cluster.label}
              </div>
            </div>

            {cluster.repos.map((repo, ri) => {
              const rk = `${cluster.id}-${ri}`;
              const isHovR = hovRepo === rk;
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
                    left: `${repo.x}%`,
                    top: `${repo.y}%`,
                    transform: 'translate(-50%,-50%)',
                    zIndex: isHovR ? 8 : 3,
                    cursor: 'default',
                    animation: `dot-emerge 400ms ${ri * 40}ms cubic-bezier(.16,1,.3,1) both`,
                  }}
                >
                  <div
                    style={{
                      width: isHovR ? 11 : 7,
                      height: isHovR ? 11 : 7,
                      borderRadius: '50%',
                      background: cluster.color,
                      opacity: isHovC ? 0.95 : 0.55,
                      boxShadow: isHovR ? `0 0 12px ${cluster.color}` : isHovC ? `0 0 6px ${cluster.color}60` : 'none',
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
            })}
          </div>
        );
      })}

      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 20,
          zIndex: 3,
          fontFamily: "'DM Mono', monospace",
          fontSize: 8,
          color: 'rgba(255,255,255,.16)',
          letterSpacing: '.08em',
        }}
      >
        {ecoClusters.reduce((a, c) => a + c.repos.length, 0)} repos across {ecoClusters.length} problem clusters · April 2026
      </div>
    </div>
  );
}
