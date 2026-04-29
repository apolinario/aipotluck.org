import { GlassCard } from '../GlassCard.jsx';
import { HealthBadge } from './HealthBadge.jsx';
import { healthColor } from '../../utils/health.js';

export function LayerCards({ layers, activeLayer, onLayerClick }) {
  return (
    <div className="layer-cards-row" style={{
      display: 'flex',
      gap: 10,
      padding: '0 24px',
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
              padding: '12px 14px',
              minWidth: 140,
              flexShrink: 0,
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: 8,
            }}>
              <span style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13,
                fontWeight: 500,
                color: isActive ? '#fff' : 'rgba(255,255,255,.85)',
              }}>
                {layer.layer}
              </span>
              <HealthBadge score={healthScore} />
            </div>
            <div style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              color: 'rgba(255,255,255,.4)',
              letterSpacing: '.06em',
              marginBottom: 6,
            }}>
              {layer.subcategories.length} subcategories
            </div>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
            }}>
              {[...new Set(
                layer.subcategories
                  .flatMap((s) => s.top_projects || [])
              )].slice(0, 3)
                .map((name) => (
                  <span key={name} style={{
                    fontSize: 10,
                    padding: '2px 7px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,.06)',
                    border: '1px solid rgba(255,255,255,.08)',
                    color: 'rgba(255,255,255,.55)',
                    whiteSpace: 'nowrap',
                  }}>
                    {name}
                  </span>
                ))}
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}
