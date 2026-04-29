const selectStyle = {
  width: '100%',
  background: 'rgba(255,255,255,.05)',
  border: '1px solid rgba(255,255,255,.12)',
  borderRadius: 6,
  color: '#fff',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 12,
  padding: '6px 8px',
  outline: 'none',
};

const labelStyle = {
  fontFamily: "'DM Mono', monospace",
  fontSize: 10,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,.4)',
  marginBottom: 6,
  display: 'block',
};

const checkboxRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12,
  color: 'rgba(255,255,255,.7)',
  cursor: 'pointer',
  marginBottom: 4,
};

function FilterGroup({ label, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

export function FilterSidebar({ filters, setFilter, clearFilters, activeCount, filterOptions, layers }) {
  const healthBuckets = ['healthy', 'fragile', 'gap'];

  const toggleHealth = (bucket) => {
    const current = filters.health;
    const next = current.includes(bucket)
      ? current.filter((h) => h !== bucket)
      : [...current, bucket];
    setFilter('health', next);
  };

  return (
    <div className="explorer-sidebar" style={{
      width: 220,
      flexShrink: 0,
      padding: '16px 20px',
      borderRight: '1px solid rgba(255,255,255,.06)',
      overflowY: 'auto',
      height: '100%',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 18,
      }}>
        <span style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13,
          fontWeight: 500,
          color: '#fff',
        }}>
          Filters
          {activeCount > 0 && (
            <span style={{
              marginLeft: 6,
              background: 'rgba(255,255,255,.12)',
              borderRadius: 999,
              padding: '1px 7px',
              fontSize: 10,
              color: 'rgba(255,255,255,.7)',
            }}>
              {activeCount}
            </span>
          )}
        </span>
        {activeCount > 0 && (
          <button
            onClick={clearFilters}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,.4)',
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Clear all
          </button>
        )}
      </div>

      <FilterGroup label="Layer">
        <select
          style={selectStyle}
          value={filters.layer || ''}
          onChange={(e) => {
            setFilter('layer', e.target.value || null);
            setFilter('subcategory', null);
          }}
        >
          <option value="">All layers</option>
          {layers.map((l) => (
            <option key={l.layer} value={l.layer}>{l.layer}</option>
          ))}
        </select>
      </FilterGroup>

      {filterOptions.subcategories.length > 0 && (
        <FilterGroup label="Subcategory">
          <select
            style={selectStyle}
            value={filters.subcategory || ''}
            onChange={(e) => setFilter('subcategory', e.target.value || null)}
          >
            <option value="">All subcategories</option>
            {filterOptions.subcategories.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </FilterGroup>
      )}

      <FilterGroup label="Health">
        {healthBuckets.map((bucket) => (
          <label key={bucket} style={checkboxRowStyle}>
            <input
              type="checkbox"
              checked={filters.health.includes(bucket)}
              onChange={() => toggleHealth(bucket)}
              style={{ accentColor: bucket === 'healthy' ? '#1b9e8a' : bucket === 'fragile' ? '#d9952a' : '#c8341d' }}
            />
            <span style={{ textTransform: 'capitalize' }}>{bucket}</span>
          </label>
        ))}
      </FilterGroup>

      <FilterGroup label="Country">
        <select
          style={selectStyle}
          value={filters.country || ''}
          onChange={(e) => setFilter('country', e.target.value || null)}
        >
          <option value="">All countries</option>
          {filterOptions.countries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </FilterGroup>

      <FilterGroup label="License">
        <select
          style={selectStyle}
          value={filters.license || ''}
          onChange={(e) => setFilter('license', e.target.value || null)}
        >
          <option value="">All licenses</option>
          {filterOptions.licenses.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </FilterGroup>

      <FilterGroup label="Activity (90d commits)">
        <select
          style={selectStyle}
          value={filters.activity || ''}
          onChange={(e) => setFilter('activity', e.target.value || null)}
        >
          <option value="">Any level</option>
          <option value="high">High (100+)</option>
          <option value="medium">Medium (10–99)</option>
          <option value="low">Low (&lt;10)</option>
        </select>
      </FilterGroup>

      <FilterGroup label="Artifacts">
        <label style={checkboxRowStyle}>
          <input
            type="checkbox"
            checked={filters.hasPackages}
            onChange={(e) => setFilter('hasPackages', e.target.checked)}
          />
          Has packages
        </label>
        <label style={checkboxRowStyle}>
          <input
            type="checkbox"
            checked={filters.hasModels}
            onChange={(e) => setFilter('hasModels', e.target.checked)}
          />
          Has models
        </label>
      </FilterGroup>
    </div>
  );
}
