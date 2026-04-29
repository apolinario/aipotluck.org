export function healthBucket(score) {
  if (score >= 70) return 'healthy';
  if (score >= 45) return 'fragile';
  return 'gap';
}

export function healthColor(score) {
  const b = healthBucket(score);
  if (b === 'healthy') return '#1b9e8a';
  if (b === 'fragile') return '#d9952a';
  return '#c8341d';
}

export function healthLabel(score) {
  const b = healthBucket(score);
  if (b === 'healthy') return 'Healthy';
  if (b === 'fragile') return 'Fragile';
  return 'Gap';
}
