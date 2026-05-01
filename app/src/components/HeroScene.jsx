import heroDawn from '../assets/hero-dawn.png';
import heroDusk from '../assets/hero-dusk.png';

export function HeroScene({ mode }) {
  const src = mode === 'dawn' ? heroDawn : heroDusk;
  const objectPosition = mode === 'dawn' ? '85% 50%' : '15% 50%';

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background: '#020508',
      }}
      aria-hidden="true"
    >
      <img
        src={src}
        alt=""
        decoding="async"
        fetchPriority="high"
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
            'radial-gradient(ellipse 85% 75% at 50% 45%, transparent 0%, rgba(0,0,0,.35) 72%, rgba(0,0,0,.55) 100%)',
        }}
      />
    </div>
  );
}
