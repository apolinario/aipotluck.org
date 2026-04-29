import { PALETTES } from '../data/palettes.js';
import { STARS } from '../data/stars.js';
import { Ship } from './Ship.jsx';

export function HeroScene({ mode }) {
  const p = PALETTES[mode];
  const uid = mode;
  const sx = p.sunX;
  const sy = p.sunY;
  return (
    <svg
      viewBox="0 0 1440 900"
      preserveAspectRatio={p.preserveAR}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.skyTop} />
          <stop offset="18%" stopColor={p.skyUpper} />
          <stop offset="44%" stopColor={p.skyBand} />
          <stop offset="63%" stopColor={p.skyMid} />
          <stop offset="80%" stopColor={p.skyHorizon} />
          <stop offset="100%" stopColor={p.glowColor} stopOpacity=".6" />
        </linearGradient>
        <radialGradient id={`${uid}-sun`} gradientUnits="userSpaceOnUse" cx={sx} cy={sy} r="680">
          <stop offset="0%" stopColor={p.sunCore} stopOpacity="1" />
          <stop offset="6%" stopColor={p.sunCore} stopOpacity=".98" />
          <stop offset="14%" stopColor={p.glowColor} stopOpacity=".95" />
          <stop offset="35%" stopColor={p.skyHorizon} stopOpacity=".52" />
          <stop offset="68%" stopColor={p.skyMid} stopOpacity=".16" />
          <stop offset="100%" stopColor={p.skyTop} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-sea`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.seaLight} />
          <stop offset="30%" stopColor={p.seaMid} />
          <stop offset="100%" stopColor={p.seaDeep} />
        </linearGradient>
        <radialGradient id={`${uid}-refl`} gradientUnits="userSpaceOnUse" cx={sx} cy={sy} r="800">
          <stop offset="0%" stopColor={p.sunCore} stopOpacity=".8" />
          <stop offset="12%" stopColor={p.glowColor} stopOpacity=".6" />
          <stop offset="30%" stopColor={p.seaGlint} stopOpacity=".3" />
          <stop offset="65%" stopColor={p.seaMid} stopOpacity=".06" />
          <stop offset="100%" stopColor={p.seaDeep} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-fg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.seaMid} stopOpacity="0" />
          <stop offset="100%" stopColor={p.landDark} stopOpacity="1" />
        </linearGradient>
        <radialGradient id={`${uid}-vig`} cx="50%" cy="50%" r="72%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="100%" stopColor="#000" stopOpacity=".62" />
        </radialGradient>
        <filter id={`${uid}-paint`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency=".018 .012" numOctaves="4" seed="5" result="turb" />
          <feDisplacementMap in="SourceGraphic" in2="turb" scale="12" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id={`${uid}-cld`}>
          <feGaussianBlur stdDeviation="28" />
        </filter>
        <filter id={`${uid}-cld2`}>
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <filter id={`${uid}-glow`}>
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <filter id={`${uid}-glowlg`}>
          <feGaussianBlur stdDeviation="42" />
        </filter>
      </defs>
      <rect width="1440" height="900" fill={`url(#${uid}-sky)`} />
      {STARS.map((star, i) => {
        const op = mode === 'dusk' ? (star.y < 420 ? 0.55 : 0.2) : star.y < 160 ? 0.2 : 0;
        if (op < 0.04) return null;
        return (
          <circle
            key={i}
            cx={star.x}
            cy={star.y}
            r={star.r}
            fill="white"
            opacity={op}
            style={{
              animation: `twinkle ${star.dur}s ease-in-out infinite`,
              animationDelay: `${star.delay}s`,
            }}
          />
        );
      })}
      <g filter={`url(#${uid}-paint)`} opacity=".34">
        <ellipse cx="160" cy="130" rx="260" ry="65" fill={p.cloudCool} />
        <ellipse cx="520" cy="100" rx="310" ry="58" fill={p.cloudCool} />
        <ellipse cx="950" cy="140" rx="280" ry="62" fill={p.cloudCool} />
        <ellipse cx="1320" cy="115" rx="210" ry="50" fill={p.cloudCool} />
      </g>
      <g filter={`url(#${uid}-paint)`} opacity=".45">
        <ellipse cx="260" cy="270" rx="340" ry="90" fill={p.cloudWarm} />
        <ellipse cx="700" cy="240" rx="420" ry="100" fill={p.cloudWarm} />
        <ellipse cx="1180" cy="280" rx="360" ry="85" fill={p.cloudWarm} />
      </g>
      <g filter={`url(#${uid}-cld2)`} opacity=".55">
        <ellipse cx="380" cy="400" rx="430" ry="30" fill={p.glowColor} />
        <ellipse cx="920" cy="382" rx="510" ry="26" fill={p.skyHorizon} />
        <ellipse cx="1300" cy="412" rx="300" ry="24" fill={p.glowColor} opacity=".7" />
      </g>
      <g filter={`url(#${uid}-cld)`} opacity=".3">
        <ellipse cx="620" cy="200" rx="180" ry="60" fill={p.sunCore} />
        <ellipse cx="980" cy="175" rx="150" ry="50" fill={p.sunCore} opacity=".7" />
      </g>
      <rect width="1440" height="900" fill={`url(#${uid}-sun)`} opacity=".92" />
      <circle cx={sx} cy={sy} r={90} fill={p.glowColor} opacity=".94" />
      <circle cx={sx} cy={sy} r={62} fill={p.sunCore} opacity=".98" />
      <circle cx={sx} cy={sy} r={34} fill="#fff" opacity=".9" />
      <circle cx={sx} cy={sy} r={120} fill="none" stroke={p.glowColor} strokeWidth="4" opacity=".18" />
      <rect x="0" y="513" width="1440" height="16" fill={p.glowColor} opacity=".62" filter={`url(#${uid}-glow)`} />
      <rect x="0" y="518" width="1440" height="3" fill={p.sunCore} opacity=".55" />
      <rect x="0" y="520" width="1440" height="380" fill={`url(#${uid}-sea)`} />
      <rect x="0" y="520" width="1440" height="380" fill={`url(#${uid}-refl)`} opacity=".9" />
      <g stroke={p.seaGlint} strokeWidth=".85" fill="none" opacity=".2">
        <path d="M0,544 Q240,534 480,544 Q720,554 960,544 Q1200,534 1440,544" />
        <path d="M0,572 Q280,562 560,572 Q840,582 1120,572 Q1340,564 1440,572" />
        <path d="M0,610 Q320,600 640,610 Q960,620 1280,610 Q1400,606 1440,610" />
        <path d="M0,658 Q400,648 800,658 Q1200,668 1440,658" />
        <path d="M0,720 Q480,711 960,720 Q1280,727 1440,720" />
      </g>
      <g transform="translate(780,462)" opacity=".72">
        <rect x="0" y="58" width="260" height="9" rx="2" fill={p.seaDeep} />
        {[10, 50, 96, 144, 196, 246].map((x) => (
          <rect key={x} x={x} y="67" width="5" height="32" fill={p.seaDeep} />
        ))}
        <rect x="140" y="22" width="66" height="38" rx="1" fill={p.seaDeep} />
        <path d="M136,22 L173,7 L210,22 Z" fill={p.seaDeep} />
        <circle cx="173" cy="5" r="4" fill={p.glowColor} opacity=".45" filter={`url(#${uid}-glow)`} />
        <rect x="148" y="30" width="10" height="8" rx="1" fill={p.glowColor} opacity=".35" />
      </g>
      <g transform="translate(620,498)" opacity=".3">
        <path d="M-24,8 L-18,0 L18,0 L24,8 L26,10 L-26,10 Z" fill={p.seaDeep} />
        <line x1="0" y1="0" x2="0" y2="-38" stroke={p.seaDeep} strokeWidth="1.5" />
        <line x1="-16" y1="-16" x2="12" y2="-14" stroke={p.seaDeep} strokeWidth="1" />
        <path d="M0,-36 L12,-14 L0,-14 Z" fill={p.glowColor} opacity=".2" />
      </g>
      <g transform={mode === 'dawn' ? 'translate(360,524)' : 'translate(1080,524) scale(-1,1)'}>
        <Ship p={p} />
      </g>
      <rect x="0" y="680" width="1440" height="220" fill={p.landDark} opacity=".55" />
      <rect x="0" y="620" width="1440" height="280" fill={`url(#${uid}-fg)`} opacity=".7" />
      <rect width="1440" height="900" fill={`url(#${uid}-vig)`} />
    </svg>
  );
}
