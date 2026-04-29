import { PALETTES } from '../data/palettes.js';
import { STARS } from '../data/stars.js';

export function StorySection({ mode }) {
  const p = PALETTES[mode];
  const bright = mode === 'dawn';
  return (
    <div className="grain" style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} data-screen-label="04 Story">
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="st-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={bright ? '#020510' : '#010108'} />
            <stop offset="20%" stopColor={bright ? '#0A1030' : '#060210'} />
            <stop offset="48%" stopColor={bright ? '#901804' : '#780A30'} />
            <stop offset="70%" stopColor={bright ? '#D83808' : '#A82850'} />
            <stop offset="88%" stopColor={bright ? '#F06010' : '#C04058'} />
            <stop offset="100%" stopColor={bright ? '#FF9020' : '#CC6820'} stopOpacity=".6" />
          </linearGradient>
          <linearGradient id="st-sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={p.seaLight} stopOpacity=".9" />
            <stop offset="100%" stopColor={p.seaMid} />
          </linearGradient>
          <linearGradient id="st-land" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#060E08" />
            <stop offset="100%" stopColor="#020504" />
          </linearGradient>
          <radialGradient id="st-sun" gradientUnits="userSpaceOnUse" cx={bright ? 1440 : 0} cy="600" r="700">
            <stop offset="0%" stopColor={p.sunCore} stopOpacity=".85" />
            <stop offset="15%" stopColor={p.glowColor} stopOpacity=".65" />
            <stop offset="45%" stopColor={p.skyHorizon} stopOpacity=".22" />
            <stop offset="100%" stopColor={p.skyTop} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="st-vig" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="100%" stopColor="#000" stopOpacity=".7" />
          </radialGradient>
          <filter id="st-p" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency=".015 .01" numOctaves="4" seed="3" result="t" />
            <feDisplacementMap in="SourceGraphic" in2="t" scale="10" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="st-g">
            <feGaussianBlur stdDeviation="9" />
          </filter>
        </defs>
        <rect width="1440" height="900" fill="url(#st-sky)" />
        <rect width="1440" height="900" fill="url(#st-sun)" opacity=".85" />
        {STARS.slice(0, 80).map((s, i) => {
          const op = mode === 'dusk' ? 0.38 : s.y < 180 ? 0.16 : 0;
          if (op === 0) return null;
          return (
            <circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={s.r}
              fill="white"
              opacity={op}
              style={{ animation: `twinkle ${s.dur}s ease-in-out infinite`, animationDelay: `${s.delay}s` }}
            />
          );
        })}
        <g filter="url(#st-p)" opacity=".42">
          <ellipse cx="300" cy="200" rx="380" ry="95" fill={bright ? '#A01404' : '#780828'} />
          <ellipse cx="850" cy="170" rx="450" ry="110" fill={bright ? '#B81C06' : '#880630'} />
          <ellipse cx="1250" cy="230" rx="320" ry="85" fill={bright ? '#9C1208' : '#700624'} />
        </g>
        <rect x="0" y="570" width="1440" height="6" fill={p.glowColor} opacity=".45" filter="url(#st-g)" />
        <rect x="0" y="574" width="1440" height="42" fill="url(#st-sea)" opacity=".88" />
        <g stroke={p.seaGlint} strokeWidth=".8" fill="none" opacity=".28">
          <path d="M0,580 Q360,574 720,580 Q1080,586 1440,580" />
          <path d="M0,594 Q400,588 800,594 Q1200,600 1440,594" />
          <path d="M0,610 Q480,604 960,610 Q1280,616 1440,610" />
        </g>
        <path d="M0,616 Q220,604 480,612 Q680,620 900,610 Q1120,600 1320,614 Q1420,620 1440,614 L1440,900 L0,900 Z" fill="url(#st-land)" />
        <g fill="#050A06" opacity=".85">
          <ellipse cx="140" cy="628" rx="70" ry="18" />
          <ellipse cx="340" cy="620" rx="45" ry="14" />
          <ellipse cx="1100" cy="622" rx="60" ry="16" />
          <ellipse cx="1320" cy="626" rx="50" ry="14" />
        </g>
        <g fill="#04080A" opacity=".78">
          <ellipse cx="55" cy="620" rx="40" ry="26" />
          <ellipse cx="28" cy="610" rx="24" ry="30" />
          <ellipse cx="1400" cy="616" rx="44" ry="28" />
        </g>
        <g transform="translate(268,574)" fill="#020604" opacity=".9">
          <circle cx="0" cy="12" r="9.5" />
          <rect x="-4" y="21" width="8" height="38" rx="4" />
          <path d="M-4,30 Q-20,22 -28,36" stroke="#020604" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <path d="M4,30 Q16,28 22,38" stroke="#020604" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M-2,59 Q-5,72 -7,82" stroke="#020604" strokeWidth="4.5" strokeLinecap="round" fill="none" />
          <path d="M2,59 Q5,72 8,82" stroke="#020604" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        </g>
        <g transform="translate(640,582)" opacity=".35">
          <path d="M-20,6 L-14,0 L14,0 L20,6 L22,8 L-22,8 Z" fill={p.seaDeep} />
          <line x1="0" y1="0" x2="0" y2="-28" stroke={p.seaDeep} strokeWidth="1.2" />
          <path d="M0,-26 L14,-12 L0,-12 Z" fill={p.glowColor} opacity=".18" />
        </g>
        <rect width="1440" height="900" fill="url(#st-vig)" />
      </svg>
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
