// Tiny inline activity sparkline (real star history from OSO sparklines.json).
export function Sparkline({
  values,
  width = 96,
  height = 20,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  if (!values || values.length < 2) {
    return null;
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / span) * (height - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg
      aria-hidden="true"
      className="overflow-visible"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
    >
      <polyline
        fill="none"
        points={pts.join(" ")}
        stroke="var(--ap-live)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}
