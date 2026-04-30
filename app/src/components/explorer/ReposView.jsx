import { useState, useEffect, useMemo } from 'react';
import { FLAGS } from '../../explorer/constants.js';
import { flag, fmt, fmtN, entityName, matchesPreset } from '../../explorer/helpers.js';

const LICENSES = ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'GPL-3.0', 'LGPL-2.1', 'MPL-2.0', 'AGPL-3.0'];

const PRESETS = [
  { key: 'all', label: 'All' },
  { key: 'us', label: '🇺🇸 US' },
  { key: 'cn', label: '🇨🇳 China' },
  { key: 'eu', label: '🇪🇺 EU' },
  { key: 'ex-us-cn', label: 'Excl. US+CN' },
  { key: 'other', label: 'Rest of world' },
];

const SORT_LABELS = {
  stars: 'stars', star7d: '+stars / 7d', commits90: 'commits / 90d', name: 'name', entity: 'team',
};

const ChevronDown = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    style={{ verticalAlign: '-1px' }}><path d="M6 9l6 6 6-6" /></svg>
);
const ChevronUp = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    style={{ verticalAlign: '-1px' }}><path d="M18 15l-6-6-6 6" /></svg>
);

export function ReposView({
  layers, products, catMap, entityMap, reposAttrsByPid,
  loaded, loadRepos, onRepoClick, searchQuery,
}) {
  const [sort, setSort] = useState({ col: 'stars', dir: 'desc' });
  const [filter, setFilter] = useState({ layer: '', country: '', lang: '', license: '' });
  const [countryPreset, setCountryPreset] = useState('all');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => { loadRepos(); }, [loadRepos]);

  const languages = useMemo(() => {
    const all = Object.values(reposAttrsByPid);
    return [...new Set(all.map(r => r.language).filter(Boolean))].sort().slice(0, 40);
  }, [reposAttrsByPid]);

  const countries = useMemo(() => {
    const all = Object.values(reposAttrsByPid);
    return [...new Set(all.map(r => r.country).filter(c => c && FLAGS[c]))].sort();
  }, [reposAttrsByPid]);

  const filtered = useMemo(() => {
    const q = (searchQuery || '').toLowerCase();
    let list = products.filter(p => p.product_type === 'repo');

    if (filter.layer) list = list.filter(p => p.category_id?.startsWith(filter.layer + '.'));
    if (countryPreset && countryPreset !== 'all') {
      list = list.filter(p => matchesPreset(reposAttrsByPid[p.product_id]?.country || null, countryPreset));
    } else if (filter.country) {
      list = list.filter(p => (reposAttrsByPid[p.product_id]?.country || '') === filter.country);
    }
    if (filter.lang) list = list.filter(p => (reposAttrsByPid[p.product_id]?.language || '') === filter.lang);
    if (filter.license) list = list.filter(p => (reposAttrsByPid[p.product_id]?.license || '') === filter.license);
    if (q) {
      list = list.filter(p =>
        (p.display_name || '').toLowerCase().includes(q) ||
        (reposAttrsByPid[p.product_id]?.description || '').toLowerCase().includes(q) ||
        (entityMap[p.entity_id]?.display_name || '').toLowerCase().includes(q)
      );
    }

    list = list.map(p => ({ ...p, ...(reposAttrsByPid[p.product_id] || {}) }));

    const { col, dir } = sort;
    list.sort((a, b) => {
      let diff = 0;
      if (col === 'stars') diff = (b.stars || 0) - (a.stars || 0);
      else if (col === 'star7d') diff = (b.star_7d || 0) - (a.star_7d || 0);
      else if (col === 'commits90') diff = (b.commits_90d || 0) - (a.commits_90d || 0);
      else if (col === 'entity') diff = (entityMap[a.entity_id]?.display_name || '').localeCompare(entityMap[b.entity_id]?.display_name || '');
      else if (col === 'name') diff = (a.display_name || '').localeCompare(b.display_name || '');
      return dir === 'asc' ? -diff : diff;
    });

    return list;
  }, [products, reposAttrsByPid, entityMap, filter, countryPreset, searchQuery, sort]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [filter, countryPreset, searchQuery, sort]);

  if (!loaded.repos) {
    return <div className="loading">Loading repository data…</div>;
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

  return (
    <>
      {/* Filter bar */}
      <div className="filter-bar">
        <div className="ctrl">
          <label>Layer</label>
          <select value={filter.layer} onChange={e => setFilter(f => ({ ...f, layer: e.target.value }))}>
            <option value="">All layers</option>
            {layers.map(l => <option key={l.id} value={l.id}>{l.display_name}</option>)}
          </select>
        </div>
        <div className="ctrl">
          <label>Language</label>
          <select value={filter.lang} onChange={e => setFilter(f => ({ ...f, lang: e.target.value }))}>
            <option value="">All languages</option>
            {languages.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="ctrl">
          <label>License</label>
          <select value={filter.license} onChange={e => setFilter(f => ({ ...f, license: e.target.value }))}>
            <option value="">All licenses</option>
            {LICENSES.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="filter-bar-sep" />
        <div className="ctrl">
          <label>Geography</label>
          <div className="preset-bar">
            {PRESETS.map(p => (
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
              style={{ marginLeft: 4 }}
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
        <strong>{fmtN(total)}</strong> repos · sorted by <span>{SORT_LABELS[sort.col] || sort.col}</span>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <div className="table-head">
          <SortHeader col="entity">Maintained by</SortHeader>
          <SortHeader col="name">Repository</SortHeader>
          <div>Category</div>
          <SortHeader col="stars">Stars</SortHeader>
          <SortHeader col="star7d">+7d</SortHeader>
          <SortHeader col="commits90">Commits/90d</SortHeader>
          <div>Language</div>
          <div>License</div>
        </div>
        <div className="table-scroll">
          {slice.length === 0 ? (
            <div className="empty">No repos match your filters.</div>
          ) : (
            slice.map(p => {
              const cat = catMap[p.category_id];
              const entity = entityMap[p.entity_id];
              const slug = (p.product_id || '').replace('repo:', '');
              const href = p.url || `https://github.com/${slug}`;
              const entName = entityName(entity) || p.entity_id || '—';

              return (
                <div
                  key={p.product_id}
                  className="table-row"
                  onClick={() => onRepoClick(p.product_id)}
                >
                  <div className="col-entity" style={{ flexDirection: 'row', alignItems: 'center', gap: '5px' }}>
                    <span className="col-entity-name">{entName}</span>
                    {entity?.country && <span className="col-entity-flag">{flag(entity.country)}</span>}
                  </div>
                  <div className="col-repo">
                    <a
                      className="name"
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                    >
                      {slug || p.display_name}
                    </a>
                    <span className="desc">{(p.description || '').substring(0, 72)}</span>
                  </div>
                  <div className="col-sub" style={{ fontSize: '11px', color: 'var(--ink-3)' }}>
                    {cat?.display_name || '—'}
                  </div>
                  <div className="col-num">{fmt(p.stars || 0)}</div>
                  <div className="col-num">
                    {(p.star_7d || 0) > 0
                      ? <span style={{ color: 'var(--healthy)' }}>+{fmt(p.star_7d)}</span>
                      : <span style={{ color: 'var(--ink-3)' }}>—</span>
                    }
                  </div>
                  <div className="col-num">{fmt(p.commits_90d || 0)}</div>
                  <div className="col-sub">{p.language || '—'}</div>
                  <div className="col-sub" style={{ color: 'var(--ink-3)', fontSize: '11.5px' }}>
                    {p.license || '—'}
                  </div>
                </div>
              );
            })
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
