import { GlassCard } from '../GlassCard.jsx';
import { HealthBadge } from './HealthBadge.jsx';
import { healthColor } from '../../utils/health.js';

export function LayerCards({ layers, activeLayer, onLayerClick }) {
  return (
    <div className="layer-cards-row" style={{
      display: 'flex',
      gap: 6,
      padding: '0 20px',
      overflowX: 'auto',
      scrollbarWidth: 'none',
    }}>
      {layers.map((layer) => {
        const avgGap = layer.subcategories.reduce((s, c) => s + c.gap_score, 0) / layer.subcategories.length;
        const healthScore = Math.round((avgGap / 5) * 100);
        const isActive = activeLayer === layer.layer;
        const color = healthColor(healthScore);

        return (
          <GlassCard
            key={layer.layer}
            active={isActive}
            activeColor={color}
            onClick={() => onLayerClick(isActive ? null : layer.layer)}
            style={{
              padding: '8px 12px',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12,
              fontWeight: 500,
              color: isActive ? '#fff' : 'rgba(255,255,255,.75)',
              whiteSpace: 'nowrap',
            }}>
              {layer.layer}
            </span>
            <span style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              color: 'rgba(255,255,255,.3)',
            }}>
              {layer.subcategories.reduce((s, c) => s + (c.project_count || 0), 0)}
            </span>
            <HealthBadge score={healthScore} />
          </GlassCard>
        );
      })}
    </div>
  );
}
