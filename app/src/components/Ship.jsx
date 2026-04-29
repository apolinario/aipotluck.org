export function Ship({ p }) {
  const c = p.seaDeep;
  const g = p.glowColor;
  const s = p.seaGlint;
  return (
    <g>
      <path
        d="M-90,-26 L82,-26 C97,-26,110,-17,112,-7 C113,3,107,13,93,16 Q0,22,-83,10 L-90,10 Z"
        fill={c}
        opacity=".97"
      />
      <path d="M-90,-1 Q0,6 93,1" stroke={s} strokeWidth="1" fill="none" opacity=".25" />
      <line x1="88" y1="-24" x2="184" y2="-66" stroke={c} strokeWidth="2.5" opacity=".9" />
      <rect x="-90" y="-54" width="40" height="28" rx="1" fill={c} opacity=".95" />
      <path d="M-92,-54 L-70,-66 L-48,-54 Z" fill={c} opacity=".9" />
      <rect x="-86" y="-49" width="9" height="7" rx="1" fill={g} opacity=".55" />
      <rect x="-72" y="-49" width="9" height="7" rx="1" fill={g} opacity=".4" />
      {[-60, -30, 0, 30, 60].map((x) => (
        <line key={x} x1={x} y1="-26" x2={x} y2="-34" stroke={c} strokeWidth="1.5" opacity=".5" />
      ))}
      <line x1="-75" y1="-31" x2="82" y2="-31" stroke={c} strokeWidth="1" opacity=".35" />
      <line x1="-30" y1="-26" x2="-30" y2="-168" stroke={c} strokeWidth="3" opacity=".88" />
      <line x1="-72" y1="-124" x2="14" y2="-118" stroke={c} strokeWidth="1.8" opacity=".78" />
      <line x1="16" y1="-26" x2="16" y2="-272" stroke={c} strokeWidth="4.5" opacity=".93" />
      <rect x="5" y="-270" width="22" height="9" rx="1" fill={c} opacity=".9" />
      <line x1="-16" y1="-228" x2="58" y2="-222" stroke={c} strokeWidth="2.2" opacity=".82" />
      <line x1="-10" y1="-144" x2="66" y2="-138" stroke={c} strokeWidth="2" opacity=".75" />
      <path d="M16,-270 L58,-222 L-16,-228 Z" fill={g} opacity=".32" />
      <path d="M-16,-226 Q46,-196,66,-138 L-10,-144 Q-12,-188,-16,-226 Z" fill={g} opacity=".24" />
      <path d="M-72,-122 Q-16,-104,14,-118 L-30,-166 Q-52,-146,-72,-122 Z" fill={g} opacity=".2" />
      <path d="M184,-66 L-30,-166 L88,-24 Z" fill={g} opacity=".15" />
      <path d="M-90,-26 L-46,-26 L-46,-60 Z" fill={g} opacity=".12" />
      <line x1="16" y1="-270" x2="-90" y2="-26" stroke={c} strokeWidth=".9" opacity=".38" />
      <line x1="16" y1="-270" x2="112" y2="-7" stroke={c} strokeWidth=".9" opacity=".34" />
      <line x1="16" y1="-150" x2="-30" y2="-26" stroke={c} strokeWidth=".7" opacity=".3" />
      <line x1="16" y1="-150" x2="90" y2="-24" stroke={c} strokeWidth=".7" opacity=".28" />
      <line x1="-30" y1="-166" x2="-90" y2="-26" stroke={c} strokeWidth=".6" opacity=".26" />
      <line x1="184" y1="-66" x2="16" y2="-26" stroke={c} strokeWidth=".6" opacity=".24" />
      <line x1="184" y1="-66" x2="-30" y2="-26" stroke={c} strokeWidth=".6" opacity=".22" />
      <g transform="scale(1,-0.14) translate(0,-16)" opacity=".1">
        <path d="M-90,-26 L82,-26 C97,-26,110,-17,112,-7 C113,3,107,13,93,16 Q0,22,-83,10 L-90,10 Z" fill={s} />
        <line x1="16" y1="-26" x2="16" y2="-272" stroke={s} strokeWidth="3" />
      </g>
    </g>
  );
}
