import { PALETTES } from '../data/palettes.js';
import storyDawn from '../assets/story-dawn.png';
import storyDusk from '../assets/story-dusk.png';

export function StorySection({ mode }) {
  const p = PALETTES[mode];
  const bgSrc = mode === 'dawn' ? storyDawn : storyDusk;
  const objectPosition = mode === 'dawn' ? '48% 44%' : '82% 46%';

  return (
    <div className="grain" style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#030508' }} data-screen-label="04 Story">
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          overflow: 'hidden',
          background: '#030508',
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
              'radial-gradient(ellipse 88% 82% at 50% 50%, rgba(0,0,0,.2) 0%, rgba(0,0,0,.62) 100%)',
          }}
        />
      </div>
      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 40px' }}>
        <div
          style={{
            maxWidth: 480,
            textAlign: 'center',
            padding: '38px 44px',
            background: 'rgba(0,0,0,.42)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,.07)',
            boxShadow: '0 8px 48px rgba(0,0,0,.5)',
          }}
        >
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: p.accent, marginBottom: 18 }}>Our story</div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(1.8rem,3.2vw,2.9rem)', fontWeight: 300, color: '#fff', letterSpacing: '-.02em', lineHeight: 1.12, margin: '0 0 20px' }}>
            We stand at the shore of something new.
          </h2>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, lineHeight: 1.72, color: 'rgba(255,255,255,.62)', margin: '0 0 28px' }}>
            Every major infrastructure shift in history was shaped by early decisions about who it served — electricity, the internet, telecommunications. AI is that moment now.
          </p>
          <a
            href="#"
            style={{
              display: 'inline-block',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              fontWeight: 500,
              color: '#fff',
              textDecoration: 'none',
              border: '1px solid rgba(255,255,255,.28)',
              borderRadius: 6,
              padding: '10px 24px',
              background: 'rgba(255,255,255,.06)',
              transition: 'all 220ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,.14)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,.06)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,.28)';
            }}
          >
            Read the full story →
          </a>
        </div>
      </div>
    </div>
  );
}
