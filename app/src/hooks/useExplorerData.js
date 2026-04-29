import { useMemo } from 'react';
import { buildSearchIndex } from '../utils/search.js';
import sampleData from '../data/explorer-data.sample.json';

const REQUIRED_KEYS = ['generated', 'layers', 'repos', 'projects', 'packages', 'models', 'sparklines', 'taxonomy'];

function loadData() {
  try {
    const modules = import.meta.glob('../data/explorer-data.json', { eager: true });
    const key = Object.keys(modules)[0];
    if (key) return modules[key].default || modules[key];
  } catch { /* fall through */ }
  return sampleData;
}

const _data = loadData();

export function useExplorerData() {
  const data = _data;

  const bundleError = useMemo(() => {
    const missing = REQUIRED_KEYS.filter((k) => !(k in data));
    if (missing.length > 0) return `Missing keys: ${missing.join(', ')}`;
    return null;
  }, [data]);

  const indexes = useMemo(() => {
    const packagesByProject = {};
    const packagesByRepo = {};
    for (const p of data.packages) {
      if (p.project_slug) {
        if (!packagesByProject[p.project_slug]) packagesByProject[p.project_slug] = [];
        packagesByProject[p.project_slug].push(p);
      }
      if (!packagesByRepo[p.repo]) packagesByRepo[p.repo] = [];
      packagesByRepo[p.repo].push(p);
    }

    const modelsByProject = {};
    const modelsByRepo = {};
    for (const m of data.models) {
      if (m.project_slug) {
        if (!modelsByProject[m.project_slug]) modelsByProject[m.project_slug] = [];
        modelsByProject[m.project_slug].push(m);
      }
      if (m.repo) {
        if (!modelsByRepo[m.repo]) modelsByRepo[m.repo] = [];
        modelsByRepo[m.repo].push(m);
      }
    }

    const taxonomyByProject = {};
    for (const t of data.taxonomy) {
      if (!taxonomyByProject[t.project_slug]) taxonomyByProject[t.project_slug] = [];
      taxonomyByProject[t.project_slug].push(t);
    }

    const projectBySlug = {};
    for (const p of data.projects) {
      projectBySlug[p.project_slug] = p;
    }

    const searchIndex = buildSearchIndex(data.repos, data.packages, data.models);

    return {
      packagesByProject,
      packagesByRepo,
      modelsByProject,
      modelsByRepo,
      taxonomyByProject,
      projectBySlug,
      searchIndex,
    };
  }, [data]);

  const warnings = useMemo(() => {
    const w = [];
    const generated = new Date(data.generated);
    const age = (Date.now() - generated.getTime()) / (1000 * 60 * 60 * 24);
    if (age > 7) w.push({ type: 'stale', message: `Data is ${Math.floor(age)} days old` });

    for (const layer of data.layers) {
      for (const sub of layer.subcategories) {
        if (sub.project_count < 2) {
          w.push({ type: 'sparse', message: `${layer.layer} > ${sub.subcategory}: only ${sub.project_count} project(s)` });
        }
      }
    }
    return w;
  }, [data]);

  return { data, ...indexes, warnings, bundleError };
}
