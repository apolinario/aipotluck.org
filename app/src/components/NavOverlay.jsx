import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { PALETTES } from '../data/palettes.js';

const navItems = [
  { label: 'Ecosystem', idx: 0 },
  { label: 'Roadmap', idx: 1 },
  { label: 'Story', idx: 3 },
  { label: 'Mission', idx: 4 },
];

const NAV_BP = 768;

export function NavOverlay({ mode, setMode, section, setSection }) {
  const [isCollapsed, setIsCollapsed] = useState(() => window.innerWidth < NAV_BP);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const onResize = () => {
      const collapsed = window.innerWidth < NAV_BP;
      setIsCollapsed(collapsed);
      if (!collapsed) setMenuOpen(false);
    };
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen]);

  const glassBtn = {
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
  };

  return (
    <>
      {/* Mode toggle — always visible */}
      <button
        type="button"
        onClick={() => setMode((m) => (m === 'dawn' ? 'dusk' : 'dawn'))}
        style={{ position: 'fixed', top: 22, left: 24, zIndex: 200, ...glassBtn }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.13)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.07)'; }}
      >
        <span style={{ fontSize: 13, lineHeight: 1 }}>{PALETTES[mode].icon}</span>
        {PALETTES[mode].label}
      </button>

      {isCollapsed ? (
        /* ── Hamburger (small/medium screens) ── */
        <div ref={menuRef} style={{ position: 'fixed', top: 22, right: 24, zIndex: 200 }}>
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            style={{ ...glassBtn, padding: '7px 11px' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.13)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.07)'; }}
          >
            {/* Three-line hamburger → X when open */}
            <span style={{ display: 'flex', flexDirection: 'column', gap: menuOpen ? 0 : 4, width: 16, position: 'relative', height: 12 }}>
              <span style={{
                display: 'block', width: '100%', height: 1,
                background: 'currentColor',
                transform: menuOpen ? 'translateY(5.5px) rotate(45deg)' : 'none',
                transition: 'transform 200ms ease',
                position: 'absolute', top: 0,
              }} />
              <span style={{
                display: 'block', width: '100%', height: 1,
                background: 'currentColor',
                opacity: menuOpen ? 0 : 1,
                transition: 'opacity 150ms ease',
                position: 'absolute', top: 5.5,
              }} />
              <span style={{
                display: 'block', width: '100%', height: 1,
                background: 'currentColor',
                transform: menuOpen ? 'translateY(-5.5px) rotate(-45deg)' : 'none',
                transition: 'transform 200ms ease',
                position: 'absolute', top: 11,
              }} />
            </span>
          </button>

          {/* Dropdown panel */}
          {menuOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              minWidth: 180,
              background: 'rgba(12,20,28,.82)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,.12)',
              borderRadius: 8,
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,.4)',
            }}>
              {navItems.map((item) => (
                <button
                  key={item.idx}
                  type="button"
                  onClick={() => { setSection(item.idx); setMenuOpen(false); }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    background: section === item.idx ? 'rgba(255,255,255,.08)' : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,.06)',
                    color: section === item.idx ? '#fff' : 'rgba(255,255,255,.55)',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 13,
                    padding: '12px 18px',
                    cursor: 'pointer',
                    transition: 'background 160ms ease, color 160ms ease',
                  }}
                  onMouseEnter={(e) => {
                    if (section !== item.idx) {
                      e.currentTarget.style.background = 'rgba(255,255,255,.05)';
                      e.currentTarget.style.color = '#fff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (section !== item.idx) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'rgba(255,255,255,.55)';
                    }
                  }}
                >
                  {item.label}
                </button>
              ))}
              <Link
                to="/app"
                onClick={() => setMenuOpen(false)}
                style={{
                  display: 'block',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#fff',
                  textDecoration: 'none',
                  padding: '12px 18px',
                  transition: 'background 160ms ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.06)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                Explore App →
              </Link>
            </div>
          )}
        </div>
      ) : (
        /* ── Full nav (large screens) ── */
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
              onMouseEnter={(e) => { if (section !== item.idx) e.currentTarget.style.color = 'rgba(255,255,255,.8)'; }}
              onMouseLeave={(e) => { if (section !== item.idx) e.currentTarget.style.color = 'rgba(255,255,255,.48)'; }}
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
      )}
    </>
  );
}
