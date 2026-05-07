import { useState, useMemo, useCallback, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useExplorerData } from '../../explorer/useExplorerData.js';
import { Topbar } from './Topbar.jsx';
import { StacksView } from './StacksView.jsx';
import { ProductsView } from './ProductsView.jsx';
import { Drawer } from './Drawer.jsx';
import { CategoryDrawerContent } from './CategoryDrawerContent.jsx';
import { RepoDrawerContent } from './RepoDrawerContent.jsx';
import { EntityDrawerContent } from './EntityDrawerContent.jsx';
import { fmtN } from '../../explorer/helpers.js';
import '../../styles/explorer.css';

export function ExplorerApp() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState('stacks');
  const [productGroup, setProductGroup] = useState('repos');
  const [searchQuery, setSearchQuery] = useState('');
  const [stacksFilter, setStacksFilter] = useState(null);
  const [stackClaims, setStackClaims] = useState({});
  const [drawer, setDrawer] = useState({ open: false, type: null, id: null });
  const data = useExplorerData(stacksFilter);

  useEffect(() => {
    let isMounted = true;
    const loadClaims = async () => {
      try {
        const response = await fetch('/api/stack-claims');
        if (!response.ok) return;
        const payload = await response.json();
        if (!isMounted) return;
        if (payload?.claims && typeof payload.claims === 'object') {
          setStackClaims(payload.claims);
        }
      } catch {
        // non-fatal; claim UI remains usable for new submissions
      }
    };
    loadClaims();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const requestedView = searchParams.get('view');
    if (!requestedView) return;
    if (requestedView === 'stacks' || requestedView === 'repos' || requestedView === 'teams') {
      setView(requestedView);
    }
  }, [searchParams]);

  useEffect(() => {
    if (location.pathname === '/stacks' || location.pathname === '/gaps') {
      setView('stacks');
      return;
    }
    if (location.pathname === '/repos') {
      setView('products');
      return;
    }
    if (location.pathname === '/teams') {
      setView('teams');
    }
  }, [location.pathname]);

  /** Open category drawer from URL (?open=category&category=<id>) or clear it when params go away. */
  useEffect(() => {
    if (!data.loaded.phase2) return;
    const open = searchParams.get('open');
    const category = searchParams.get('category');
    if (open === 'category' && category && data.catMap[category]) {
      setDrawer({ open: true, type: 'category', id: category });
      setView('stacks');
      return;
    }
    setDrawer((d) => {
      if (d.open && d.type === 'category') return { open: false, type: null, id: null };
      return d;
    });
  }, [data.loaded.phase2, searchParams, data.catMap]);

  const handleViewChange = useCallback((v) => {
    setView(v);
    setSearchQuery('');
    setStacksFilter(null);
    if (v === 'products') setProductGroup('repos');
  }, []);

  const openCategoryDrawer = useCallback((catId) => {
    setDrawer({ open: true, type: 'category', id: catId });
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('open', 'category');
      p.set('category', catId);
      return p;
    });
  }, [setSearchParams]);

  const openRepoDrawer = useCallback((productId) => {
    setDrawer({ open: true, type: 'repo', id: productId });
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.delete('open');
      p.delete('category');
      return p;
    });
  }, [setSearchParams]);

  const openEntityDrawer = useCallback((entityId) => {
    setDrawer({ open: true, type: 'entity', id: entityId });
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.delete('open');
      p.delete('category');
      return p;
    });
  }, [setSearchParams]);

  const closeDrawer = useCallback(() => {
    setDrawer({ open: false, type: null, id: null });
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.delete('open');
      p.delete('category');
      return p;
    });
  }, [setSearchParams]);

  const handleClaimStack = useCallback(async (catId, name, inviteCode, action = 'claim') => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return { ok: false, error: 'Name is required' };
    const code = String(inviteCode || '').trim();

    try {
      const response = await fetch('/api/claim-stack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catId, name: trimmed, inviteCode: code, action }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        return { ok: false, error: payload.error || 'Could not validate invite code' };
      }

      const payload = await response.json().catch(() => ({}));
      const claim = payload?.claim || {
        catId,
        claimedBy: trimmed,
        contributors: [],
      };
      setStackClaims(prev => ({ ...prev, [catId]: claim }));

      return { ok: true };
    } catch {
      return { ok: false, error: 'Claim service unavailable' };
    }
  }, []);

  const statsText = useMemo(() => {
    if (view === 'stacks' && data.loaded.phase2) {
      const catCount = data.layers.reduce((s, l) => s + l.categories.length, 0);
      return `${data.layers.length} layers · ${catCount} categories`;
    }
    if (view === 'products' && data.loaded.phase2) {
      return `${fmtN(data.products.length)} products`;
    }
    return '—';
  }, [view, data.loaded, data.layers, data.products]);

  const drawerCrumb = useMemo(() => {
    if (!drawer.open) return '';
    if (drawer.type === 'category') {
      const cat = data.catMap[drawer.id];
      const layer = data.layers.find(l => l.id === cat?.layer_id);
      return `${layer?.display_name || ''} · ${cat?.display_name || ''}`;
    }
    if (drawer.type === 'repo') return 'Repository';
    if (drawer.type === 'entity') {
      const entity = data.entityMap[drawer.id];
      const typeLabel = entity?.type === 'individual' ? 'Individual' : 'Organization';
      return `${typeLabel} · Teams`;
    }
    return '';
  }, [drawer, data.catMap, data.layers, data.entityMap]);

  const drawerTitle = useMemo(() => {
    if (!drawer.open) return '';
    if (drawer.type === 'category') return data.catMap[drawer.id]?.display_name || '';
    if (drawer.type === 'repo') {
      const slug = (drawer.id || '').replace('repo:', '');
      return slug || drawer.id;
    }
    if (drawer.type === 'entity') {
      const e = data.entityMap[drawer.id];
      if (!e) return '';
      const d = e.display_name || '';
      if (d === e.entity_id || /^[a-z0-9_-]+$/.test(d))
        return d.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      return d;
    }
    return '';
  }, [drawer, data.catMap, data.entityMap]);

  const drawerTitleStyle = drawer.type === 'repo'
    ? { fontFamily: "'DM Mono', monospace", fontSize: 18, fontWeight: 500 }
    : undefined;

  return (
    <div className="explorer">
      <Topbar
        view={view}
        setView={handleViewChange}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        statsText={statsText}
      />

      <main>
        {view === 'stacks' && (
          <StacksView
            layers={data.layers}
            catEntityMap={data.catEntityMap}
            entityMap={data.entityMap}
            catCounts={data.catCounts}
            stackClaims={stackClaims}
            searchQuery={searchQuery}
            loaded={data.loaded}
            onCategoryClick={openCategoryDrawer}
            onFilterChange={setStacksFilter}
          />
        )}

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

        {/* Teams view hidden for now — re-enable when ready */}
      </main>

      <Drawer
        open={drawer.open}
        onClose={closeDrawer}
        crumb={drawerCrumb}
        title={drawerTitle}
        titleStyle={drawerTitleStyle}
      >
        {drawer.open && drawer.type === 'category' && (
          <CategoryDrawerContent
            catId={drawer.id}
            layers={data.layers}
            catMap={data.catMap}
            productsByCat={data.productsByCat}
            entityMap={data.entityMap}
            reposAttrsByPid={data.reposAttrsByPid}
            modelsAttrsByPid={data.modelsAttrsByPid}
            packagesAttrsByPid={data.packagesAttrsByPid}
            claim={stackClaims[drawer.id] || null}
            onClaimStack={handleClaimStack}
            onEntityClick={openEntityDrawer}
          />
        )}
        {drawer.open && drawer.type === 'repo' && (
          <RepoDrawerContent
            productId={drawer.id}
            layers={data.layers}
            catMap={data.catMap}
            entityMap={data.entityMap}
            products={data.products}
            entitySummaries={data.entitySummaries}
            reposAttrsByPid={data.reposAttrsByPid}
            modelsAttrsByPid={data.modelsAttrsByPid}
            packagesAttrsByPid={data.packagesAttrsByPid}
            onEntityClick={openEntityDrawer}
            onCategoryClick={openCategoryDrawer}
          />
        )}
        {drawer.open && drawer.type === 'entity' && (
          <EntityDrawerContent
            entityId={drawer.id}
            layers={data.layers}
            entityMap={data.entityMap}
            entitySummaries={data.entitySummaries}
            entityTypeCount={data.entityTypeCount}
            products={data.products}
            reposAttrsByPid={data.reposAttrsByPid}
            modelsAttrsByPid={data.modelsAttrsByPid}
            packagesAttrsByPid={data.packagesAttrsByPid}
          />
        )}
      </Drawer>
    </div>
  );
}
