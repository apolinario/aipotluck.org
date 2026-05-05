import { ENTITY_TYPE_LABELS, VERDICT_CLASS } from '../../explorer/constants.js';
import { fmt, fmtN, entityName, flag, bucketFromVerdict, verdictLong } from '../../explorer/helpers.js';
import { ProductRow } from './ProductRow.jsx';

export function RepoDrawerContent({
  productId, layers, catMap, entityMap, products, entitySummaries,
  reposAttrsByPid, modelsAttrsByPid, packagesAttrsByPid,
  onEntityClick, onCategoryClick,
}) {
  const p = products.find(prod => prod.product_id === productId);
  if (!p) return <div className="empty">Product not found.</div>;

  const r = reposAttrsByPid[productId] || {};
  const entity = entityMap[p.entity_id];
  const cat = catMap[p.category_id];
  const layer = layers.find(l => l.id === cat?.layer_id);

  const slug = (productId || '').replace('repo:', '');
  const href = p.url || `https://github.com/${slug}`;
  const orgSlug = slug.split('/')[0];
  const orgHref = `https://github.com/${orgSlug}`;

  const stats = [
    r.stars && { label: 'Stars', val: `★ ${fmt(r.stars)}` },
    r.star_7d > 0 && { label: '+7d', val: `+${fmt(r.star_7d)}`, color: 'var(--healthy)' },
    r.commits_90d && { label: 'Commits/90d', val: fmt(r.commits_90d) },
    r.language && { label: 'Language', val: r.language },
    r.license && { label: 'License', val: r.license },
  ].filter(Boolean);

  const entSummary = entitySummaries.find(s => s.entity_id === entity?.entity_id);
  const related = entity
    ? products.filter(p2 =>
        p2.entity_id === entity.entity_id &&
        p2.product_id !== productId &&
        ['model', 'package', 'dataset', 'eval_harness'].includes(p2.product_type)
      ).slice(0, 4)
    : [];

  return (
    <>
      <div className="stat-strip">
        {stats.map(s => (
          <div key={s.label} className="stat-item">
            <div className="sl">{s.label}</div>
            <div className="sv mono" style={s.color ? { color: s.color } : undefined}>{s.val}</div>
          </div>
        ))}
      </div>

      {r.description && (
        <div className="repo-desc-box">{r.description}</div>
      )}

      {cat && (
        <>
          <div className="section-h">Stack context</div>
          <div className="context-card">
            <div className="ctx-breadcrumb">
              {layer?.display_name || ''} › <strong>{cat.display_name}</strong>
            </div>
            <div style={{ marginTop: '6px' }}>
              <span className={`cell-verdict verdict-${bucketFromVerdict(cat.parity_verdict)}`}
                style={{ fontSize: '11px' }}>
                {verdictLong(cat.parity_verdict)}
              </span>
            </div>
            {cat.parity_rationale && (
              <p className="ctx-rationale">{cat.parity_rationale}</p>
            )}
          </div>
        </>
      )}

      {entity && (
        <>
          <div className="section-h">Maintained by</div>
          <div className="proj" style={{ cursor: 'pointer' }} onClick={() => onEntityClick(entity.entity_id)}>
            <div className="proj-row1">
              <span className="proj-badge">
                {ENTITY_TYPE_LABELS[entity.type] || entity.type || ''}
              </span>
              <span className="proj-name" style={{ fontSize: '13.5px', fontFamily: 'inherit', fontWeight: 600 }}>
                {entityName(entity)}
              </span>
              {entity.country && (
                <span style={{ fontSize: '12px', color: 'var(--ink-3)' }}>
                  {flag(entity.country)} {entity.country}
                </span>
              )}
            </div>
            <div className="proj-row2">
              {fmtN(entSummary?.total || 0)} products ·{' '}
              <a href={orgHref} target="_blank" rel="noopener"
                onClick={e => e.stopPropagation()} style={{ color: 'var(--accent)' }}>
                ↗ GitHub org
              </a>
              {entity.homepage && (
                <>
                  {' · '}
                  <a href={entity.homepage} target="_blank" rel="noopener"
                    onClick={e => e.stopPropagation()} style={{ color: 'var(--accent)' }}>
                    ↗ Website
                  </a>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {related.length > 0 && (
        <>
          <div className="section-h">More from {entityName(entity) || 'this org'}</div>
          <div className="proj-list">
            {related.map(rp => (
              <ProductRow
                key={rp.product_id}
                product={rp}
                entityMap={entityMap}
                catMap={catMap}
                reposAttrsByPid={reposAttrsByPid}
                modelsAttrsByPid={modelsAttrsByPid}
                packagesAttrsByPid={packagesAttrsByPid}
                showDesc
                noEntity
              />
            ))}
          </div>
        </>
      )}

      <div style={{
        marginTop: '22px', paddingTop: '14px',
        borderTop: '1px solid var(--rule-soft)',
        display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap',
      }}>
        <a href={href} target="_blank" rel="noopener"
          className="pill primary" style={{ textDecoration: 'none' }}>
          ↗ View on GitHub
        </a>
        {entity && (
          <button className="pill" onClick={() => onEntityClick(entity.entity_id)}>
            View {entityName(entity) || 'team'} →
          </button>
        )}
        {cat && (
          <button className="pill" onClick={() => onCategoryClick(cat.id)}>
            View {cat.display_name} →
          </button>
        )}
      </div>
    </>
  );
}
