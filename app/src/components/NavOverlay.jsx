import { Link } from 'react-router-dom';
import { PALETTES } from '../data/palettes.js';

const navItems = [
  { label: 'Ecosystem', idx: 0 },
  { label: 'Roadmap', idx: 1 },
  { label: 'Story', idx: 3 },
  { label: 'Mission', idx: 4 },
];

export function NavOverlay({ mode, setMode, section, setSection }) {
  return (
    <>
      <button
        type="button"
        onClick={() => setMode((m) => (m === 'dawn' ? 'dusk' : 'dawn'))}
        style={{
          position: 'fixed',
          top: 22,
          left: 24,
          zIndex: 200,
          background: 'rgba(255,255,255,.07)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(255,255,255,.14)',
          borderRadius: 6,
          cursor: 'pointer',
          color: '#fff',
          fontFamily: "'DM Mono', monospace",
          fontSize: 10,
          letterSpacing: '.1em',
          textTransform: 'uppercase',
          padding: '7px 13px',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          transition: 'background 200ms ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,.13)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,.07)';
        }}
      >
        <span style={{ fontSize: 13, lineHeight: 1 }}>{PALETTES[mode].icon}</span>
        {PALETTES[mode].label}
      </button>
      <nav style={{ position: 'fixed', top: 22, right: 24, zIndex: 200, display: 'flex', gap: 2, alignItems: 'center' }}>
        {navItems.map((item) => (
          <button
            key={item.idx}
            type="button"
            onClick={() => setSection(item.idx)}
            style={{
              background: section === item.idx ? 'rgba(255,255,255,.09)' : 'transparent',
              backdropFilter: section === item.idx ? 'blur(12px)' : 'none',
              border: 'none',
              borderRadius: 6,
              color: section === item.idx ? '#fff' : 'rgba(255,255,255,.48)',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              fontWeight: 400,
              padding: '7px 14px',
              cursor: 'pointer',
              transition: 'all 200ms ease',
            }}
            onMouseEnter={(e) => {
              if (section !== item.idx) e.currentTarget.style.color = 'rgba(255,255,255,.8)';
            }}
            onMouseLeave={(e) => {
              if (section !== item.idx) e.currentTarget.style.color = 'rgba(255,255,255,.48)';
            }}
          >
            {item.label}
          </button>
        ))}
        <Link
          to="/app"
          style={{
            marginLeft: 10,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            fontWeight: 500,
            color: '#fff',
            textDecoration: 'none',
            background: 'rgba(255,255,255,.07)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,.15)',
            borderRadius: 6,
            padding: '7px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 200ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,.14)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,.07)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,.15)';
          }}
        >
          Explore App
          <span style={{ opacity: 0.7 }}>→</span>
        </Link>
      </nav>
    </>
  );
}
