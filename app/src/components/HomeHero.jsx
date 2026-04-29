import { HeroScene } from './HeroScene.jsx';
import { PALETTES } from '../data/palettes.js';

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
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 'clamp(4rem,9vw,8rem)',
              fontWeight: 300,
              letterSpacing: '.05em',
              color: '#fff',
              lineHeight: 1,
              textShadow: '0 4px 80px rgba(0,0,0,.7),0 1px 12px rgba(0,0,0,.5)',
            }}
          >
            Current AI
          </div>
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 'clamp(.58rem,1.1vw,.78rem)',
              letterSpacing: '.26em',
              textTransform: 'uppercase',
              color: p.glowColor,
              marginTop: 16,
              opacity: 0.82,
            }}
          >
            Public interest AI infrastructure
          </div>
        </div>
      </div>
    </div>
  );
}
