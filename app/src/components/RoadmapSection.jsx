import { useState, useEffect } from 'react';
import { PALETTES } from '../data/palettes.js';
import { coreRoadmap } from '../data/coreRoadmap.js';
import { DEFAULT_LABEL_COLOR, ROADMAP_PERIOD_PILL_COLOR } from '../data/parseRoadmapMarkdown.js';
import { productSpecs } from '../data/productSpecs.js';
import { STATUS_COLOR, STATUS_LABEL } from '../constants/status.js';
import roadmapDawn from '../assets/roadmap-dawn.png';
import roadmapDusk from '../assets/roadmap-dusk.png';

const MOBILE_BP = 600;
const CENTER_GAP = 28; // px gap between card edge and center spine

function renderInlineMarks(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/);
  return parts.map((part, pi) => {
    const m = part.match(/^\*\*([^*]+)\*\*$/);
    if (m) return <strong key={pi}>{m[1]}</strong>;
    return part ? <span key={pi}>{part}</span> : null;
  });
}

export function RoadmapSection({ mode }) {
  const p = PALETTES[mode];
  const bgSrc = mode === 'dawn' ? roadmapDawn : roadmapDusk;
  const objectPosition = mode === 'dawn' ? '82% 45%' : '18% 45%';
  const [hov, setHov] = useState(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_BP);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BP);
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const steps = coreRoadmap.steps
    .map((step) => {
      const ps = productSpecs.find((s) => s.slug === step.slug);
      const displayTitle = ps?.title ?? step.slug.replace(/-/g, ' ');
      return { ...step, displayTitle };
    })
    .slice()
    .reverse();

  return (
    <div
      className="grain"
      style={{ width: '100vw', position: 'relative', background: p.rmBg }}
      data-screen-label="01 Roadmap"
    >
      {/* Sticky background */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          height: 'var(--app-height)',
          marginBottom: 'calc(-1 * var(--app-height))',
          overflow: 'hidden',
          zIndex: 0,
          background: p.rmBg,
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      >
        <img
          src={bgSrc}
          alt=""
          decoding="async"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition }}
        />
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 90% 85% at 50% 50%, rgba(0,0,0,.32) 0%, rgba(0,0,0,.52) 100%)',
        }} />
      </div>

      {/* Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: isMobile ? '100%' : 680,
          margin: '0 auto',
          padding: isMobile ? '14px 0 20px' : '24px 0 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? 14 : 22,
        }}
      >
        {/* Center spine */}
        {!isMobile && (
          <div style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            bottom: 0,
            width: 1,
            transform: 'translateX(-50%)',
            background: 'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,.1) 3%, rgba(255,255,255,.1) 97%, transparent 100%)',
            pointerEvents: 'none',
            zIndex: 0,
          }} />
        )}

        {/* Mobile left rail */}
        {isMobile && (
          <div style={{
            position: 'absolute',
            left: 22,
            top: 0,
            bottom: 0,
            width: 1,
            background: 'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,.1) 3%, rgba(255,255,255,.1) 97%, transparent 100%)',
            pointerEvents: 'none',
            zIndex: 0,
          }} />
        )}

        {steps.map((item, i) => {
          const isRight = i % 2 === 0; // even → right column, odd → left column
          const isHov = hov === i;
          const hc = item.highlightColor;
          const accentBorder = hc || (isHov ? STATUS_COLOR[item.status] : 'rgba(18,35,52,.14)');
          const cardBg = isHov ? 'rgba(255,252,248,.97)' : 'rgba(255,252,248,.9)';
          const borderW = hc ? 2 : 1;
          const labelText = item.labelFromMarkdown?.trim() || STATUS_LABEL[item.status];
          const labelTint = item.labelColorFromMarkdown || DEFAULT_LABEL_COLOR;
          const dotColor = hc || (isHov ? STATUS_COLOR[item.status] : 'rgba(255,255,255,.28)');

          const cardInner = (
            <>
              <div style={{
                background: cardBg,
                borderWidth: borderW,
                borderStyle: 'solid',
                borderColor: accentBorder,
                borderRadius: 4,
                padding: '13px 15px 11px',
                boxShadow: isHov
                  ? `2px 3px 0 rgba(0,0,0,.1), 0 0 0 1px ${STATUS_COLOR[item.status]}18`
                  : '1px 2px 0 rgba(0,0,0,.06)',
                transition: 'all 220ms ease',
                backdropFilter: 'blur(10px)',
              }}>
                {item.compareFromMarkdown ? (
                  <div style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 7,
                    letterSpacing: '.06em',
                    color: '#5a6a76',
                    marginBottom: 6,
                    opacity: 0.82,
                  }}>
                    compare: {item.compareFromMarkdown}
                  </div>
                ) : null}

                <div style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: 'clamp(1rem, 1.55vw, 1.22rem)',
                  fontWeight: 500,
                  color: '#0a1520',
                  lineHeight: 1.15,
                  marginBottom: item.subtitle && isHov ? 10 : item.subtitle ? 2 : 8,
                  transition: 'margin 180ms ease',
                }}>
                  {item.displayTitle}
                </div>

                {item.subtitle ? (
                  <div
                    aria-hidden={!isHov}
                    style={{
                      overflow: 'hidden',
                      maxHeight: isHov ? 260 : 0,
                      opacity: isHov ? 1 : 0,
                      marginBottom: isHov ? 8 : 0,
                      transition: 'max-height 260ms ease, opacity 200ms ease, margin-bottom 200ms ease',
                    }}
                  >
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, lineHeight: 1.5, color: '#2c3e4a' }}>
                      {renderInlineMarks(item.subtitle)}
                    </div>
                  </div>
                ) : null}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: isMobile || !isRight ? 'flex-start' : 'flex-end' }}>
                  <div style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 7,
                    letterSpacing: '.08em',
                    color: labelTint,
                    border: /^#[0-9a-f]{6}$/i.test(labelTint) ? `1px solid ${labelTint}c9` : `1px solid ${labelTint}`,
                    padding: '1px 5px',
                    borderRadius: 2,
                    display: 'inline-block',
                    opacity: isHov ? 1 : 0.88,
                    transition: 'opacity 180ms ease',
                  }}>
                    {labelText}
                  </div>
                  {item.periodFromMarkdown?.trim() ? (
                    <div style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 7,
                      letterSpacing: '.08em',
                      color: ROADMAP_PERIOD_PILL_COLOR,
                      border: `1px solid ${ROADMAP_PERIOD_PILL_COLOR}c9`,
                      padding: '1px 5px',
                      borderRadius: 2,
                      display: 'inline-block',
                      opacity: isHov ? 1 : 0.88,
                      transition: 'opacity 180ms ease',
                    }}>
                      {item.periodFromMarkdown.trim()}
                    </div>
                  ) : null}
                </div>
              </div>

              {item.sidenotes.length > 0 ? (
                <aside className="roadmap-sidenote-below" aria-hidden="true">
                  {item.sidenotes.map((sn, si) => (
                    <div key={si} className="roadmap-sidenote-line">{sn}</div>
                  ))}
                </aside>
              ) : null}
            </>
          );

          if (isMobile) {
            return (
              <div
                key={`${item.slug}-${item.order}`}
                onMouseEnter={() => setHov(i)}
                onMouseLeave={() => setHov(null)}
                style={{ position: 'relative', padding: '0 16px 0 42px' }}
              >
                {/* Dot on left rail */}
                <div style={{
                  position: 'absolute',
                  left: 22,
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: dotColor,
                  transition: 'background 200ms ease',
                  zIndex: 2,
                }} />
                {cardInner}
              </div>
            );
          }

          return (
            <div
              key={`${item.slug}-${item.order}`}
              onMouseEnter={() => setHov(i)}
              onMouseLeave={() => setHov(null)}
              style={{
                position: 'relative',
                opacity: hov !== null && !isHov ? 0.44 : 1,
                transition: 'opacity 180ms ease',
              }}
            >
              {/* Dot on center spine */}
              <div style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: isHov ? 8 : 5,
                height: isHov ? 8 : 5,
                borderRadius: '50%',
                background: dotColor,
                transition: 'all 200ms ease',
                zIndex: 3,
              }} />

              {/* Connector: spine → card */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: isRight ? '50%' : `calc(50% - ${CENTER_GAP}px)`,
                width: CENTER_GAP,
                height: 1,
                transform: 'translateY(-50%)',
                background: `rgba(255,255,255,${isHov ? 0.16 : 0.08})`,
                transition: 'background 200ms ease',
                zIndex: 1,
              }} />

              {/* Card in its column */}
              <div style={{
                display: 'flex',
                justifyContent: isRight ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  width: `calc(50% - ${CENTER_GAP}px)`,
                  textAlign: isRight ? 'right' : 'left',
                }}>
                  {cardInner}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
