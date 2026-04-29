import { formatStars } from '../../utils/format.js';

const PACKAGE_ICONS = {
  PIP: '\u{1F40D}', NPM: '\u{1F4E6}', GO: '\u{1F535}', RUST: '\u{1F980}', MAVEN: '☕', NUGET: '\u{1F49C}',
};

export function PackageList({ packages }) {
  if (!packages || packages.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {packages.map((p) => (
        <a
          key={`${p.package_source}-${p.package_name}`}
          href={p.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            background: 'rgba(255,255,255,.03)',
            border: '1px solid rgba(255,255,255,.06)',
            borderRadius: 6,
            textDecoration: 'none',
            color: 'rgba(255,255,255,.75)',
            fontSize: 12,
            transition: 'border-color 150ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.15)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.06)'; }}
        >
          <span>{PACKAGE_ICONS[p.package_source] || '\u{1F4E6}'}</span>
          <span style={{ flex: 1, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{p.package_name}</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{p.package_source}</span>
        </a>
      ))}
    </div>
  );
}

export function ModelList({ models }) {
  if (!models || models.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {models.map((m) => (
        <a
          key={m.model_id}
          href={m.url || `https://huggingface.co/${m.model_id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto auto',
            gap: 8,
            alignItems: 'center',
            padding: '8px 10px',
            background: 'rgba(255,255,255,.03)',
            border: '1px solid rgba(255,255,255,.06)',
            borderRadius: 6,
            textDecoration: 'none',
            color: 'rgba(255,255,255,.75)',
            fontSize: 12,
            transition: 'border-color 150ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.15)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.06)'; }}
        >
          <div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{m.model_id}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', marginTop: 2 }}>
              {[m.pipeline_tag, m.library_name, m.model_family].filter(Boolean).join(' · ')}
            </div>
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'rgba(255,255,255,.4)' }}>
            ↓{formatStars(m.downloads)}
          </div>
          {m.benchmark_avg != null && (
            <div style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              padding: '2px 6px',
              background: 'rgba(27,158,138,.15)',
              borderRadius: 4,
              color: '#1b9e8a',
            }}>
              {m.benchmark_avg.toFixed(1)}
            </div>
          )}
        </a>
      ))}
    </div>
  );
}
