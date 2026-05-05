import { useState, useMemo } from 'react';
import { TYPE_ORDER, TYPE_LABELS, VERDICT_CLASS } from '../../explorer/constants.js';
import { fmtN, bucketFromVerdict, verdictShort, verdictLong } from '../../explorer/helpers.js';
import { ProductRow } from './ProductRow.jsx';

export function CategoryDrawerContent({
  catId, layers, catMap, productsByCat, entityMap,
  reposAttrsByPid, modelsAttrsByPid, packagesAttrsByPid,
  onEntityClick,
}) {
  const cat = catMap[catId];
  const products = productsByCat[catId] || [];
  const verdictAC = VERDICT_CLASS[cat?.parity_verdict] || 'gap';

  const byType = useMemo(() => {
    const m = {};
    for (const p of products) {
      if (!m[p.product_type]) m[p.product_type] = [];
      m[p.product_type].push(p);
    }
    return m;
  }, [products]);

  const allTypes = useMemo(() => TYPE_ORDER.filter(t => byType[t]), [byType]);
  const [activeType, setActiveType] = useState(null);
  const currentType = activeType ?? allTypes[0] ?? null;
  const [showAll, setShowAll] = useState(false);

  const sortByStars = (arr) => [...arr].sort((a, b) => {
    const byStars = (reposAttrsByPid[b.product_id]?.stars || 0) - (reposAttrsByPid[a.product_id]?.stars || 0);
    if (byStars !== 0) return byStars;
    return (modelsAttrsByPid[b.product_id]?.downloads || 0) - (modelsAttrsByPid[a.product_id]?.downloads || 0);
  });

  if (!cat) return <div className="empty">Category not found.</div>;

  const openProds = products.filter(p => p.is_open);
  const closedProds = products.filter(p => !p.is_open);
  const sorted = currentType && byType[currentType] ? sortByStars(byType[currentType]) : [];
  const visible = showAll ? sorted : sorted.slice(0, 20);

  return (
    <>
      <div className="stat-strip">
        <div className="stat-item">
          <div className="sl">Verdict</div>
          <div className="sv">
            <span className={`cell-verdict verdict-${bucketFromVerdict(cat.parity_verdict)}`}
              style={{ fontSize: '11px' }}>
              {verdictLong(cat.parity_verdict)}
            </span>
          </div>
        </div>
        <div className="stat-item">
          <div className="sl">Gap score</div>
          <div className="sv mono">
            {cat.gap_score ?? '—'}<span style={{ fontSize: '11px', color: 'var(--ink-3)' }}>/5</span>
          </div>
        </div>
        <div className="stat-item">
          <div className="sl">OSS</div>
          <div className="sv mono">{fmtN(openProds.length)}</div>
        </div>
        <div className="stat-item">
          <div className="sl">Closed</div>
          <div className="sv mono">{fmtN(closedProds.length)}</div>
        </div>
      </div>

      {cat.parity_rationale && (
        <div className={`analysis-card analysis-card--${verdictAC}`}>
          <div className="lab">Parity analysis</div>
          <p>{cat.parity_rationale}</p>
        </div>
      )}

      {allTypes.length > 0 && (
        <>
          <div className="type-tabs">
            {allTypes.map(t => (
              <button
                key={t}
                className={`type-tab${t === currentType ? ' active' : ''}`}
                onClick={() => { setActiveType(t); setShowAll(false); }}
              >
                {TYPE_LABELS[t] || t} <span className="type-tab-n">{fmtN(byType[t].length)}</span>
              </button>
            ))}
          </div>

          {currentType && byType[currentType] ? (
            <>
              <div className="proj-list" style={{ marginTop: '10px' }}>
                {visible.map(p => (
                  <ProductRow
                    key={p.product_id}
                    product={p}
                    entityMap={entityMap}
                    catMap={catMap}
                    reposAttrsByPid={reposAttrsByPid}
                    modelsAttrsByPid={modelsAttrsByPid}
                    packagesAttrsByPid={packagesAttrsByPid}
                    showDesc
                    showTeam
                    noTypeBadge
                  />
                ))}
              </div>
              {!showAll && sorted.length > 20 && (
                <button className="load-more-btn" onClick={() => setShowAll(true)}>
                  Show all {sorted.length} →
                </button>
              )}
            </>
          ) : (
            <div className="empty">No products of this type.</div>
          )}
        </>
      )}

    </>
  );
}
