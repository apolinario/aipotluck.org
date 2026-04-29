import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useExplorerData } from '../../hooks/useExplorerData.js';
import { useFilters } from '../../hooks/useFilters.js';
import { PALETTES } from '../../data/palettes.js';
import { LayerCards } from './LayerCards.jsx';
import { FilterSidebar } from './FilterSidebar.jsx';
import { RepoTable } from './RepoTable.jsx';
import { SearchBar } from './SearchBar.jsx';
import { DetailDrawer } from './DetailDrawer.jsx';

export function Explorer() {
  const explorerData = useExplorerData();
  const { data, warnings, bundleError, loading, packagesByRepo, packagesByProject, modelsByRepo, modelsByProject, taxonomyByProject, projectBySlug } = explorerData;
  const { filters, setFilter, clearFilters, activeCount, filteredRepos, filterOptions } = useFilters(data, explorerData);
  const [drawerRepo, setDrawerRepo] = useState(null);
  const [mode, setMode] = useState('dawn');

  if (loading) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#020508', color: '#fff', display: 'grid', placeItems: 'center', fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, marginBottom: 12 }}>Loading ecosystem data...</h2>
          <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 13 }}>{data.repos.length} repos loaded</p>
        </div>
      </div>
    );
  }

  if (bundleError) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#020508', color: '#c8341d', display: 'grid', placeItems: 'center', fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, color: '#fff', marginBottom: 12 }}>Data Error</h2>
          <p style={{ fontSize: 14 }}>{bundleError}</p>
          <Link to="/" style={{ color: 'rgba(255,255,255,.5)', fontSize: 13, textDecoration: 'none', marginTop: 16, display: 'inline-block' }}>← Back to landing</Link>
        </div>
      </div>
    );
  }

  const resolveDrawerProps = () => {
    if (!drawerRepo) return null;
    const repoTax = taxonomyByProject[drawerRepo.repo] || [];
    const projectSlug = repoTax[0]?.project_slug || drawerRepo.repo;
    const project = projectBySlug[projectSlug];
    const taxonomy = repoTax.length > 0 ? repoTax : (taxonomyByProject[projectSlug] || []);
    const sub = taxonomy[0]?.osai_subcategory;
    const adjacentSlugs = sub ? [...new Set(
      data.taxonomy
        .filter((t) => t.osai_subcategory === sub && t.project_slug !== projectSlug && t.project_slug !== drawerRepo.repo)
        .map((t) => t.project_slug)
    )] : [];
    const adjacentProjects = adjacentSlugs
      .map((s) => projectBySlug[s])
      .filter(Boolean)
      .sort((a, b) => (b.total_stars || 0) - (a.total_stars || 0))
      .slice(0, 5);

    return {
      repo: drawerRepo,
      project,
      taxonomy,
      packages: packagesByRepo[drawerRepo.repo] || packagesByProject[projectSlug] || [],
      models: modelsByRepo[drawerRepo.repo] || modelsByProject[projectSlug] || [],
      sparkline: data.sparklines[drawerRepo.repo],
      adjacentProjects,
    };
  };

  const drawerProps = resolveDrawerProps();

  return (
    <div className="grain" style={{
      width: '100vw',
      height: '100vh',
      background: '#020508',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'DM Sans', sans-serif",
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 24px',
        borderBottom: '1px solid rgba(255,255,255,.06)',
        flexShrink: 0,
      }}>
        <Link to="/" style={{
          color: 'rgba(255,255,255,.5)',
          textDecoration: 'none',
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          ← <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 300, color: 'rgba(255,255,255,.7)' }}>Current AI</span>
        </Link>
        <div style={{ flex: 1 }} />
        <SearchBar value={filters.q} onChange={(q) => setFilter('q', q)} />
        <button
          onClick={() => setMode((m) => (m === 'dawn' ? 'dusk' : 'dawn'))}
          style={{
            background: 'rgba(255,255,255,.07)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,.12)',
            borderRadius: 6,
            color: '#fff',
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            padding: '6px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ fontSize: 13, lineHeight: 1 }}>{PALETTES[mode].icon}</span>
          {PALETTES[mode].label}
        </button>
        {warnings.some((w) => w.type === 'stale') && (
          <span style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            color: '#d9952a',
            letterSpacing: '.04em',
          }}>
            {warnings.find((w) => w.type === 'stale').message}
          </span>
        )}
      </div>

      <div style={{ padding: '16px 0', flexShrink: 0 }}>
        <LayerCards
          layers={data.layers}
          activeLayer={filters.layer}
          onLayerClick={(layer) => {
            setFilter('layer', layer);
            setFilter('subcategory', null);
          }}
        />
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <FilterSidebar
          filters={filters}
          setFilter={setFilter}
          clearFilters={clearFilters}
          activeCount={activeCount}
          filterOptions={filterOptions}
          layers={data.layers}
        />
        <RepoTable
          repos={filteredRepos}
          sparklines={data.sparklines}
          packagesByRepo={packagesByRepo}
          modelsByRepo={modelsByRepo}
          taxonomyByProject={taxonomyByProject}
          onRowClick={(repo) => setDrawerRepo(repo)}
        />
      </div>

      {drawerProps && (
        <DetailDrawer
          {...drawerProps}
          onClose={() => setDrawerRepo(null)}
          onNavigate={(proj) => {
            const targetRepo = data.repos.find((r) => r.repo === proj.project_slug)
              || data.repos.find((r) => r.repo.includes(proj.project_slug));
            if (targetRepo) setDrawerRepo(targetRepo);
          }}
        />
      )}
    </div>
  );
}
