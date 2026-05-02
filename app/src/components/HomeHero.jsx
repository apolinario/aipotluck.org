import { HeroScene } from './HeroScene.jsx';
import { PALETTES } from '../data/palettes.js';
import logoFull from '../assets/currentai-logo-full.svg';

const CONTRIBUTORS = [
  { handle: 'mozilla',     label: 'mozilla' },
  { handle: 'r',           label: 'r' },
  { handle: 'forpublicai', label: 'forpublicai' },
  { handle: 'thelastjosh', label: 'thelastjosh' },
  { handle: 'jolow99',     label: 'jolow99' },
];

export function HomeHero({ mode }) {
  const p = PALETTES[mode];
  return (
    <div
      className="grain"
      style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}
      data-screen-label="02 Home"
    >
      <HeroScene mode={mode} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img
            src={logoFull}
            alt="Current AI"
            width={506}
            height={96}
            style={{
              width: 'min(90vw, 200px)',
              height: 'auto',
              display: 'block',
              filter: 'drop-shadow(0 4px 48px rgba(0,0,0,.65)) drop-shadow(0 1px 10px rgba(0,0,0,.45))',
            }}
          />
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 'clamp(.68rem,1.35vw,.95rem)',
              letterSpacing: '.12em',
              textTransform: 'lowercase',
              fontWeight: 700,
              color: 'rgba(255,255,255,.92)',
              marginTop: 20,
              opacity: 1,
            }}
          >
            right now, we&rsquo;re working on{' '}
            <span style={{ opacity: 0.6 }}>[inference-platform]</span>
          </div>
          <div
            style={{
              marginTop: 14,
              fontFamily: "'DM Mono', monospace",
              fontSize: 'clamp(.68rem,1.35vw,.95rem)',
              letterSpacing: '.1em',
              fontWeight: 700,
              color: 'rgba(255,255,255,.92)',
              pointerEvents: 'auto',
            }}
          >
            come join{' '}
            {CONTRIBUTORS.map((c, i) => (
              <span key={c.handle}>
                <a
                  href={`https://github.com/${c.handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: 'rgba(255,255,255,.58)',
                    textDecoration: 'none',
                    borderBottom: '1px solid rgba(255,255,255,.2)',
                    transition: 'color 150ms ease, border-color 150ms ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = 'rgba(255,255,255,.9)';
                    e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,.55)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = 'rgba(255,255,255,.58)';
                    e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,.2)';
                  }}
                >
                  {c.label}
                </a>
                {i < CONTRIBUTORS.length - 1 ? <span style={{ opacity: 0.4 }}>, </span> : null}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
