import { useState, useEffect, useMemo, useCallback } from 'react';

const BASE = '/data/explorer/';

function buildCatEntityMap(products, entitySummaries, entityMap) {
  const tmp = {};
  for (const p of products) {
    if (!p.category_id || !p.entity_id) continue;
    if (!tmp[p.category_id]) tmp[p.category_id] = {};
    const k = p.entity_id + (p.is_open ? ':o' : ':c');
    if (!tmp[p.category_id][k])
      tmp[p.category_id][k] = { entityId: p.entity_id, isOpen: !!p.is_open, count: 0 };
    tmp[p.category_id][k].count++;
  }
  const globalRank = {};
  (entitySummaries || []).forEach((e, i) => { globalRank[e.entity_id] = i; });
  const result = {};
  for (const [catId, entries] of Object.entries(tmp)) {
    const all = Object.values(entries).sort(
      (a, b) => (globalRank[a.entityId] ?? 9999) - (globalRank[b.entityId] ?? 9999)
    );
    result[catId] = { open: all.filter(e => e.isOpen), closed: all.filter(e => !e.isOpen) };
  }
  return result;
}

function buildEntityTypeCount(products) {
  const m = {};
  for (const p of products) {
    if (!p.entity_id) continue;
    if (!m[p.entity_id]) m[p.entity_id] = {};
    m[p.entity_id][p.product_type] = (m[p.entity_id][p.product_type] || 0) + 1;
  }
  return m;
}

function buildEntitySummaries(entities, products, categories, layers) {
  const TYPE_PRI = {
    repo: 1, model: 2, package: 3, dataset: 4, eval_harness: 5, tool: 6,
    runtime: 7, paper: 8, standard: 9, policy: 10, model_closed: 11, chip: 12,
    service: 13, dataset_closed: 14,
  };
  const catLayerMap = Object.fromEntries(categories.map(c => [c.id, c.layer_id]));
  const byEntity = {};
  for (const p of products) {
    if (!byEntity[p.entity_id])
      byEntity[p.entity_id] = { layerSet: new Set(), openCount: 0, closedCount: 0 };
    const s = byEntity[p.entity_id];
    const layer = catLayerMap[p.category_id];
    if (layer) s.layerSet.add(layer);
    if (p.is_open) s.openCount++; else s.closedCount++;
  }
  const topByEntity = {};
  for (const p of products) {
    const cur = topByEntity[p.entity_id];
    const score = (p.is_open ? 0 : 100) + (TYPE_PRI[p.product_type] || 99);
    const curScore = cur ? (cur.is_open ? 0 : 100) + (TYPE_PRI[cur.product_type] || 99) : 9999;
    if (score < curScore) topByEntity[p.entity_id] = p;
  }
  return entities
    .filter(e => e.source === 'ossd' || e.source === 'curated')
    .map(e => {
      const s = byEntity[e.entity_id] || { layerSet: new Set(), openCount: 0, closedCount: 0 };
      return {
        ...e,
        layers: [...s.layerSet],
        openCount: s.openCount,
        closedCount: s.closedCount,
        total: s.openCount + s.closedCount,
        topProduct: topByEntity[e.entity_id] || null,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export function useExplorerData() {
  const [layers, setLayers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [entities, setEntities] = useState([]);
  const [products, setProducts] = useState([]);
  const [reposAttrs, setReposAttrs] = useState([]);
  const [modelsAttrs, setModelsAttrs] = useState([]);
  const [packagesAttrs, setPackagesAttrs] = useState([]);
  const [contribAttrs, setContribAttrs] = useState([]);
  const [loaded, setLoaded] = useState({ phase1: false, phase2: false, repos: false });

  useEffect(() => {
    fetch(BASE + 'layers.json')
      .then(r => r.json())
      .then(data => {
        setLayers(data);
        setLoaded(prev => ({ ...prev, phase1: true }));
      })
      .catch(e => console.error('Phase 1:', e));
  }, []);

  useEffect(() => {
    if (!loaded.phase1) return;
    Promise.all([
      fetch(BASE + 'categories.json').then(r => r.json()),
      fetch(BASE + 'entities.json').then(r => r.json()),
      fetch(BASE + 'products.json').then(r => r.json()),
      fetch(BASE + 'repos_attrs.json').then(r => r.json()),
      fetch(BASE + 'models_attrs.json').then(r => r.json()),
      fetch(BASE + 'packages_attrs.json').then(r => r.json()),
    ]).then(([cats, ents, prods, repos, models, pkgs]) => {
      setCategories(cats);
      setEntities(ents);
      setProducts(prods);
      setReposAttrs(repos);
      setModelsAttrs(models);
      setPackagesAttrs(pkgs);
      setLoaded(prev => ({ ...prev, phase2: true }));
    }).catch(e => console.error('Phase 2:', e));
  }, [loaded.phase1]);

  const loadRepos = useCallback(() => {
    if (loaded.repos) return;
    fetch(BASE + 'contributions_attrs.json')
      .then(r => r.json())
      .then(data => {
        setContribAttrs(data);
        setLoaded(prev => ({ ...prev, repos: true }));
      })
      .catch(e => console.error('Repos:', e));
  }, [loaded.repos]);

  const catMap = useMemo(
    () => Object.fromEntries(categories.map(c => [c.id, c])),
    [categories]
  );
  const entityMap = useMemo(
    () => Object.fromEntries(entities.map(e => [e.entity_id, e])),
    [entities]
  );
  const reposAttrsByPid = useMemo(
    () => Object.fromEntries(reposAttrs.map(r => [r.product_id, r])),
    [reposAttrs]
  );
  const modelsAttrsByPid = useMemo(
    () => Object.fromEntries(modelsAttrs.map(m => [m.product_id, m])),
    [modelsAttrs]
  );
  const packagesAttrsByPid = useMemo(
    () => Object.fromEntries(packagesAttrs.map(p => [p.product_id, p])),
    [packagesAttrs]
  );
  const contribAttrsByPid = useMemo(
    () => Object.fromEntries(contribAttrs.map(c => [c.product_id, c])),
    [contribAttrs]
  );
  const productsByCat = useMemo(() => {
    const m = {};
    for (const p of products) {
      if (!m[p.category_id]) m[p.category_id] = [];
      m[p.category_id].push(p);
    }
    return m;
  }, [products]);
  const entityByPid = useMemo(() => {
    const m = {};
    for (const p of products) m[p.product_id] = p.entity_id;
    return m;
  }, [products]);

  const entitySummaries = useMemo(
    () => loaded.phase2 ? buildEntitySummaries(entities, products, categories, layers) : [],
    [loaded.phase2, entities, products, categories, layers]
  );
  const entityTypeCount = useMemo(
    () => loaded.phase2 ? buildEntityTypeCount(products) : {},
    [loaded.phase2, products]
  );
  const catEntityMap = useMemo(
    () => loaded.phase2 ? buildCatEntityMap(products, entitySummaries, entityMap) : {},
    [loaded.phase2, products, entitySummaries, entityMap]
  );

  return {
    layers, catMap, entityMap, products, productsByCat, entityByPid,
    reposAttrsByPid, modelsAttrsByPid, packagesAttrsByPid, contribAttrsByPid,
    entitySummaries, entityTypeCount, catEntityMap,
    loaded, loadRepos,
  };
}
