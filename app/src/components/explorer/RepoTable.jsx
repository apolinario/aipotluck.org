import { useState, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { RepoRow, TABLE_COLS } from './RepoRow.jsx';

const COLUMNS = [
  { key: 'repo', label: 'Repository', align: 'left' },
  { key: 'stars', label: 'Stars', align: 'right' },
  { key: '_sparkline', label: 'Activity (90d)', align: 'center', sortable: false },
  { key: 'total_contributors', label: 'Contributors', align: 'right' },
  { key: 'country', label: 'Country', align: 'left' },
  { key: '_health', label: '', align: 'center', sortable: false },
];

export function RepoTable({ repos, sparklines, packagesByRepo, modelsByRepo, taxonomyByProject, onRowClick }) {
  const [sortKey, setSortKey] = useState('stars');
  const [sortDir, setSortDir] = useState('desc');
  const scrollRef = useRef(null);

  const handleSort = (key) => {
    if (key.startsWith('_')) return;
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
    estimateSize: () => 48,
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
      {/* Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: TABLE_COLS,
        padding: '0 20px',
        borderBottom: '1px solid rgba(255,255,255,.08)',
        background: 'rgba(10,12,18,.95)',
        backdropFilter: 'blur(8px)',
      }}>
        {COLUMNS.map((col) => {
          const isSortable = col.sortable !== false;
          const isActive = sortKey === col.key;
          return (
            <div
              key={col.key}
              onClick={() => isSortable && handleSort(col.key)}
              style={{
                padding: '12px 0',
                paddingRight: col.align === 'right' ? 16 : 0,
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                color: isActive ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.25)',
                cursor: isSortable ? 'pointer' : 'default',
                userSelect: 'none',
                textAlign: col.align,
                display: 'flex',
                alignItems: 'center',
                justifyContent: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start',
                gap: 4,
              }}
            >
              {col.label}
              {isActive && <span style={{ fontSize: 8 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
            </div>
          );
        })}
      </div>

      {/* Count */}
      <div style={{
        padding: '6px 20px',
        fontFamily: "'DM Mono', monospace",
        fontSize: 10,
        color: 'rgba(255,255,255,.2)',
        borderBottom: '1px solid rgba(255,255,255,.04)',
      }}>
        {sorted.length.toLocaleString()} repos
      </div>

      {/* Virtualized rows */}
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
