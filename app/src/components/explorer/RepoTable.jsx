import { useState, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { RepoRow, GRID } from './RepoRow.jsx';

const COLUMNS = [
  { key: 'repo', label: 'Repository', sortable: true },
  { key: 'subcategory', label: 'Subcategory', sortable: true },
  { key: 'stars', label: 'Stars', sortable: true },
  { key: 'sparkline', label: '90d Activity', sortable: false },
  { key: 'total_contributors', label: 'Contributors', sortable: true },
  { key: 'country', label: 'Country', sortable: true },
  { key: 'health', label: '', sortable: false },
];

const headerCellStyle = {
  padding: '10px 10px',
  fontFamily: "'DM Mono', monospace",
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,.3)',
  cursor: 'pointer',
  userSelect: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

export function RepoTable({ repos, sparklines, packagesByRepo, modelsByRepo, taxonomyByProject, onRowClick }) {
  const [sortKey, setSortKey] = useState('stars');
  const [sortDir, setSortDir] = useState('desc');
  const scrollRef = useRef(null);

  const handleSort = (key) => {
    if (!COLUMNS.find((c) => c.key === key)?.sortable) return;
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sorted = useMemo(() => {
    const arr = [...repos];
    arr.sort((a, b) => {
      let va = a[sortKey];
      let vb = b[sortKey];
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va == null) va = sortDir === 'desc' ? -Infinity : Infinity;
      if (vb == null) vb = sortDir === 'desc' ? -Infinity : Infinity;
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return a.repo.localeCompare(b.repo);
    });
    return arr;
  }, [repos, sortKey, sortDir]);

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 42,
    overscan: 20,
  });

  const getHealthScore = (repo) => {
    const tax = taxonomyByProject[repo.repo];
    if (!tax || tax.length === 0) return null;
    const minGap = Math.min(...tax.map((t) => t.gap_score));
    return Math.round((minGap / 5) * 100);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: GRID,
        borderBottom: '1px solid rgba(255,255,255,.08)',
        background: '#0a0c12',
      }}>
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            style={{
              ...headerCellStyle,
              cursor: col.sortable ? 'pointer' : 'default',
            }}
            onClick={() => col.sortable && handleSort(col.key)}
          >
            {col.label}
            {col.sortable && sortKey === col.key && (
              <span style={{ fontSize: 8 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>
            )}
          </div>
        ))}
      </div>

      <div style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: 10,
        color: 'rgba(255,255,255,.25)',
        padding: '6px 10px',
        borderBottom: '1px solid rgba(255,255,255,.04)',
      }}>
        {sorted.length.toLocaleString()} repos
      </div>

      <div
        ref={scrollRef}
        className="explorer-table"
        style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin' }}
      >
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((item) => {
            const repo = sorted[item.index];
            return (
              <div
                key={repo.repo}
                style={{
                  position: 'absolute',
                  top: item.start,
                  left: 0,
                  right: 0,
                  height: item.size,
                }}
              >
                <RepoRow
                  repo={repo}
                  sparkline={sparklines[repo.repo]}
                  healthScore={getHealthScore(repo)}
                  onClick={() => onRowClick(repo)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
