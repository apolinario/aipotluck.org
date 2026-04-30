import { useMemo } from 'react';
import { LAYER_COLORS } from '../../explorer/constants.js';
import { fmt, fmtN, entityName, bucketFromVerdict, verdictShort } from '../../explorer/helpers.js';

function CategoryCell({ cat, catEntityMap, entityMap, loaded, onClick }) {
  const bucket = bucketFromVerdict(cat.parity_verdict);
  const openN = cat.open_contributions || 0;

  let chips;
  if (loaded.phase2) {
    const ed = catEntityMap[cat.id] || { open: [], closed: [] };
    const openChips = ed.open.slice(0, 3).map(e => {
      const ent = entityMap[e.entityId];
      return (
        <span key={e.entityId} className="chip">
          {entityName(ent) || e.entityId}
        </span>
      );
    });
    const closedChips = ed.closed.slice(0, 1).map(e => {
      const ent = entityMap[e.entityId];
      return (
        <span key={e.entityId} className="chip chip-closed" title="Closed source">
          {entityName(ent) || e.entityId}
        </span>
      );
    });
    const more = Math.max(0, (ed.open.length - 3) + (ed.closed.length - 1));
    const allChips = [...openChips, ...closedChips];
    if (more > 0) allChips.push(<span key="more" className="chip chip-more">+{more}</span>);
    chips = allChips.length > 0 ? allChips : <span className="chip chip-empty">No products mapped</span>;
  } else {
    chips = <span className="chip chip-empty" style={{ opacity: 0.3 }}>Loading…</span>;
  }

  return (
    <div
      className="cell"
      data-cat-id={cat.id}
      data-health={bucket}
      onClick={() => onClick(cat.id)}
    >
      <div className="cell-head">
        <span className="cell-name">{cat.display_name}</span>
        <span className={`cell-verdict verdict-${bucket}`}>{verdictShort(cat.parity_verdict)}</span>
      </div>
      <div className="cell-meta">
        <strong>{fmtN(openN)}</strong> OSS · <em>{cat.maturity || '—'}</em>
      </div>
      <div className="cell-chips">{chips}</div>
    </div>
  );
}

function LayerRow({ layer, cats, catEntityMap, entityMap, loaded, onCategoryClick }) {
  const lc = LAYER_COLORS[layer.id] || 'var(--ink-3)';
  const desc = layer.description || '';
  const truncated = desc.length > 88 ? desc.substring(0, 88) + '…' : desc;
  const totalOpen = layer.categories.reduce((s, c) => s + (c.open_contributions || 0), 0);
  const totalClosed = layer.categories.reduce((s, c) => s + (c.closed_contributions || 0), 0);

  return (
    <div className="layer-row">
      <div className="layer-label">
        <div className="num" style={{ color: lc }}>L{layer.sort_order}</div>
        <h3>{layer.display_name}</h3>
        <p>{truncated}</p>
        <div className="layer-counts">
          <span className="lc-open">{fmt(totalOpen)} OSS</span>
          <span className="lc-sep">·</span>
          <span className="lc-closed">{fmt(totalClosed)} closed</span>
        </div>
      </div>
      <div className="layer-cells">
        {cats.map(c => (
          <CategoryCell
            key={c.id}
            cat={c}
            catEntityMap={catEntityMap}
            entityMap={entityMap}
            loaded={loaded}
            onClick={onCategoryClick}
          />
        ))}
      </div>
    </div>
  );
}

export function StacksView({ layers, catEntityMap, entityMap, searchQuery, loaded, onCategoryClick }) {
  const filteredLayers = useMemo(() => {
    if (!loaded.phase1) return [];
    const q = (searchQuery || '').toLowerCase();
    if (!q) return layers.map(l => ({ layer: l, cats: l.categories }));
    return layers
      .map(l => ({
        layer: l,
        cats: l.categories.filter(c =>
          c.display_name.toLowerCase().includes(q) || c.id.includes(q)
        ),
      }))
      .filter(({ cats }) => cats.length > 0);
  }, [layers, searchQuery, loaded.phase1]);

  if (!loaded.phase1) {
    return <div className="loading">Loading the open-source AI map…</div>;
  }

  if (filteredLayers.length === 0) {
    return <div className="empty">No categories match your search.</div>;
  }

  return (
    <div className="stack-grid">
      {filteredLayers.map(({ layer, cats }) => (
        <LayerRow
          key={layer.id}
          layer={layer}
          cats={cats}
          catEntityMap={catEntityMap}
          entityMap={entityMap}
          loaded={loaded}
          onCategoryClick={onCategoryClick}
        />
      ))}
    </div>
  );
}
