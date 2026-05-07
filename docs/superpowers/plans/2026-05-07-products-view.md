# Products View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename "Repos" to "Products" with a type toggle (Repos | Models | Packages | Other) and cross-linked product tables with type-specific columns.

**Architecture:** Refactor `ReposView.jsx` into a `ProductsView.jsx` that renders a type-segmented control at the top. Each product group gets its own column config and filter set. The existing repo table becomes the default "Repos" segment. Models, Packages, and Other segments reuse the same table/pager infrastructure with different columns. Cross-linking is handled via the `repo` field in model/package attrs (prepend `"repo:"` to get the matching `product_id`).

**Tech Stack:** React (hooks), CSS custom properties, existing explorer design system.

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Rename | `app/src/components/explorer/ReposView.jsx` → `ProductsView.jsx` | Main products table with type toggle, type-specific columns, filters, pagination |
| Modify | `app/src/components/explorer/ExplorerApp.jsx` | Wire up ProductsView, update imports, view state, stats text, drawer callbacks |
| Modify | `app/src/components/explorer/Topbar.jsx` | Rename "Repos" tab → "Products", update mobile select |
| Modify | `app/src/explorer/constants.js` | Add column configs per product group, update search placeholder |
| Modify | `app/src/styles/explorer.css` | Add type-toggle styles, per-type grid-template-columns, linked-repo badge styles |
| Modify | `app/src/components/explorer/RepoDrawerContent.jsx` | Add "Linked Products" section showing models/packages that reference this repo |

---

### Task 1: Constants — column configs and product group definitions

**Files:**
- Modify: `app/src/explorer/constants.js`

- [ ] **Step 1: Add column config objects for each product group**

Add after the existing `SEARCH_PLACEHOLDERS`:

```js
export const PRODUCT_GROUP_LABELS = {
  repos: 'Repos',
  models: 'Models',
  packages: 'Packages',
  other: 'Other',
};

export const PRODUCT_COLUMNS = {
  repos: [
    { key: 'entity', label: 'Maintained by', sortable: true, width: '14%' },
    { key: 'name', label: 'Repository', sortable: true, width: '24%' },
    { key: 'category', label: 'Category', sortable: false, width: '13%' },
    { key: 'stars', label: 'Stars', sortable: true, width: '7%', numeric: true },
    { key: 'star7d', label: '+7d', sortable: true, width: '6%', numeric: true },
    { key: 'commits90', label: 'Commits/90d', sortable: true, width: '9%', numeric: true },
    { key: 'language', label: 'Language', sortable: false, width: '9%' },
    { key: 'license', label: 'License', sortable: false, width: '10%' },
  ],
  models: [
    { key: 'entity', label: 'Maintained by', sortable: true, width: '14%' },
    { key: 'name', label: 'Model', sortable: true, width: '22%' },
    { key: 'category', label: 'Category', sortable: false, width: '12%' },
    { key: 'pipeline', label: 'Pipeline', sortable: false, width: '11%' },
    { key: 'downloads', label: 'Downloads', sortable: true, width: '9%', numeric: true },
    { key: 'likes', label: 'Likes', sortable: true, width: '6%', numeric: true },
    { key: 'library', label: 'Library', sortable: false, width: '10%' },
    { key: 'linked_repo', label: 'Repo', sortable: false, width: '8%' },
  ],
  packages: [
    { key: 'entity', label: 'Maintained by', sortable: true, width: '16%' },
    { key: 'name', label: 'Package', sortable: true, width: '22%' },
    { key: 'category', label: 'Category', sortable: false, width: '14%' },
    { key: 'source', label: 'Source', sortable: false, width: '10%' },
    { key: 'package_name', label: 'Package Name', sortable: true, width: '18%' },
    { key: 'linked_repo', label: 'Linked Repo', sortable: false, width: '12%' },
  ],
  other: [
    { key: 'entity', label: 'Maintained by', sortable: true, width: '16%' },
    { key: 'name', label: 'Name', sortable: true, width: '24%' },
    { key: 'category', label: 'Category', sortable: false, width: '14%' },
    { key: 'type', label: 'Type', sortable: false, width: '12%' },
    { key: 'open', label: 'Open?', sortable: false, width: '8%' },
  ],
};

export const PRODUCT_SORT_DEFAULTS = {
  repos: { col: 'stars', dir: 'desc' },
  models: { col: 'downloads', dir: 'desc' },
  packages: { col: 'name', dir: 'asc' },
  other: { col: 'name', dir: 'asc' },
};
```

- [ ] **Step 2: Update search placeholder for products view**

Replace the `SEARCH_PLACEHOLDERS` object:

```js
export const SEARCH_PLACEHOLDERS = {
  stacks: 'Search categories…',
  products: 'Search products…',
  teams: 'Search teams…',
};
```

- [ ] **Step 3: Commit**

```bash
git add app/src/explorer/constants.js
git commit -m "feat: add product column configs and group labels to constants"
```

---

### Task 2: Rename ReposView → ProductsView with type toggle

**Files:**
- Create: `app/src/components/explorer/ProductsView.jsx` (rename from ReposView.jsx)
- Delete: `app/src/components/explorer/ReposView.jsx`

This is the largest task. The new component:
1. Accepts a `productGroup` prop (default `'repos'`) and an `onGroupChange` callback
2. Renders a segment control (Repos | Models | Packages | Other) at top of filter bar
3. Swaps column configs, sort defaults, and filters based on active group
4. Renders type-specific cell content per column key
5. Cross-links models/packages to repos via the `repo` field in attrs

- [ ] **Step 1: Create ProductsView.jsx**

```jsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FLAGS, GEO_PRESETS, PRODUCT_GROUP_TYPES, PRODUCT_GROUP_LABELS,
  PRODUCT_COLUMNS, PRODUCT_SORT_DEFAULTS, TYPE_LABEL_S,
} from '../../explorer/constants.js';
import { flag, fmt, fmtN, entityName, matchesPreset } from '../../explorer/helpers.js';

const LICENSES = ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'GPL-3.0', 'LGPL-2.1', 'MPL-2.0', 'AGPL-3.0'];

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
  const [filter, setFilter] = useState({ layer: '', country: '', lang: '', license: '' });
  const [countryPreset, setCountryPreset] = useState('all');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => { loadRepos(); }, [loadRepos]);

  // Reset sort+filters when group changes
  useEffect(() => {
    setSort(PRODUCT_SORT_DEFAULTS[productGroup] || { col: 'name', dir: 'asc' });
    setFilter({ layer: '', country: '', lang: '', license: '' });
    setCountryPreset('all');
    setPage(0);
  }, [productGroup]);

  // Count products per group for the segment badges
  const groupCounts = useMemo(() => {
    const counts = {};
    for (const [gk, types] of Object.entries(PRODUCT_GROUP_TYPES)) {
      counts[gk] = products.filter(p => types.has(p.product_type)).length;
    }
    return counts;
  }, [products]);

  const languages = useMemo(() => {
    if (productGroup !== 'repos') return [];
    const all = Object.values(reposAttrsByPid);
    return [...new Set(all.map(r => r.language).filter(Boolean))].sort().slice(0, 40);
  }, [reposAttrsByPid, productGroup]);

  const countries = useMemo(() => {
    if (productGroup !== 'repos') return [];
    const all = Object.values(reposAttrsByPid);
    return [...new Set(all.map(r => r.country).filter(c => c && FLAGS[c]))].sort();
  }, [reposAttrsByPid, productGroup]);

  // Build a lookup from repo slug → product_id for cross-linking
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

    // Geo filter — repos only
    if (productGroup === 'repos') {
      if (countryPreset && countryPreset !== 'all') {
        list = list.filter(p => matchesPreset(reposAttrsByPid[p.product_id]?.country || null, countryPreset));
      } else if (filter.country) {
        list = list.filter(p => (reposAttrsByPid[p.product_id]?.country || '') === filter.country);
      }
      if (filter.lang) list = list.filter(p => (reposAttrsByPid[p.product_id]?.language || '') === filter.lang);
      if (filter.license) list = list.filter(p => (reposAttrsByPid[p.product_id]?.license || '') === filter.license);
    }

    if (q) {
      list = list.filter(p => {
        const name = (p.display_name || '').toLowerCase();
        const entName = (entityMap[p.entity_id]?.display_name || '').toLowerCase();
        const repoDesc = (reposAttrsByPid[p.product_id]?.description || '').toLowerCase();
        return name.includes(q) || entName.includes(q) || repoDesc.includes(q);
      });
    }

    // Merge attrs
    list = list.map(p => {
      const repoAttrs = reposAttrsByPid[p.product_id] || {};
      const modelAttrs = modelsAttrsByPid[p.product_id] || {};
      const pkgAttrs = packagesAttrsByPid[p.product_id] || {};
      return { ...p, ...repoAttrs, ...modelAttrs, ...pkgAttrs };
    });

    // Sort
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
          <label>Type</label>
          <div className="seg">
            {GROUP_KEYS.map(gk => (
              <button
                key={gk}
                className={`seg-btn${productGroup === gk ? ' active' : ''}`}
                onClick={() => onGroupChange(gk)}
              >
                {PRODUCT_GROUP_LABELS[gk]}
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', opacity: .7, marginLeft: 4 }}>
                  {fmtN(groupCounts[gk] || 0)}
                </span>
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

        {productGroup === 'repos' && (
          <>
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
                  style={{ marginLeft: 4 }}
                  className="preset-btn"
                >
                  <option value="">Other…</option>
                  {countries.map(v => <option key={v} value={v}>{flag(v)} {v}</option>)}
                </select>
              </div>
            </div>
          </>
        )}
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
                  <React.Fragment key={c.key}>
                    {renderCell(p, c.key)}
                  </React.Fragment>
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
```

Note: Uses `React.Fragment` — add `import React from 'react'` at top, or replace with inline fragment `<>...</>` keyed via wrapping div. Actually, keyed fragments require explicit import. Simpler: wrap each cell group in a keyed div:

Replace the map inside `table-row`:
```jsx
{columns.map(c => (
  <div key={c.key} style={{ display: 'contents' }}>
    {renderCell(p, c.key)}
  </div>
))}
```

Wait — `display: contents` will work but each `renderCell` already returns a single div, so we can just key the returned element. Simpler approach — since `renderCell` returns a single `<div>`, just spread a key onto it. Cleanest: just use the Fragment import.

Final import line:
```js
import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
```

And in the row:
```jsx
{columns.map(c => (
  <Fragment key={c.key}>
    {renderCell(p, c.key)}
  </Fragment>
))}
```

- [ ] **Step 2: Delete old ReposView.jsx**

```bash
rm app/src/components/explorer/ReposView.jsx
```

- [ ] **Step 3: Commit**

```bash
git add app/src/components/explorer/ProductsView.jsx
git rm app/src/components/explorer/ReposView.jsx
git commit -m "feat: create ProductsView with type toggle replacing ReposView"
```

---

### Task 3: Wire up ExplorerApp

**Files:**
- Modify: `app/src/components/explorer/ExplorerApp.jsx`

- [ ] **Step 1: Update imports**

Replace:
```js
import { ReposView } from './ReposView.jsx';
```
With:
```js
import { ProductsView } from './ProductsView.jsx';
```

- [ ] **Step 2: Add productGroup state and rename view**

After the existing `const [view, setView] = useState('stacks');` line, add:
```js
const [productGroup, setProductGroup] = useState('repos');
```

- [ ] **Step 3: Update view change handler**

Change `handleViewChange` to also reset productGroup:
```js
const handleViewChange = useCallback((v) => {
  setView(v);
  setSearchQuery('');
  setStacksFilter(null);
  if (v === 'products') setProductGroup('repos');
}, []);
```

- [ ] **Step 4: Replace ReposView render block**

Replace the `{view === 'repos' && (` block with:
```jsx
{view === 'products' && (
  <ProductsView
    layers={data.layers}
    products={data.products}
    catMap={data.catMap}
    entityMap={data.entityMap}
    reposAttrsByPid={data.reposAttrsByPid}
    modelsAttrsByPid={data.modelsAttrsByPid}
    packagesAttrsByPid={data.packagesAttrsByPid}
    loaded={data.loaded}
    loadRepos={data.loadRepos}
    searchQuery={searchQuery}
    onRepoClick={openRepoDrawer}
    onProductClick={openRepoDrawer}
    productGroup={productGroup}
    onGroupChange={setProductGroup}
  />
)}
```

Note: `onProductClick` uses `openRepoDrawer` for now — all products open the same drawer type. The drawer already handles different product types via ProductRow.

- [ ] **Step 5: Update statsText**

Replace the `view === 'repos'` stats block:
```js
if (view === 'products' && data.loaded.phase2) {
  const types = PRODUCT_GROUP_TYPES[productGroup];
  const count = types ? data.products.filter(p => types.has(p.product_type)).length : data.products.length;
  return `${fmtN(count)} ${PRODUCT_GROUP_LABELS[productGroup]?.toLowerCase() || 'products'}`;
}
```

Add imports at top of file:
```js
import { PRODUCT_GROUP_TYPES, PRODUCT_GROUP_LABELS } from '../../explorer/constants.js';
```

- [ ] **Step 6: Commit**

```bash
git add app/src/components/explorer/ExplorerApp.jsx
git commit -m "feat: wire up ProductsView in ExplorerApp with group state"
```

---

### Task 4: Update Topbar

**Files:**
- Modify: `app/src/components/explorer/Topbar.jsx`

- [ ] **Step 1: Rename Repos → Products in tabs and select**

Replace the nav-tabs map array:
```js
{['stacks', 'products'].map(v => (
```

Replace the mobile select options:
```jsx
<option value="stacks">Stacks</option>
<option value="products">Products</option>
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/explorer/Topbar.jsx
git commit -m "feat: rename Repos tab to Products in topbar"
```

---

### Task 5: CSS — dynamic grid columns and linked-repo button

**Files:**
- Modify: `app/src/styles/explorer.css`

- [ ] **Step 1: Remove hardcoded grid-template-columns from table-head/table-row**

The grid columns are now set inline via `style={{ gridTemplateColumns: gridCols }}`. Remove the fixed `grid-template-columns` from the base rule. Replace:

```css
.explorer .table-head,
.explorer .table-row {
  display: grid;
  grid-template-columns: 14% 24% 13% 7% 6% 9% 9% 10%;
  align-items: center; padding: 8px 14px; gap: 8px; font-size: 12.5px;
}
```

With:

```css
.explorer .table-head,
.explorer .table-row {
  display: grid;
  align-items: center; padding: 8px 14px; gap: 8px; font-size: 12.5px;
}
```

- [ ] **Step 2: Add linked-repo button style**

After the `.col-num` rule, add:

```css
.explorer .linked-repo-btn {
  border: 1px solid var(--rule-soft);
  background: var(--paper-2);
  border-radius: 4px;
  padding: 1px 7px;
  font-family: 'DM Mono', monospace;
  font-size: 10.5px;
  color: var(--accent);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  transition: border-color .1s, background .1s;
}
.explorer .linked-repo-btn:hover {
  border-color: var(--accent);
  background: color-mix(in oklch, var(--accent) 6%, var(--paper));
}
```

- [ ] **Step 3: Update responsive breakpoints**

The 1100px breakpoint hides the 8th column — now that columns are dynamic per type, remove the column-hiding rules and let the inline grid handle it. Replace:

```css
@media (max-width: 1100px) {
  .explorer .layer-cells { grid-template-columns: repeat(2,1fr); }
  .explorer .layer-row   { grid-template-columns: 155px 1fr; }
  .explorer .table-head,
  .explorer .table-row { grid-template-columns: 16% 26% 15% 8% 7% 10% 10%; }
  .explorer .table-head > div:nth-child(8),
  .explorer .table-row > div:nth-child(8) { display: none; }
}
```

With:

```css
@media (max-width: 1100px) {
  .explorer .layer-cells { grid-template-columns: repeat(2,1fr); }
  .explorer .layer-row   { grid-template-columns: 155px 1fr; }
}
```

- [ ] **Step 4: Commit**

```bash
git add app/src/styles/explorer.css
git commit -m "feat: dynamic table grid columns and linked-repo button styles"
```

---

### Task 6: Add "Linked Products" section to RepoDrawerContent

**Files:**
- Modify: `app/src/components/explorer/RepoDrawerContent.jsx`

- [ ] **Step 1: Build linked products lookup**

After the existing `const related = ...` block, add code to find models and packages that link to this repo via the `repo` field in their attrs:

```jsx
const repoSlug = (productId || '').replace('repo:', '');
const linkedProducts = useMemo(() => {
  if (!repoSlug) return [];
  return products.filter(p2 => {
    if (p2.product_id === productId) return false;
    const mAttrs = modelsAttrsByPid[p2.product_id];
    const pAttrs = packagesAttrsByPid[p2.product_id];
    return (mAttrs?.repo === repoSlug) || (pAttrs?.repo === repoSlug);
  });
}, [products, productId, repoSlug, modelsAttrsByPid, packagesAttrsByPid]);
```

Wait — RepoDrawerContent is not wrapped in a memo-friendly way. Since `products`, `modelsAttrsByPid`, and `packagesAttrsByPid` are already props, we can compute inline (or use useMemo by importing it). The component doesn't currently import useMemo.

Update the import line:
```js
import { useMemo } from 'react';
```

- [ ] **Step 2: Render linked products section**

After the `{related.length > 0 && ...}` block and before the bottom link bar, add:

```jsx
{linkedProducts.length > 0 && (
  <>
    <div className="section-h">
      Linked products
      <span className="countpill">{linkedProducts.length}</span>
    </div>
    <div className="proj-list">
      {linkedProducts.map(lp => (
        <ProductRow
          key={lp.product_id}
          product={lp}
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
```

- [ ] **Step 3: Commit**

```bash
git add app/src/components/explorer/RepoDrawerContent.jsx
git commit -m "feat: add linked products section to repo drawer"
```

---

### Task 7: Verify and fix build

- [ ] **Step 1: Run dev server and check for build errors**

```bash
cd app && pnpm build
```

Expected: clean build with no errors.

- [ ] **Step 2: Manual test in browser**

Start dev server:
```bash
cd app && pnpm dev
```

Test checklist:
- Navigate to `/app` — should see "Products" tab instead of "Repos"
- Default view shows repos table (same as before)
- Click "Models" segment — table swaps to model columns (downloads, likes, pipeline, linked repo)
- Click "Packages" segment — table swaps to package columns (source, package name, linked repo)
- Click "Other" segment — shows misc product types (chips, services, standards, etc.)
- Click a linked repo button in Models/Packages — opens the repo drawer
- Repo drawer shows "Linked products" section when applicable
- Layer filter works across all types
- Language/License/Geography filters only appear for Repos
- Search works across all types
- Pagination resets when switching types
- Stats text updates per type

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address build/runtime issues in products view"
```
