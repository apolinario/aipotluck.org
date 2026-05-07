import { useState, useEffect, useMemo, Fragment } from 'react';
import {
  FLAGS, GEO_PRESETS, PRODUCT_GROUP_TYPES, PRODUCT_GROUP_LABELS,
  PRODUCT_COLUMNS, PRODUCT_SORT_DEFAULTS, TYPE_LABEL_S,
} from '../../explorer/constants.js';
import { flag, fmt, fmtN, entityName, matchesPreset } from '../../explorer/helpers.js';

const ChevronDown = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    style={{ verticalAlign: '-1px' }}><path d="M6 9l6 6 6-6" /></svg>
);
const ChevronUp = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    style={{ verticalAlign: '-1px' }}><path d="M18 15l-6-6-6 6" /></svg>
);

const GROUP_KEYS = ['repos', 'models', 'packages', 'other'];

export function ProductsView({
  layers, products, catMap, entityMap,
  reposAttrsByPid, modelsAttrsByPid, packagesAttrsByPid,
  loaded, loadRepos, searchQuery,
  onRepoClick, onProductClick,
  productGroup, onGroupChange,
}) {
  const columns = PRODUCT_COLUMNS[productGroup] || PRODUCT_COLUMNS.repos;
  const [sort, setSort] = useState(PRODUCT_SORT_DEFAULTS[productGroup] || { col: 'name', dir: 'asc' });
  const [filter, setFilter] = useState({ layer: '', country: '' });
  const [countryPreset, setCountryPreset] = useState('all');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => { loadRepos(); }, [loadRepos]);

  useEffect(() => {
    setSort(PRODUCT_SORT_DEFAULTS[productGroup] || { col: 'name', dir: 'asc' });
    setFilter({ layer: '', country: '' });
    setCountryPreset('all');
    setPage(0);
  }, [productGroup]);

  const countries = useMemo(() => {
    if (productGroup === 'repos') {
      const all = Object.values(reposAttrsByPid);
      return [...new Set(all.map(r => r.country).filter(c => c && FLAGS[c]))].sort();
    }
    const types = PRODUCT_GROUP_TYPES[productGroup];
    const entityIds = new Set(
      products.filter(p => types?.has(p.product_type)).map(p => p.entity_id).filter(Boolean)
    );
    return [...new Set(
      [...entityIds].map(eid => entityMap[eid]?.country).filter(c => c && FLAGS[c])
    )].sort();
  }, [reposAttrsByPid, productGroup, products, entityMap]);

  const repoSlugToPid = useMemo(() => {
    const m = {};
    for (const p of products) {
      if (p.product_type === 'repo') {
        const slug = (p.product_id || '').replace('repo:', '');
        if (slug) m[slug] = p.product_id;
      }
    }
    return m;
  }, [products]);

  const filtered = useMemo(() => {
    const q = (searchQuery || '').toLowerCase();
    const types = PRODUCT_GROUP_TYPES[productGroup];
    let list = types ? products.filter(p => types.has(p.product_type)) : products;

    if (filter.layer) list = list.filter(p => p.category_id?.startsWith(filter.layer + '.'));

    const countryOf = (p) =>
      productGroup === 'repos'
        ? (reposAttrsByPid[p.product_id]?.country || null)
        : (entityMap[p.entity_id]?.country || null);

    if (countryPreset && countryPreset !== 'all') {
      list = list.filter(p => matchesPreset(countryOf(p), countryPreset));
    } else if (filter.country) {
      list = list.filter(p => (countryOf(p) || '') === filter.country);
    }

    if (q) {
      list = list.filter(p => {
        const name = (p.display_name || '').toLowerCase();
        const entName = (entityMap[p.entity_id]?.display_name || '').toLowerCase();
        const repoDesc = (reposAttrsByPid[p.product_id]?.description || '').toLowerCase();
        return name.includes(q) || entName.includes(q) || repoDesc.includes(q);
      });
    }

    list = list.map(p => {
      const repoAttrs = reposAttrsByPid[p.product_id] || {};
      const modelAttrs = modelsAttrsByPid[p.product_id] || {};
      const pkgAttrs = packagesAttrsByPid[p.product_id] || {};
      return { ...p, ...repoAttrs, ...modelAttrs, ...pkgAttrs };
    });

    const { col, dir } = sort;
    list.sort((a, b) => {
      let diff = 0;
      if (col === 'stars') diff = (b.stars || 0) - (a.stars || 0);
      else if (col === 'star7d') diff = (b.star_7d || 0) - (a.star_7d || 0);
      else if (col === 'commits90') diff = (b.commits_90d || 0) - (a.commits_90d || 0);
      else if (col === 'downloads') diff = (b.downloads || 0) - (a.downloads || 0);
      else if (col === 'likes') diff = (b.likes || 0) - (a.likes || 0);
      else if (col === 'entity') diff = (entityMap[a.entity_id]?.display_name || '').localeCompare(entityMap[b.entity_id]?.display_name || '');
      else if (col === 'name') diff = (a.display_name || '').localeCompare(b.display_name || '');
      else if (col === 'package_name') diff = (a.package_name || '').localeCompare(b.package_name || '');
      return dir === 'asc' ? -diff : diff;
    });

    return list;
  }, [products, productGroup, reposAttrsByPid, modelsAttrsByPid, packagesAttrsByPid, entityMap, filter, countryPreset, searchQuery, sort]);

  useEffect(() => { setPage(0); }, [filter, countryPreset, searchQuery, sort]);

  if (!loaded.repos) {
    return <div className="loading">Loading product data…</div>;
  }

  const total = filtered.length;
  const start = page * pageSize;
  const end = Math.min(start + pageSize, total);
  const slice = filtered.slice(start, end);
  const totalPages = Math.ceil(total / pageSize) || 1;

  const handleSort = (col) => {
    if (sort.col === col) setSort({ col, dir: sort.dir === 'desc' ? 'asc' : 'desc' });
    else setSort({ col, dir: 'desc' });
  };

  const handlePreset = (key) => {
    setCountryPreset(key);
    setFilter(f => ({ ...f, country: '' }));
  };

  const handleCountryChange = (val) => {
    setFilter(f => ({ ...f, country: val }));
    if (val) setCountryPreset('all');
  };

  const handleRowClick = (p) => {
    if (p.product_type === 'repo') {
      onRepoClick(p.product_id);
    } else if (onProductClick) {
      onProductClick(p.product_id);
    }
  };

  const SortHeader = ({ col, children }) => (
    <div
      data-sort={col}
      className={sort.col === col ? 'sorted' : ''}
      style={{ cursor: 'pointer' }}
      onClick={() => handleSort(col)}
    >
      {children}
      {sort.col === col && (sort.dir === 'desc' ? <ChevronDown /> : <ChevronUp />)}
    </div>
  );

  const gridCols = columns.map(c => c.width).join(' ');

  const renderCell = (p, colKey) => {
    const cat = catMap[p.category_id];
    const entity = entityMap[p.entity_id];
    const entName = entityName(entity) || p.entity_id || '—';

    switch (colKey) {
      case 'entity':
        return (
          <div className="col-entity" style={{ flexDirection: 'row', alignItems: 'center', gap: '5px' }}>
            <span className="col-entity-name">{entName}</span>
            {entity?.country && <span className="col-entity-flag">{flag(entity.country)}</span>}
          </div>
        );
      case 'name': {
        const slug = p.product_type === 'repo' ? (p.product_id || '').replace('repo:', '') : null;
        const artifactName = slug || p.display_name;
        const href = p.url || (slug ? `https://github.com/${slug}` : '');
        const desc = p.description || '';
        return (
          <div className="col-repo">
            {href ? (
              <a className="name" href={href} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}>
                {artifactName}
              </a>
            ) : (
              <span className="name">{artifactName}</span>
            )}
            {desc && <span className="desc">{desc.substring(0, 72)}</span>}
          </div>
        );
      }
      case 'category':
        return <div className="col-sub" style={{ fontSize: '11px', color: 'var(--ink-3)' }}>{cat?.display_name || '—'}</div>;
      case 'stars':
        return <div className="col-num">{fmt(p.stars || 0)}</div>;
      case 'star7d':
        return (
          <div className="col-num">
            {(p.star_7d || 0) > 0
              ? <span style={{ color: 'var(--healthy)' }}>+{fmt(p.star_7d)}</span>
              : <span style={{ color: 'var(--ink-3)' }}>—</span>}
          </div>
        );
      case 'commits90':
        return <div className="col-num">{fmt(p.commits_90d || 0)}</div>;
      case 'language':
        return <div className="col-sub">{p.language || '—'}</div>;
      case 'license':
        return <div className="col-sub" style={{ color: 'var(--ink-3)', fontSize: '11.5px' }}>{p.license || '—'}</div>;
      case 'pipeline':
        return <div className="col-sub">{(p.pipeline_tag || '—').replace(/-/g, ' ')}</div>;
      case 'downloads':
        return <div className="col-num">{(p.downloads || 0) > 0 ? fmt(p.downloads) : '—'}</div>;
      case 'likes':
        return <div className="col-num">{(p.likes || 0) > 0 ? `♥ ${fmt(p.likes)}` : '—'}</div>;
      case 'library':
        return <div className="col-sub">{p.library_name || '—'}</div>;
      case 'source':
        return <div className="col-sub">{p.package_source || '—'}</div>;
      case 'package_name':
        return <div className="col-sub" style={{ fontFamily: "'DM Mono', monospace", fontSize: '11.5px' }}>{p.package_name || '—'}</div>;
      case 'linked_repo': {
        const repoSlug = p.repo;
        if (!repoSlug) return <div className="col-sub" style={{ color: 'var(--ink-3)' }}>—</div>;
        const linkedPid = repoSlugToPid[repoSlug];
        return (
          <div className="col-sub">
            {linkedPid ? (
              <button
                className="linked-repo-btn"
                onClick={(e) => { e.stopPropagation(); onRepoClick(linkedPid); }}
              >
                {repoSlug.split('/').pop()}
              </button>
            ) : (
              <span style={{ color: 'var(--ink-3)', fontSize: '11px' }}>{repoSlug.split('/').pop()}</span>
            )}
          </div>
        );
      }
      case 'type':
        return <div className="col-sub">{TYPE_LABEL_S[p.product_type] || p.product_type}</div>;
      case 'open':
        return <div className="col-sub">{p.is_open ? '✓' : '—'}</div>;
      default:
        return <div className="col-sub">—</div>;
    }
  };

  return (
    <>
      {/* Type segment control + Filter bar */}
      <div className="filter-bar">
        <div className="ctrl">
          <label>Product type</label>
          <div className="preset-bar">
            {GROUP_KEYS.map(gk => (
              <button
                key={gk}
                className={`preset-btn${productGroup === gk ? ' active' : ''}`}
                onClick={() => onGroupChange(gk)}
              >
                {PRODUCT_GROUP_LABELS[gk]}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-bar-sep" />

        <div className="ctrl">
          <label>Layer</label>
          <select value={filter.layer} onChange={e => setFilter(f => ({ ...f, layer: e.target.value }))}>
            <option value="">All layers</option>
            {layers.map(l => <option key={l.id} value={l.id}>{l.display_name}</option>)}
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
                onClick={() => handlePreset(p.key)}
              >
                {p.label}
              </button>
            ))}
            <select
              value={filter.country}
              onChange={e => handleCountryChange(e.target.value)}
              style={{ marginLeft: 4, width: 90 }}
              className="preset-btn"
            >
              <option value="">Other…</option>
              {countries.map(v => <option key={v} value={v}>{flag(v)} {v}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="repos-header">
        <strong>{fmtN(total)}</strong> {PRODUCT_GROUP_LABELS[productGroup]?.toLowerCase() || 'products'}
      </div>

      {/* Table */}
      <div className="table-wrap">
        <div className="table-head" style={{ gridTemplateColumns: gridCols }}>
          {columns.map(c => (
            c.sortable
              ? <SortHeader key={c.key} col={c.key}>{c.label}</SortHeader>
              : <div key={c.key}>{c.label}</div>
          ))}
        </div>
        <div className="table-scroll">
          {slice.length === 0 ? (
            <div className="empty">No {PRODUCT_GROUP_LABELS[productGroup]?.toLowerCase() || 'products'} match your filters.</div>
          ) : (
            slice.map(p => (
              <div
                key={p.product_id}
                className="table-row"
                style={{ gridTemplateColumns: gridCols }}
                onClick={() => handleRowClick(p)}
              >
                {columns.map(c => (
                  <Fragment key={c.key}>
                    {renderCell(p, c.key)}
                  </Fragment>
                ))}
              </div>
            ))
          )}
        </div>
        <div className="table-pager">
          <span className="pg-range">
            Showing {total ? start + 1 : 0}–{end} of {fmtN(total)}
          </span>
          <div className="pg-controls">
            <select
              className="pg-select"
              value={pageSize}
              onChange={e => { setPageSize(parseInt(e.target.value, 10)); setPage(0); }}
            >
              {[25, 50, 100].map(n => (
                <option key={n} value={n}>{n} / page</option>
              ))}
            </select>
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span style={{ fontSize: '12px', padding: '0 6px' }}>Page {page + 1} / {totalPages}</span>
            <button disabled={end >= total} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        </div>
      </div>
    </>
  );
}
