import { useState, useMemo } from 'react';
import { LAYER_COLORS, TYPE_ORDER, TYPE_LABELS } from '../../explorer/constants.js';
import { fmtN, entityName, flag, generateEntitySummary } from '../../explorer/helpers.js';
import { ProductRow } from './ProductRow.jsx';

export function EntityDrawerContent({
  entityId, layers, entityMap, entitySummaries, entityTypeCount,
  products, reposAttrsByPid, modelsAttrsByPid, packagesAttrsByPid,
}) {
  const entity = entityMap[entityId];
  const summary = entitySummaries.find(e => e.entity_id === entityId);
  const tc = entityTypeCount[entityId] || {};
  const allTypes = useMemo(() => TYPE_ORDER.filter(t => tc[t]), [tc]);
  const [activeType, setActiveType] = useState(null);
  const currentType = activeType ?? allTypes[0] ?? null;

  if (!entity) return <div className="empty">Entity not found.</div>;

  const countryStr = entity.country ? `${flag(entity.country)} ${entity.country}` : '';
  const totalProds = summary?.total || 0;
  const summaryText = generateEntitySummary(entity, summary);
  const orgSlug = entity.github_org || entity.entity_id;
  const orgHref = `https://github.com/${orgSlug}`;

  const spannedLayers = layers.filter(l => (summary?.layers || []).includes(l.id));

  const sorted = useMemo(() => {
    if (!currentType) return [];
    const prods = products.filter(p => p.entity_id === entityId && p.product_type === currentType);
    return [...prods].sort((a, b) => {
      const ra = reposAttrsByPid[a.product_id], rb = reposAttrsByPid[b.product_id];
      const ma = modelsAttrsByPid[a.product_id], mb = modelsAttrsByPid[b.product_id];
      if (ra || rb) return (rb?.stars || 0) - (ra?.stars || 0);
      if (ma || mb) return (mb?.downloads || 0) - (ma?.downloads || 0);
      return (a.display_name || '').localeCompare(b.display_name || '');
    });
  }, [currentType, entityId, products, reposAttrsByPid, modelsAttrsByPid]);

  return (
    <>
      <div className="entity-summary-box">{summaryText}</div>

      <div className="entity-meta-row">
        {countryStr && <span className="em-item">{countryStr}</span>}
        <a className="em-link-pill" href={orgHref} target="_blank" rel="noopener">↗ GitHub</a>
        {entity.homepage && (
          <a className="em-link-pill" href={entity.homepage} target="_blank" rel="noopener">↗ Website</a>
        )}
        <span className="em-item" style={{ color: 'var(--ink-3)', fontSize: '12px' }}>
          {fmtN(totalProds)} products
        </span>
      </div>

      {spannedLayers.length > 0 && (
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {spannedLayers.map(l => (
            <span key={l.id} className="layer-chip" style={{ '--lc': LAYER_COLORS[l.id] }}>
              {l.display_name}
            </span>
          ))}
        </div>
      )}

      {allTypes.length > 0 && (
        <>
          <div className="type-tabs">
            {allTypes.map(t => (
              <button
                key={t}
                className={`type-tab${t === currentType ? ' active' : ''}`}
                onClick={() => setActiveType(t)}
              >
                {TYPE_LABELS[t] || t} <span className="type-tab-n">{fmtN(tc[t])}</span>
              </button>
            ))}
          </div>

          {sorted.length > 0 ? (
            <div className="proj-list" style={{ marginTop: '12px' }}>
              {sorted.slice(0, 40).map(p => (
                <ProductRow
                  key={p.product_id}
                  product={p}
                  entityMap={entityMap}
                  catMap={{}}
                  reposAttrsByPid={reposAttrsByPid}
                  modelsAttrsByPid={modelsAttrsByPid}
                  packagesAttrsByPid={packagesAttrsByPid}
                  showDesc
                  showCategory={currentType === 'repo'}
                  noEntity
                  noTypeBadge
                />
              ))}
              {sorted.length > 40 && (
                <div style={{ fontSize: '12px', color: 'var(--ink-3)', padding: '6px 0' }}>
                  …and {sorted.length - 40} more
                </div>
              )}
            </div>
          ) : (
            <div className="empty">No products of this type.</div>
          )}
        </>
      )}
    </>
  );
}
