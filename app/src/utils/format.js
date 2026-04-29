export function formatStars(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

export function formatCount(n) {
  if (n == null || n === 0) return '—';
  return n.toLocaleString();
}
