import { useState, useMemo } from 'react';
import { LAYER_COLORS, TYPE_LABELS, TYPE_ORDER, GEO_PRESETS } from '../../explorer/constants.js';
import { flag, fmtN, entityName, entityTypeSimple, matchesPreset } from '../../explorer/helpers.js';

export function TeamsView({ layers, entitySummaries, entityTypeCount, loaded, searchQuery, onEntityClick }) {
  const [filter, setFilter] = useState({ type: '', country: '', productType: '' });
  const [countryPreset, setCountryPreset] = useState('all');

  const productTypeOptions = useMemo(() => {
    const allTypes = new Set();
    entitySummaries.forEach(e =>
      Object.keys(entityTypeCount[e.entity_id] || {}).forEach(t => allTypes.add(t))
    );
    return TYPE_ORDER.filter(t => allTypes.has(t));
  }, [entitySummaries, entityTypeCount]);

  const countries = useMemo(() =>
    [...new Set(entitySummaries.filter(e => e.country).map(e => e.country))].sort(),
    [entitySummaries]
  );

  const filtered = useMemo(() => {
    let list = entitySummaries.filter(e => e.total > 0);
    if (filter.type) {
      list = list.filter(e =>
        filter.type === 'individual' ? e.type === 'individual' : e.type !== 'individual'
      );
    }
    if (filter.productType) {
      list = list.filter(e => (entityTypeCount[e.entity_id] || {})[filter.productType] > 0);
    }
    if (countryPreset && countryPreset !== 'all') {
      list = list.filter(e => matchesPreset(e.country || null, countryPreset));
    } else if (filter.country) {
      list = list.filter(e => e.country === filter.country);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e =>
        (e.display_name || '').toLowerCase().includes(q) ||
        (e.entity_id || '').toLowerCase().includes(q) ||
        (e.aliases || []).some(a => a.toLowerCase().includes(q))
      );
    }
    return list;
  }, [entitySummaries, entityTypeCount, filter, countryPreset, searchQuery]);

  if (!loaded.phase2) {
    return <div className="loading" style={{ gridColumn: '1/-1' }}>Loading team data…</div>;
  }

  const handleCountryChange = (value) => {
    setFilter(f => ({ ...f, country: value }));
    if (value) setCountryPreset('all');
  };

  const handlePresetClick = (preset) => {
    setCountryPreset(preset);
    setFilter(f => ({ ...f, country: '' }));
  };

  return (
    <section>
      <div className="filter-bar">
        <div className="ctrl">
          <label>Entity type</label>
          <select value={filter.type} onChange={e => setFilter(f => ({ ...f, type: e.target.value }))}>
            <option value="">All types</option>
            <option value="individual">Individual</option>
            <option value="org">Organization</option>
          </select>
        </div>
        <div className="ctrl">
          <label>Products</label>
          <select value={filter.productType} onChange={e => setFilter(f => ({ ...f, productType: e.target.value }))}>
            <option value="">All products</option>
            {productTypeOptions.map(t => (
              <option key={t} value={t}>Has {TYPE_LABELS[t] || t}</option>
            ))}
          </select>
        </div>
        <div className="filter-bar-sep" />
        <div className="ctrl">
          <label>Geography</label>
          <div className="preset-bar">
            {GEO_PRESETS.map(p => (
              <button
                key={p.key}
                className={`preset-btn${countryPreset === p.key ? ' active' : ''}`}
                onClick={() => handlePresetClick(p.key)}
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

      <div className="repos-header">
        <strong>{fmtN(filtered.length)}</strong> teams
      </div>

      <div className="entity-grid">
        {filtered.length === 0 ? (
          <div className="empty" style={{ gridColumn: '1/-1' }}>No teams match — try removing a filter.</div>
        ) : (
          filtered.map(e => (
            <EntityCard
              key={e.entity_id}
              entity={e}
              layers={layers}
              entityTypeCount={entityTypeCount}
              onClick={() => onEntityClick(e.entity_id)}
            />
          ))
        )}
      </div>
    </section>
  );
}

function EntityCard({ entity, layers, entityTypeCount, onClick }) {
  const displayName = entityName(entity);
  const typeLabel = entityTypeSimple(entity);
  const typeClass = entity.type === 'individual' ? 'ec-type-individual' : 'ec-type-org';

  const spannedLayers = layers.filter(l => (entity.layers || []).includes(l.id));
  const visibleLayers = spannedLayers.slice(0, 3);
  const extraLayers = spannedLayers.length - 3;

  const tc = entityTypeCount[entity.entity_id] || {};
  const topTypes = Object.entries(tc)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([t, n]) => `${fmtN(n)} ${TYPE_LABELS[t] || t}`)
    .join(' · ');

  return (
    <div className="entity-card" onClick={onClick}>
      <div className="ec-head">
        <div className="ec-name">{displayName}</div>
        <span className={`ec-type-badge ${typeClass}`}>{typeLabel}</span>
      </div>
      <div className="ec-meta">{entity.country ? `${flag(entity.country)} ${entity.country}` : ' '}</div>
      <div className="ec-layers">
        {visibleLayers.length > 0 ? (
          <>
            {visibleLayers.map(l => (
              <span key={l.id} className="layer-chip" style={{ '--lc': LAYER_COLORS[l.id] }}>
                {l.display_name}
              </span>
            ))}
            {extraLayers > 0 && (
              <span className="layer-chip" style={{ '--lc': 'var(--ink-3)' }}>+{extraLayers}</span>
            )}
          </>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>—</span>
        )}
      </div>
      <div className="ec-compact-stats">{topTypes || '—'}</div>
    </div>
  );
}
