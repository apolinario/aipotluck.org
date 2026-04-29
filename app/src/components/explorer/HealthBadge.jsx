import { healthColor, healthLabel } from '../../utils/health.js';

export function HealthBadge({ score, showLabel = false }) {
  const color = healthColor(score);
  const label = healthLabel(score);

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 6px ${color}60`,
        flexShrink: 0,
      }} />
      {showLabel && (
        <span style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 10,
          color: color,
          letterSpacing: '.04em',
        }}>
          {label}
        </span>
      )}
    </span>
  );
}
