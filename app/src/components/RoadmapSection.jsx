import { useState } from 'react';
import { PALETTES } from '../data/palettes.js';
import { stackData } from '../data/stackData.js';
import { STATUS_COLOR, STATUS_LABEL } from '../constants/status.js';

export function RoadmapSection({ mode }) {
  const p = PALETTES[mode];
  const bright = mode === 'dawn';
  const [hov, setHov] = useState(null);

  return (
    <div
      className="grain"
      style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: p.rmBg }}
      data-screen-label="01 Roadmap"
    >
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <filter id="rm-cld">
            <feGaussianBlur stdDeviation="34" />
          </filter>
          <filter id="rm-ray">
            <feGaussianBlur stdDeviation="20" />
          </filter>
          <filter id="rm-paint" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency=".022 .015" numOctaves="3" seed="7" result="t" />
            <feDisplacementMap in="SourceGraphic" in2="t" scale="10" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <rect width="1440" height="900" fill={p.rmBg} />
        <g filter="url(#rm-paint)" opacity={bright ? 0.38 : 0.2}>
          <ellipse cx="300" cy="200" rx="500" ry="160" fill={bright ? '#1E2E58' : '#1A2448'} />
          <ellipse cx="920" cy="150" rx="580" ry="140" fill={bright ? '#263866' : '#16204A'} />
          <ellipse cx="1300" cy="300" rx="420" ry="150" fill={bright ? '#1C2850' : '#12183A'} />
          <ellipse cx="500" cy="540" rx="660" ry="185" fill={bright ? '#141E46' : '#0E1430'} />
          {bright && (
            <>
              <ellipse cx="760" cy="380" rx="380" ry="90" fill="#3C1E08" opacity=".5" />
              <ellipse cx="1380" cy="520" rx="300" ry="80" fill="#301408" opacity=".4" />
            </>
          )}
        </g>
        {p.rmRayAngles.map((deg, i) => {
          const r = (deg * Math.PI) / 180;
          const len = 2500;
          return (
            <line
              key={i}
              x1={p.rmRayX}
              y1={p.rmRayY}
              x2={p.rmRayX + Math.cos(r) * len}
              y2={p.rmRayY + Math.sin(r) * len}
              stroke={p.glowColor}
              strokeWidth={i === 3 ? 8 : 4}
              opacity={bright ? 0.032 : 0.018}
              filter="url(#rm-ray)"
            />
          );
        })}
        <circle
          cx={p.rmRayX === 1440 ? 1440 : 0}
          cy="900"
          r="550"
          fill={p.glowColor}
          opacity={bright ? 0.07 : 0.034}
          filter="url(#rm-ray)"
        />
      </svg>

      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          bottom: 0,
          width: 1,
          background: 'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,.1) 4%, rgba(255,255,255,.1) 96%, transparent 100%)',
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-evenly',
          padding: '28px 0',
          maxWidth: 560,
          margin: '0 auto',
        }}
      >
        {stackData.map((item, i) => {
          const isLeft = i % 2 === 0;
          const isHov = hov === i;
          return (
            <div
              key={i}
              onMouseEnter={() => setHov(i)}
              onMouseLeave={() => setHov(null)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: isLeft ? 'flex-end' : 'flex-start',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: 'calc(50% - 30px)',
                  textAlign: isLeft ? 'right' : 'left',
                  transition: 'opacity 180ms ease',
                  opacity: hov !== null && !isHov ? 0.28 : 1,
                }}
              >
                <div
                  style={{
                    background: isHov ? `${STATUS_COLOR[item.status]}10` : 'rgba(255,255,255,.03)',
                    border: `1px solid ${STATUS_COLOR[item.status]}${isHov ? '66' : '22'}`,
                    borderRadius: 4,
                    padding: '13px 15px 11px',
                    boxShadow: isHov
                      ? `2px 3px 0 rgba(0,0,0,.4), 0 0 18px ${STATUS_COLOR[item.status]}14`
                      : '1px 2px 0 rgba(0,0,0,.25)',
                    transition: 'all 220ms ease',
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontSize: 'clamp(.95rem,1.4vw,1.18rem)',
                      fontWeight: 300,
                      color: isHov ? '#fff' : 'rgba(255,255,255,.8)',
                      lineHeight: 1,
                      marginBottom: 5,
                      transition: 'color 180ms ease',
                    }}
                  >
                    {item.layer}
                  </div>
                  <div
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 10,
                      lineHeight: 1.5,
                      color: 'rgba(255,255,255,.32)',
                      marginBottom: isHov ? 6 : 0,
                      transition: 'margin 180ms ease',
                    }}
                  >
                    {item.desc}
                  </div>
                  <div
                    style={{
                      overflow: 'hidden',
                      maxHeight: isHov ? 130 : 0,
                      opacity: isHov ? 1 : 0,
                      transition: 'max-height 260ms ease,opacity 200ms ease',
                    }}
                  >
                    {item.items.map((sub, j) => (
                      <div key={j} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: 'rgba(255,255,255,.48)', lineHeight: 1.55, marginTop: 3 }}>
                        {sub}
                      </div>
                    ))}
                  </div>
                  <div
                    style={{
                      marginTop: 7,
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 7,
                      letterSpacing: '.14em',
                      textTransform: 'uppercase',
                      color: STATUS_COLOR[item.status],
                      opacity: isHov ? 0.85 : 0.35,
                      border: `1px solid ${STATUS_COLOR[item.status]}38`,
                      display: 'inline-block',
                      padding: '1px 5px',
                      borderRadius: 2,
                      transition: 'opacity 180ms ease',
                    }}
                  >
                    {STATUS_LABEL[item.status]}
                  </div>
                </div>
              </div>

              <div
                style={{
                  position: 'absolute',
                  left: `calc(50% + ${item.dotOffset}px)`,
                  top: '50%',
                  transform: 'translate(-50%,-50%)',
                  width: isHov ? 12 : 6,
                  height: isHov ? 12 : 6,
                  borderRadius: '50%',
                  background: STATUS_COLOR[item.status],
                  boxShadow: isHov ? `0 0 14px ${STATUS_COLOR[item.status]}90` : 'none',
                  transition: 'all 200ms ease',
                  zIndex: 3,
                }}
              />

              <div
                style={{
                  position: 'absolute',
                  left: isLeft ? `calc(50% + ${item.dotOffset + 4}px)` : `calc(50% + ${item.dotOffset - 4}px)`,
                  top: '50%',
                  height: 1,
                  width: 'calc(50% - 38px)',
                  transform: isLeft ? 'translateX(-100%)' : 'none',
                  background: `rgba(255,255,255,${isHov ? 0.1 : 0.04})`,
                  transition: 'background 200ms ease',
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
