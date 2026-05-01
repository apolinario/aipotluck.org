import { HeroScene } from './HeroScene.jsx';
import { PALETTES } from '../data/palettes.js';
import logoFull from '../assets/currentai-logo-full.svg';

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
              fontSize: 'clamp(.58rem,1.1vw,.78rem)',
              letterSpacing: '.26em',
              textTransform: 'uppercase',
              color: p.glowColor,
              marginTop: 20,
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
