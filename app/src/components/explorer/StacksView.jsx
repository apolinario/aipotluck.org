import { useState, useMemo, useCallback } from 'react';
import { LAYER_COLORS, FLAGS, GEO_PRESETS } from '../../explorer/constants.js';
import { fmt, fmtN, flag, entityName } from '../../explorer/helpers.js';

const PRODUCT_GROUPS = [
  { key: '', label: 'All projects' },
  { key: 'repos', label: 'Repos' },
  { key: 'models', label: 'Models' },
  { key: 'packages', label: 'Packages' },
  { key: 'other', label: 'Other' },
];

const OPEN_CLOSED = [
  { key: '', label: 'All' },
  { key: 'open', label: 'OSS' },
  { key: 'closed', label: 'Closed' },
];

function CategoryCell({ cat, layerId, catEntityMap, entityMap, catCounts, loaded, onClick, claimedBy }) {
  const counts = catCounts[cat.id] || { open: 0, closed: 0 };
  const openN = counts.open;
  const closedN = counts.closed;
  const stackColor = LAYER_COLORS[layerId] || 'var(--ink-3)';

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
        <span key={e.entityId} className="chip chip-closed" title="Closed">
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
      style={{ '--stack-color': stackColor }}
      onClick={() => onClick(cat.id)}
    >
      <div className="cell-head">
        <span className="cell-name">{cat.display_name}</span>
        {claimedBy ? (
          <span className="cell-claimed-name">{claimedBy}</span>
        ) : (
          <button
            className="cell-claim-btn"
            onClick={(event) => {
              event.stopPropagation();
              onClick(cat.id);
            }}
          >
            Claim
          </button>
        )}
      </div>
      <div className="cell-meta">
        {openN > 0 && <><strong>{fmtN(openN)}</strong> OSS</>}
        {openN > 0 && closedN > 0 && ' · '}
        {closedN > 0 && <><strong>{fmtN(closedN)}</strong> closed</>}
        {openN === 0 && closedN === 0 && '—'}
      </div>
      <div className="cell-chips">{chips}</div>
    </div>
  );
}

function LayerRow({ layer, cats, catEntityMap, entityMap, catCounts, stackClaims, loaded, onCategoryClick }) {
  const lc = LAYER_COLORS[layer.id] || 'var(--ink-3)';
  const desc = layer.description || '';
  const truncated = desc.length > 88 ? desc.substring(0, 88) + '…' : desc;
  const totalOpen = layer.categories.reduce((s, c) => s + (catCounts[c.id]?.open || 0), 0);
  const totalClosed = layer.categories.reduce((s, c) => s + (catCounts[c.id]?.closed || 0), 0);

  return (
    <div className="layer-row">
      <div className="layer-label">
        <div className="num" style={{ color: lc }}>L{layer.sort_order}</div>
        <h3>{layer.display_name}</h3>
        <p>{truncated}</p>
        <div className="layer-counts">
          {totalOpen > 0 && <span className="lc-open">{fmt(totalOpen)} OSS</span>}
          {totalOpen > 0 && totalClosed > 0 && <span className="lc-sep">·</span>}
          {totalClosed > 0 && <span className="lc-closed">{fmt(totalClosed)} closed</span>}
          {totalOpen === 0 && totalClosed === 0 && <span className="lc-open">—</span>}
        </div>
      </div>
      <div className="layer-cells">
        {cats.map(c => (
          <CategoryCell
            key={c.id}
            cat={c}
            layerId={layer.id}
            catEntityMap={catEntityMap}
            entityMap={entityMap}
            catCounts={catCounts}
            claimedBy={stackClaims?.[c.id]}
            loaded={loaded}
            onClick={onCategoryClick}
          />
        ))}
      </div>
    </div>
  );
}

export function StacksView({ layers, catEntityMap, entityMap, catCounts, stackClaims, searchQuery, loaded, onCategoryClick, onFilterChange }) {
  const [filter, setFilter] = useState({ productGroup: '', openClosed: '', countryPreset: 'all', country: '' });

  const updateFilter = useCallback((patch) => {
    setFilter(prev => {
      const next = { ...prev, ...patch };
      const hasFilter = next.productGroup || next.openClosed || (next.countryPreset && next.countryPreset !== 'all') || next.country;
      onFilterChange(hasFilter ? next : null);
      return next;
    });
  }, [onFilterChange]);

  const handlePreset = useCallback((key) => {
    updateFilter({ countryPreset: key, country: '' });
  }, [updateFilter]);

  const handleCountryChange = useCallback((val) => {
    updateFilter({ country: val, countryPreset: val ? 'all' : filter.countryPreset });
  }, [updateFilter, filter.countryPreset]);

  const countries = useMemo(() => {
    const all = Object.values(entityMap);
    return [...new Set(all.map(e => e.country).filter(c => c && FLAGS[c]))].sort();
  }, [entityMap]);

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
    <>
      <div className="filter-bar">
        <div className="ctrl">
          <label>Projects</label>
          <select value={filter.productGroup} onChange={e => updateFilter({ productGroup: e.target.value })}>
            {PRODUCT_GROUPS.map(g => (
              <option key={g.key} value={g.key}>{g.label}</option>
            ))}
          </select>
        </div>
        <div className="ctrl">
          <label>Licensing</label>
          <div className="preset-bar">
            {OPEN_CLOSED.map(o => (
              <button
                key={o.key}
                className={`preset-btn${filter.openClosed === o.key ? ' active' : ''}`}
                onClick={() => updateFilter({ openClosed: o.key })}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-bar-sep" />
        <div className="ctrl">
          <label>Geography</label>
          <div className="preset-bar">
            {GEO_PRESETS.map(p => (
              <button
                key={p.key}
                className={`preset-btn${filter.countryPreset === p.key && !filter.country ? ' active' : ''}`}
                onClick={() => handlePreset(p.key)}
              >
                {p.label}
              </button>
            ))}
            <select
              value={filter.country}
              onChange={e => handleCountryChange(e.target.value)}
              style={{ marginLeft: 4 }}
              className="preset-btn"
            >
              <option value="">Other…</option>
              {countries.map(c => (
                <option key={c} value={c}>{flag(c)} {c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="stack-grid">
        {filteredLayers.map(({ layer, cats }) => (
          <LayerRow
            key={layer.id}
            layer={layer}
            cats={cats}
            catEntityMap={catEntityMap}
            entityMap={entityMap}
            catCounts={catCounts}
            stackClaims={stackClaims}
            loaded={loaded}
            onCategoryClick={onCategoryClick}
          />
        ))}
      </div>
    </>
  );
}
