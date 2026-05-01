import { useState } from 'react';
import { PALETTES } from '../data/palettes.js';
import { coreRoadmap, ROADMAP_DOT_OFFSETS } from '../data/coreRoadmap.js';
import { DEFAULT_LABEL_COLOR, ROADMAP_PERIOD_PILL_COLOR } from '../data/parseRoadmapMarkdown.js';
import { productSpecs } from '../data/productSpecs.js';
import { STATUS_COLOR, STATUS_LABEL } from '../constants/status.js';
import roadmapDawn from '../assets/roadmap-dawn.png';
import roadmapDusk from '../assets/roadmap-dusk.png';

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
  const [hov, setHov] = useState(null);
  const bgSrc = mode === 'dawn' ? roadmapDawn : roadmapDusk;
  const objectPosition = mode === 'dawn' ? '82% 45%' : '18% 45%';

  // Map with original index for stable dotOffset, then reverse for display order
  // (step 1 at bottom, step 12 at top — narrative flows as you scroll up toward ecosystem)
  const steps = coreRoadmap.steps
    .map((step, i) => {
      const ps = productSpecs.find((spec) => spec.slug === step.slug);
      const displayTitle = ps?.title ?? step.slug.replace(/-/g, ' ');
      return {
        ...step,
        displayTitle,
        dotOffset: ROADMAP_DOT_OFFSETS[i % ROADMAP_DOT_OFFSETS.length],
      };
    })
    .slice()
    .reverse();

  return (
    <div
      className="grain"
      style={{ width: '100vw', position: 'relative', background: p.rmBg }}
      data-screen-label="01 Roadmap"
    >
      {/* Sticky background — stays fixed in viewport as content scrolls over it */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          height: '100vh',
          marginBottom: '-100vh',
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
            background:
              'radial-gradient(ellipse 90% 85% at 50% 50%, rgba(0,0,0,.32) 0%, rgba(0,0,0,.52) 100%)',
          }}
        />
      </div>

      {/* Center timeline line — spans full content height */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          bottom: 0,
          width: 1,
          zIndex: 1,
          background:
            'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,.1) 2%, rgba(255,255,255,.1) 98%, transparent 100%)',
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
        }}
      />

      {/* Scrollable content */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: 580,
          margin: '0 auto',
          padding: '12px 0 14px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {steps.map((item, i) => {
          const isLeft = i % 2 === 0;
          const isHov = hov === i;
          const hc = item.highlightColor;
          const accentBorder =
            hc || (isHov ? STATUS_COLOR[item.status] : 'rgba(18,35,52,.14)');
          const cardBg =
            isHov ? 'rgba(255,252,248,.97)' : 'rgba(255,252,248,.9)';
          const borderW = hc ? 2 : 1;
          const labelText =
            item.labelFromMarkdown?.trim() || STATUS_LABEL[item.status];
          const labelTint =
            item.labelColorFromMarkdown || DEFAULT_LABEL_COLOR;

          return (
            <div
              key={`${item.slug}-${item.order}`}
              onMouseEnter={() => setHov(i)}
              onMouseLeave={() => setHov(null)}
              style={{
                minHeight: 'calc(100vh / 4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: isLeft ? 'flex-end' : 'flex-start',
                position: 'relative',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 'calc(50% - 30px)',
                  textAlign: isLeft ? 'right' : 'left',
                  transition: 'opacity 180ms ease',
                  opacity: hov !== null && !isHov ? 0.44 : 1,
                }}
              >
                <div>
                  <div
                    style={{
                      background: cardBg,
                      borderWidth: borderW,
                      borderStyle: 'solid',
                      borderColor: accentBorder,
                      borderRadius: 4,
                      padding: '13px 15px 11px',
                      boxShadow:
                        isHov
                          ? `2px 3px 0 rgba(0,0,0,.1), 0 0 0 1px ${STATUS_COLOR[item.status]}18`
                          : '1px 2px 0 rgba(0,0,0,.06)',
                      transition: 'all 220ms ease',
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    {item.compareFromMarkdown ? (
                      <div
                        style={{
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 7,
                          letterSpacing: '.06em',
                          color: '#5a6a76',
                          marginBottom: 6,
                          opacity: 0.82,
                        }}
                      >
                        compare: {item.compareFromMarkdown}
                      </div>
                    ) : null}

                    <div
                      style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: 'clamp(1rem,1.55vw,1.22rem)',
                        fontWeight: 500,
                        color: '#0a1520',
                        lineHeight: 1.15,
                        marginBottom: item.subtitle && isHov ? 10 : item.subtitle ? 2 : 8,
                        transition: 'margin 180ms ease',
                      }}
                    >
                      {item.displayTitle}
                    </div>

                    {item.subtitle ? (
                      <div
                        aria-hidden={!isHov}
                        style={{
                          overflow: 'hidden',
                          maxHeight: isHov ? 240 : 0,
                          opacity: isHov ? 1 : 0,
                          marginBottom: isHov ? 8 : 0,
                          transition:
                            'max-height 260ms ease,opacity 200ms ease,margin-bottom 200ms ease',
                        }}
                      >
                        <div
                          style={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: 10,
                            lineHeight: 1.5,
                            color: '#2c3e4a',
                          }}
                        >
                          {renderInlineMarks(item.subtitle)}
                        </div>
                      </div>
                    ) : null}

                    <div
                      style={{
                        marginTop: 7,
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 6,
                        justifyContent: isLeft ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 7,
                          letterSpacing: '.08em',
                          textTransform: 'none',
                          color: labelTint,
                          opacity: isHov ? 1 : 0.88,
                          border: /^#[0-9a-f]{6}$/i.test(labelTint)
                            ? `1px solid ${labelTint}c9`
                            : `1px solid ${labelTint}`,
                          display: 'inline-block',
                          padding: '1px 5px',
                          borderRadius: 2,
                          transition: 'opacity 180ms ease',
                        }}
                      >
                        {labelText}
                      </div>
                      {item.periodFromMarkdown?.trim() ? (
                        <div
                          style={{
                            fontFamily: "'DM Mono', monospace",
                            fontSize: 7,
                            letterSpacing: '.08em',
                            textTransform: 'none',
                            color: ROADMAP_PERIOD_PILL_COLOR,
                            opacity: isHov ? 1 : 0.88,
                            border: `1px solid ${ROADMAP_PERIOD_PILL_COLOR}c9`,
                            display: 'inline-block',
                            padding: '1px 5px',
                            borderRadius: 2,
                            transition: 'opacity 180ms ease',
                          }}
                        >
                          {item.periodFromMarkdown.trim()}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {item.sidenotes.length > 0 ? (
                    <aside className="roadmap-sidenote-below" aria-hidden="true">
                      {item.sidenotes.map((sn, si) => (
                        <div key={si} className="roadmap-sidenote-line">
                          {sn}
                        </div>
                      ))}
                    </aside>
                  ) : null}
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
                  left: isLeft
                    ? `calc(50% + ${item.dotOffset + 4}px)`
                    : `calc(50% + ${item.dotOffset - 4}px)`,
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
