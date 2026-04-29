export function Sparkline({ data, width = 80, height = 24, color = 'rgba(255,255,255,.5)', filled = false }) {
  if (!data || data.length === 0) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <line x1={0} y1={height / 2} x2={width} y2={height / 2}
          stroke="rgba(255,255,255,.12)" strokeWidth={1} strokeDasharray="2,3" />
      </svg>
    );
  }

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const padY = 2;
  const usableHeight = height - padY * 2;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = padY + usableHeight - ((v - min) / range) * usableHeight;
    return `${x},${y}`;
  });

  const pathD = `M${points.join(' L')}`;
  const fillD = `${pathD} L${width},${height} L0,${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {filled && (
        <path d={fillD} fill={color} opacity={0.12} />
      )}
      <path d={pathD} fill="none" stroke={color} strokeWidth={1.5}
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
