import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { STACK_DATA } from './stackData.js';
import logoSvg from '../../assets/currentai-logo-full.svg';
import '../../styles/stack.css';

export function StackPage() {
  const [activeId, setActiveId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const tipRef = useRef(null);
  const activeElRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setActiveId(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const positionTooltip = useCallback(() => {
    if (!activeId || !activeElRef.current || !tipRef.current) return;
    const el = activeElRef.current;
    const tip = tipRef.current;
    const r = el.getBoundingClientRect();
    const gap = 12;
    const tw = Math.min(340, window.innerWidth - 24);
    const th = tip.offsetHeight || 420;
    let left = r.right + gap;
    let top = r.top;
    if (left + tw > window.innerWidth - gap) left = r.left - tw - gap;
    if (left < gap) left = gap;
    if (top + th > window.innerHeight - gap) top = window.innerHeight - th - gap;
    if (top < gap) top = gap;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    tip.style.width = `${tw}px`;
  }, [activeId]);

  useEffect(() => {
    const frame = requestAnimationFrame(positionTooltip);
    if (!activeId) {
      return () => cancelAnimationFrame(frame);
    }
    window.addEventListener('resize', positionTooltip);
    window.addEventListener('scroll', positionTooltip, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', positionTooltip);
      window.removeEventListener('scroll', positionTooltip, true);
    };
  }, [activeId, positionTooltip]);

  const handleCardClick = useCallback((e, id) => {
    e.stopPropagation();
    if (activeId === id) {
      setActiveId(null);
      return;
    }
    activeElRef.current = e.currentTarget;
    setActiveId(id);
  }, [activeId]);

  const handleBgClick = useCallback(() => setActiveId(null), []);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const matchIds = normalizedQuery
    ? new Set(
        Object.entries(STACK_DATA)
          .filter(([, d]) => {
            return d.title.toLowerCase().includes(normalizedQuery)
              || (d.lbl || '').toLowerCase().includes(normalizedQuery)
              || (d.tools || []).some(t => t.toLowerCase().includes(normalizedQuery))
              || (d.feats || []).some(f => f.toLowerCase().includes(normalizedQuery))
              || (d.desc || '').toLowerCase().includes(normalizedQuery);
          })
          .map(([id]) => id)
      )
    : null;

  const cardOpacity = (id) => matchIds ? (matchIds.has(id) ? 1 : 0.15) : 1;

  const activeFilter = (color) => {
    if (color === 'orange') return 'drop-shadow(0 0 5px rgba(255,76,36,0.45))';
    if (color === 'green') return 'drop-shadow(0 0 5px rgba(4,120,87,0.4))';
    if (color === 'gray') return 'drop-shadow(0 0 5px rgba(71,85,105,0.3))';
    return 'drop-shadow(0 0 5px rgba(37,99,235,0.4))';
  };

  const cardStyle = (id, color) => ({
    cursor: 'pointer',
    opacity: cardOpacity(id),
    filter: activeId === id ? activeFilter(color) : 'none',
  });

  const tipData = activeId ? STACK_DATA[activeId] : null;
  const accentColor = tipData
    ? tipData.color === 'orange' ? '#FF4C24'
    : tipData.color === 'green' ? '#047857'
    : tipData.color === 'gray' ? '#475569'
    : '#1d4ed8'
    : '#1d4ed8';
  const chipCls = tipData
    ? tipData.color === 'orange' ? 'orange'
    : tipData.color === 'green' ? 'green'
    : tipData.color === 'gray' ? 'gray'
    : 'blue'
    : 'blue';
  const barGrad = tipData
    ? tipData.color === 'orange' ? 'linear-gradient(90deg,#FF4C24,#fb923c)'
    : tipData.color === 'green' ? 'linear-gradient(90deg,#047857,#34d399)'
    : tipData.color === 'gray' ? 'linear-gradient(90deg,#475569,#94a3b8)'
    : 'linear-gradient(90deg,#1d4ed8,#60a5fa)'
    : '';
  const trendBg = tipData
    ? tipData.color === 'orange' ? '#fff7ed'
    : tipData.color === 'green' ? '#f0fdf4'
    : tipData.color === 'gray' ? '#f8fafc'
    : '#eff6ff'
    : '';
  const trendBorder = tipData
    ? tipData.color === 'orange' ? '#fed7aa'
    : tipData.color === 'green' ? '#bbf7d0'
    : tipData.color === 'gray' ? '#e2e8f0'
    : '#bfdbfe'
    : '';

  return (
    <div className="stack-page" onClick={handleBgClick}>
      <div className="stack-topbar" onClick={(e) => e.stopPropagation()}>
        <div className="stack-topbar-inner">
          <Link to="/v2" className="stack-brand">
            <img src={logoSvg} alt="Current AI" />
          </Link>
          <div className="stack-nav">
            <Link to="/app" className="stack-nav-link">Explorer</Link>
            <span className="stack-nav-link active">Stack</span>
          </div>
          <div className="stack-search">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              placeholder="Search layers, tools…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <a
            href="https://www.oso.xyz/currentai"
            target="_blank"
            rel="noopener noreferrer"
            className="stack-pill insights"
          >
            Insights ↗
          </a>
        </div>
      </div>
      <div className="stack-mobile-msg">
        <p>The AI Stack diagram is optimized for desktop viewing.</p>
        <Link to="/app">View Explorer →</Link>
      </div>
      <div className="stack-diagram-shell">
        <div className="stack-diagram-frame">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1100" preserveAspectRatio="xMidYMin meet" className="stack-svg" style={{ cursor: 'default' }}>
<defs>
  <filter id="coreShadow" x="-30%" y="-30%" width="160%" height="160%">
    <feDropShadow dx="0" dy="16" stdDeviation="20" floodColor="#020617" floodOpacity="0.36"/>
  </filter>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stopColor="#FFFFFF"/>
    <stop offset="1" stopColor="#F8FAFC"/>
  </linearGradient>
  <linearGradient id="dataStream" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stopColor="#DBEAFE" stopOpacity="0.9"/>
    <stop offset="1" stopColor="#60A5FA" stopOpacity="0.3"/>
  </linearGradient>
  <linearGradient id="systemsStream" x1="1" y1="0" x2="0" y2="0">
    <stop offset="0" stopColor="#FFEDD5" stopOpacity="0.9"/>
    <stop offset="1" stopColor="#FB923C" stopOpacity="0.3"/>
  </linearGradient>
  <linearGradient id="modelCore" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stopColor="#111827"/>
    <stop offset="1" stopColor="#020617"/>
  </linearGradient>

  {/* Label column clip path */}
  <clipPath id="labelClip"><rect x="22" y="0" width="165" height="1100"/></clipPath>

  {/* ── REUSABLE SVG ICON SYMBOLS ── */}
  {/* chat bubble */}
  <symbol id="ico-chat" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></symbol>
  {/* code brackets */}
  <symbol id="ico-code" viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><polyline points="8 6 2 12 8 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></symbol>
  {/* building */}
  <symbol id="ico-building" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7"/><path d="M9 9h6M9 12h6M9 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></symbol>
  {/* plus circle */}
  <symbol id="ico-plus" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.7"/><path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></symbol>
  {/* agent / person gear */}
  <symbol id="ico-agent" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="1.7"/><path d="M6 20v-2a6 6 0 0112 0v2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></symbol>
  {/* database */}
  <symbol id="ico-db" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3" fill="none" stroke="currentColor" strokeWidth="1.7"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" fill="none" stroke="currentColor" strokeWidth="1.7"/><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" fill="none" stroke="currentColor" strokeWidth="1.7"/></symbol>
  {/* workflow nodes */}
  <symbol id="ico-workflow" viewBox="0 0 24 24"><rect x="3" y="3" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.7"/><rect x="15" y="3" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.7"/><rect x="9" y="15" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.7"/><path d="M6 9v3h12V9M12 15v-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></symbol>
  {/* lightning bolt */}
  <symbol id="ico-lightning" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></symbol>
  {/* cloud */}
  <symbol id="ico-cloud" viewBox="0 0 24 24"><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" fill="none" stroke="currentColor" strokeWidth="1.7"/></symbol>
  {/* server */}
  <symbol id="ico-server" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7"/><rect x="2" y="14" width="20" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7"/><circle cx="6" cy="6" r="1" fill="currentColor"/><circle cx="6" cy="18" r="1" fill="currentColor"/></symbol>
  {/* star */}
  <symbol id="ico-star" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></symbol>
  {/* unlock */}
  <symbol id="ico-unlock" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7"/><path d="M7 11V7a5 5 0 019.9-1" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></symbol>
  {/* target / specialized */}
  <symbol id="ico-target" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.7"/><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></symbol>
  {/* sliders (fine-tune) */}
  <symbol id="ico-sliders" viewBox="0 0 24 24"><line x1="4" y1="6" x2="20" y2="6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><line x1="4" y1="18" x2="20" y2="18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><circle cx="9" cy="6" r="2.2" fill="#fff" stroke="currentColor" strokeWidth="1.5"/><circle cx="15" cy="12" r="2.2" fill="#fff" stroke="currentColor" strokeWidth="1.5"/><circle cx="10" cy="18" r="2.2" fill="#fff" stroke="currentColor" strokeWidth="1.5"/></symbol>
  {/* brain / reasoning */}
  <symbol id="ico-brain" viewBox="0 0 24 24"><path d="M9.5 2A2.5 2.5 0 007 4.5v1A2.5 2.5 0 004.5 8a2.5 2.5 0 000 5 2.5 2.5 0 002 2.46V17a3 3 0 006 0v-.54A2.5 2.5 0 0015 14a2.5 2.5 0 000-5A2.5 2.5 0 0017 6.5v-1A2.5 2.5 0 0014.5 3 2.5 2.5 0 0012 .5 2.5 2.5 0 009.5 2z" fill="none" stroke="currentColor" strokeWidth="1.6"/></symbol>
  {/* image/multimodal */}
  <symbol id="ico-image" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7"/><circle cx="8.5" cy="9.5" r="1.5" fill="currentColor"/><polyline points="21 15 16 10 5 21" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></symbol>
  {/* globe */}
  <symbol id="ico-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.7"/><line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.5"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z" fill="none" stroke="currentColor" strokeWidth="1.5"/></symbol>
  {/* users */}
  <symbol id="ico-users" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><circle cx="9" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="1.7"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></symbol>
  {/* waveform / synthetic */}
  <symbol id="ico-wave" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></symbol>
  {/* bar chart */}
  <symbol id="ico-chart" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="12" y1="20" x2="12" y2="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="6" y1="20" x2="6" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></symbol>
  {/* file / domain data */}
  <symbol id="ico-file" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="none" stroke="currentColor" strokeWidth="1.7"/><polyline points="14 2 14 8 20 8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></symbol>
  {/* grid / architecture */}
  <symbol id="ico-grid" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.7"/><rect x="14" y="3" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.7"/><rect x="3" y="14" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.7"/><rect x="14" y="14" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.7"/></symbol>
  {/* layers / training */}
  <symbol id="ico-layers" viewBox="0 0 24 24"><polygon points="12 2 2 7 12 12 22 7 12 2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><polyline points="2 17 12 22 22 17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><polyline points="2 12 12 17 22 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></symbol>
  {/* shield */}
  <symbol id="ico-shield" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></symbol>
  {/* shield check */}
  <symbol id="ico-shield-check" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><polyline points="9 12 11 14 15 10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></symbol>
  {/* search / eval */}
  <symbol id="ico-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" strokeWidth="1.7"/><line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></symbol>
  {/* speedometer / optimization */}
  <symbol id="ico-speed" viewBox="0 0 24 24"><path d="M12 20a8 8 0 100-16 8 8 0 000 16z" fill="none" stroke="currentColor" strokeWidth="1.7"/><path d="M12 12l4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></symbol>
  {/* cpu chip */}
  <symbol id="ico-cpu" viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1.7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M7 2v2M17 2v2M7 20v2M17 20v2M2 7h2M20 7h2M2 17h2M20 17h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></symbol>
  {/* memory chip */}
  <symbol id="ico-memory" viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7"/><path d="M6 6V4M10 6V4M14 6V4M18 6V4M6 18v2M10 18v2M14 18v2M18 18v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></symbol>
  {/* hard drive */}
  <symbol id="ico-drive" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.7"/><rect x="2" y="10" width="20" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.7"/><rect x="2" y="17" width="20" height="4" rx="1" fill="none" stroke="currentColor" strokeWidth="1.7"/><circle cx="6" cy="6" r="0.8" fill="currentColor"/><circle cx="6" cy="13" r="0.8" fill="currentColor"/></symbol>
  {/* network nodes */}
  <symbol id="ico-network" viewBox="0 0 24 24"><rect x="9" y="2" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.7"/><rect x="2" y="16" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.7"/><rect x="16" y="16" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.7"/><path d="M12 8v4M5 16v-4h14v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></symbol>
  {/* power/bolt ring */}
  <symbol id="ico-power" viewBox="0 0 24 24"><path d="M18.36 6.64A9 9 0 115.64 17.36" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><line x1="12" y1="2" x2="12" y2="12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></symbol>
  {/* lock */}
  <symbol id="ico-lock" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7"/><path d="M7 11V7a5 5 0 0110 0v4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></symbol>
  {/* leaf */}
  <symbol id="ico-leaf" viewBox="0 0 24 24"><path d="M17 8C8 10 5.9 16.17 3.82 19.24A1 1 0 004.64 21c.8 0 1.86-1.21 2.94-2.22 4.6-4.23 4.42 1.22 10 1.22 5 0 6-9 6-13a24 24 0 00-1-3c-.58.52-3.38 2.04-5.58 2z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></symbol>
  {/* scale/balance */}
  <symbol id="ico-scale" viewBox="0 0 24 24"><line x1="12" y1="3" x2="12" y2="21" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><path d="M5 21h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><path d="M5 9l-2 6h4L5 9zM19 9l-2 6h4L19 9z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M5 9h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></symbol>
  {/* trending up / monitoring */}
  <symbol id="ico-trending" viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><polyline points="17 6 23 6 23 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></symbol>
  {/* distribute / parallel training */}
  <symbol id="ico-distribute" viewBox="0 0 24 24"><circle cx="5" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.7"/><circle cx="19" cy="5" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.7"/><circle cx="19" cy="19" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.7"/><line x1="7.5" y1="10.5" x2="16.5" y2="6.5" stroke="currentColor" strokeWidth="1.5"/><line x1="7.5" y1="13.5" x2="16.5" y2="17.5" stroke="currentColor" strokeWidth="1.5"/></symbol>
</defs>

{/* BG */}
<rect width="1600" height="1100" fill="url(#bg)"/>

{/* ── HEADER (in-SVG title + subtitle) ── */}
<text x="800" y="30" fontSize="34" fontWeight="800" fill="#0f172a" textAnchor="middle" fontFamily="'Cormorant Garamond',serif">Manufacturing Intelligence</text>
<text x="800" y="50" fontSize="14.5" fontWeight="400" fill="#475569" textAnchor="middle" fontFamily="'DM Sans',sans-serif">How frontier AI is built from the ground up</text>
<line x1="18" y1="66" x2="1582" y2="66" stroke="#e2e8f0" strokeWidth="1"/>

{/* ── LAYER 1: APPLICATIONS ── */}
<rect x="22" y="90" width="1368" height="106" rx="10" fill="#fff" stroke="#d7dee8" strokeWidth="1" vectorEffect="non-scaling-stroke"/>
<rect x="22" y="90" width="165" height="106" rx="0" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1"/>
<g clipPath="url(#labelClip)">
  <text x="40" y="122" fontSize="12.5" fontWeight="800" fill="#1d4ed8" fontFamily="'DM Sans',sans-serif" className="layer-lbl" data-id="applications" onClick={(e) => handleCardClick(e, 'applications')} style={{cursor:'pointer'}}>APPLICATIONS</text>
  <text x="40" y="140" fontSize="9.5" fill="#475569" fontFamily="'DM Sans',sans-serif">Where AI meets</text>
  <text x="40" y="154" fontSize="9.5" fill="#475569" fontFamily="'DM Sans',sans-serif">users and creates</text>
  <text x="40" y="168" fontSize="9.5" fill="#475569" fontFamily="'DM Sans',sans-serif">value</text>
</g>

{/* Chat Assistants */}
<g className="card" onClick={(e) => handleCardClick(e, 'chat-assistants')} style={cardStyle('chat-assistants', 'blue')}>
  <rect x="210" y="104" width="270" height="78" rx="9" fill="#fff" stroke="#cbd5e1" strokeWidth="1"/>
  <rect x="224" y="118" width="36" height="36" rx="8" fill="#eff6ff"/>
  <use href="#ico-chat" x="231" y="125" width="22" height="22" color="#2563eb"/>
  <text x="272" y="131" fontSize="11.5" fontWeight="700" fill="#0f172a" fontFamily="'DM Sans',sans-serif">Chat Assistants</text>
  <text x="272" y="146" fontSize="9.5" fill="#475569" fontFamily="'DM Sans',sans-serif">Consumer and enterprise chat</text>
  <rect x="272" y="154" width="46" height="14" rx="4" fill="#f1f5f9" stroke="#e2e8f0"/><text x="295" y="164" fontSize="7.5" fontWeight="600" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">ChatGPT</text>
  <rect x="322" y="154" width="36" height="14" rx="4" fill="#f1f5f9" stroke="#e2e8f0"/><text x="340" y="164" fontSize="7.5" fontWeight="600" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">Claude</text>
  <rect x="362" y="154" width="40" height="14" rx="4" fill="#f1f5f9" stroke="#e2e8f0"/><text x="382" y="164" fontSize="7.5" fontWeight="600" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">Gemini</text>
</g>

{/* Coding Tools */}
<g className="card" onClick={(e) => handleCardClick(e, 'coding-tools')} style={cardStyle('coding-tools', 'blue')}>
  <rect x="498" y="104" width="270" height="78" rx="9" fill="#fff" stroke="#cbd5e1" strokeWidth="1"/>
  <rect x="512" y="118" width="36" height="36" rx="8" fill="#eff6ff"/>
  <use href="#ico-code" x="519" y="125" width="22" height="22" color="#2563eb"/>
  <text x="560" y="131" fontSize="11.5" fontWeight="700" fill="#0f172a" fontFamily="'DM Sans',sans-serif">Coding Tools</text>
  <text x="560" y="146" fontSize="9.5" fill="#475569" fontFamily="'DM Sans',sans-serif">AI-assisted development</text>
  <rect x="560" y="154" width="37" height="14" rx="4" fill="#f1f5f9" stroke="#e2e8f0"/><text x="578.5" y="164" fontSize="7.5" fontWeight="600" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">Cursor</text>
  <rect x="601" y="154" width="56" height="14" rx="4" fill="#f1f5f9" stroke="#e2e8f0"/><text x="629" y="164" fontSize="7.5" fontWeight="600" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">GH Copilot</text>
  <rect x="661" y="154" width="34" height="14" rx="4" fill="#f1f5f9" stroke="#e2e8f0"/><text x="678" y="164" fontSize="7.5" fontWeight="600" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">Aider</text>
</g>

{/* Vertical AI */}
<g className="card" onClick={(e) => handleCardClick(e, 'vertical-ai')} style={cardStyle('vertical-ai', 'blue')}>
  <rect x="786" y="104" width="270" height="78" rx="9" fill="#fff" stroke="#cbd5e1" strokeWidth="1"/>
  <rect x="800" y="118" width="36" height="36" rx="8" fill="#eff6ff"/>
  <use href="#ico-building" x="807" y="125" width="22" height="22" color="#2563eb"/>
  <text x="848" y="131" fontSize="11.5" fontWeight="700" fill="#0f172a" fontFamily="'DM Sans',sans-serif">Vertical AI</text>
  <text x="848" y="146" fontSize="9.5" fill="#475569" fontFamily="'DM Sans',sans-serif">Domain-specific AI solutions</text>
  <rect x="848" y="154" width="38" height="14" rx="4" fill="#f1f5f9" stroke="#e2e8f0"/><text x="867" y="164" fontSize="7.5" fontWeight="600" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">Harvey</text>
  <rect x="890" y="154" width="40" height="14" rx="4" fill="#f1f5f9" stroke="#e2e8f0"/><text x="910" y="164" fontSize="7.5" fontWeight="600" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">Cohere</text>
  <rect x="934" y="154" width="52" height="14" rx="4" fill="#f1f5f9" stroke="#e2e8f0"/><text x="960" y="164" fontSize="7.5" fontWeight="600" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">Perplexity</text>
</g>

{/* Your Application */}
<g className="card" onClick={(e) => handleCardClick(e, 'your-application')} style={cardStyle('your-application', 'blue')}>
  <rect x="1074" y="104" width="270" height="78" rx="9" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" strokeDasharray="5 4"/>
  <rect x="1088" y="118" width="36" height="36" rx="8" fill="#eff6ff"/>
  <use href="#ico-plus" x="1095" y="125" width="22" height="22" color="#2563eb"/>
  <text x="1136" y="131" fontSize="11.5" fontWeight="700" fill="#0f172a" fontFamily="'DM Sans',sans-serif">Your Application</text>
  <text x="1136" y="146" fontSize="9.5" fill="#475569" fontFamily="'DM Sans',sans-serif">Build the next AI breakthrough</text>
</g>

{/* ── LAYER 2: AGENT SYSTEMS ── */}
<rect x="22" y="196" width="1368" height="100" rx="8" fill="#f8f6ff" stroke="#dcd6fe" strokeWidth="1" vectorEffect="non-scaling-stroke"/>
<rect x="22" y="196" width="165" height="100" rx="0" fill="#fbfaff" stroke="#e9d5ff" strokeWidth="1"/>
<g clipPath="url(#labelClip)">
  <text x="40" y="226" fontSize="12.5" fontWeight="800" fill="#1d4ed8" fontFamily="'DM Sans',sans-serif" className="layer-lbl" data-id="agent-systems" onClick={(e) => handleCardClick(e, 'agent-systems')} style={{cursor:'pointer'}}>AGENT SYSTEMS</text>
  <text x="40" y="242" fontSize="12.5" fontWeight="800" fill="#1d4ed8" fontFamily="'DM Sans',sans-serif">+ MEMORY</text>
  <text x="40" y="265" fontSize="9.5" fill="#475569" fontFamily="'DM Sans',sans-serif">Planning, tools,</text>
  <text x="40" y="279" fontSize="9.5" fill="#475569" fontFamily="'DM Sans',sans-serif">memory</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'agent-frameworks')} style={cardStyle('agent-frameworks', 'blue')}>
  <rect x="210" y="206" width="372" height="78" rx="9" fill="#fff" stroke="#c4b5fd" strokeWidth="1"/>
  <rect x="224" y="225" width="36" height="36" rx="8" fill="#f5f3ff"/>
  <use href="#ico-agent" x="231" y="232" width="22" height="22" color="#4f46e5"/>
  <text x="273" y="239" fontSize="11.5" fontWeight="700" fill="#0f172a" fontFamily="'DM Sans',sans-serif">Agent Frameworks</text>
  <text x="273" y="254" fontSize="9.5" fill="#475569" fontFamily="'DM Sans',sans-serif">Reasoning, planning, and tool use</text>
  <rect x="273" y="262" width="52" height="14" rx="4" fill="#f1f5f9" stroke="#e2e8f0"/><text x="299" y="272" fontSize="7.5" fontWeight="600" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">LangChain</text>
  <rect x="329" y="262" width="56" height="14" rx="4" fill="#f1f5f9" stroke="#e2e8f0"/><text x="357" y="272" fontSize="7.5" fontWeight="600" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">LlamaIndex</text>
  <rect x="389" y="262" width="34" height="14" rx="4" fill="#f1f5f9" stroke="#e2e8f0"/><text x="406" y="272" fontSize="7.5" fontWeight="600" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">DSPy</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'memory-retrieval')} style={cardStyle('memory-retrieval', 'blue')}>
  <rect x="602" y="206" width="372" height="78" rx="9" fill="#fff" stroke="#c4b5fd" strokeWidth="1"/>
  <rect x="616" y="225" width="36" height="36" rx="8" fill="#f5f3ff"/>
  <use href="#ico-db" x="623" y="232" width="22" height="22" color="#4f46e5"/>
  <text x="665" y="239" fontSize="11.5" fontWeight="700" fill="#0f172a" fontFamily="'DM Sans',sans-serif">Memory & Knowledge Retrieval</text>
  <text x="665" y="254" fontSize="9.5" fill="#475569" fontFamily="'DM Sans',sans-serif">RAG, vector search, and memory</text>
  <rect x="665" y="262" width="46" height="14" rx="4" fill="#f1f5f9" stroke="#e2e8f0"/><text x="688" y="272" fontSize="7.5" fontWeight="600" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">Pinecone</text>
  <rect x="715" y="262" width="47" height="14" rx="4" fill="#f1f5f9" stroke="#e2e8f0"/><text x="738.5" y="272" fontSize="7.5" fontWeight="600" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">Weaviate</text>
  <rect x="766" y="262" width="40" height="14" rx="4" fill="#f1f5f9" stroke="#e2e8f0"/><text x="786" y="272" fontSize="7.5" fontWeight="600" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">Chroma</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'tool-workflow')} style={cardStyle('tool-workflow', 'blue')}>
  <rect x="994" y="206" width="372" height="78" rx="9" fill="#fff" stroke="#c4b5fd" strokeWidth="1"/>
  <rect x="1008" y="225" width="36" height="36" rx="8" fill="#f5f3ff"/>
  <use href="#ico-workflow" x="1015" y="232" width="22" height="22" color="#4f46e5"/>
  <text x="1057" y="239" fontSize="11.5" fontWeight="700" fill="#0f172a" fontFamily="'DM Sans',sans-serif">Tool Use & Workflow Logic</text>
  <text x="1057" y="254" fontSize="9.5" fill="#475569" fontFamily="'DM Sans',sans-serif">Planning, tool calling, multi-step execution</text>
  <rect x="1057" y="262" width="46" height="14" rx="4" fill="#f1f5f9" stroke="#e2e8f0"/><text x="1080" y="272" fontSize="7.5" fontWeight="600" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">Planning</text>
  <rect x="1107" y="262" width="32" height="14" rx="4" fill="#f1f5f9" stroke="#e2e8f0"/><text x="1123" y="272" fontSize="7.5" fontWeight="600" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">Tools</text>
  <rect x="1143" y="262" width="52" height="14" rx="4" fill="#f1f5f9" stroke="#e2e8f0"/><text x="1169" y="272" fontSize="7.5" fontWeight="600" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">Workflows</text>
</g>

{/* ── LAYER 3: DEPLOYMENT ── */}
<rect x="22" y="296" width="1368" height="100" rx="8" fill="#f0f9ff" stroke="#bae6fd" strokeWidth="1" vectorEffect="non-scaling-stroke"/>
<rect x="22" y="296" width="165" height="100" rx="0" fill="#f0f9ff" stroke="#bae6fd" strokeWidth="1"/>
<g clipPath="url(#labelClip)">
  <text x="40" y="325" fontSize="12.5" fontWeight="800" fill="#0284c7" fontFamily="'DM Sans',sans-serif" className="layer-lbl" data-id="deployment" onClick={(e) => handleCardClick(e, 'deployment')} style={{cursor:'pointer'}}>DEPLOYMENT</text>
  <text x="40" y="341" fontSize="12.5" fontWeight="800" fill="#0284c7" fontFamily="'DM Sans',sans-serif">+ SERVING RUNTIME</text>
  <text x="40" y="364" fontSize="9.5" fill="#475569" fontFamily="'DM Sans',sans-serif">Delivering intelligence</text>
  <text x="40" y="378" fontSize="9.5" fill="#475569" fontFamily="'DM Sans',sans-serif">to users at scale</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'serving-runtimes')} style={cardStyle('serving-runtimes', 'blue')}>
  <rect x="210" y="307" width="372" height="78" rx="9" fill="#fff" stroke="#bae6fd" strokeWidth="1"/>
  <rect x="224" y="325" width="36" height="36" rx="8" fill="#e0f2fe"/>
  <use href="#ico-lightning" x="231" y="332" width="22" height="22" color="#0284c7"/>
  <text x="273" y="338" fontSize="11.5" fontWeight="700" fill="#0f172a" fontFamily="'DM Sans',sans-serif">Serving Runtimes</text>
  <text x="273" y="353" fontSize="9.5" fill="#475569" fontFamily="'DM Sans',sans-serif">High-performance model serving</text>
  <rect x="273" y="362" width="30" height="14" rx="4" fill="#e0f2fe" stroke="#bae6fd"/><text x="288" y="372" fontSize="7.5" fontWeight="600" fill="#0369a1" textAnchor="middle" fontFamily="'DM Mono',monospace">vLLM</text>
  <rect x="307" y="362" width="26" height="14" rx="4" fill="#e0f2fe" stroke="#bae6fd"/><text x="320" y="372" fontSize="7.5" fontWeight="600" fill="#0369a1" textAnchor="middle" fontFamily="'DM Mono',monospace">TGI</text>
  <rect x="337" y="362" width="38" height="14" rx="4" fill="#e0f2fe" stroke="#bae6fd"/><text x="356" y="372" fontSize="7.5" fontWeight="600" fill="#0369a1" textAnchor="middle" fontFamily="'DM Mono',monospace">Triton</text>
  <rect x="379" y="362" width="44" height="14" rx="4" fill="#e0f2fe" stroke="#bae6fd"/><text x="401" y="372" fontSize="7.5" fontWeight="600" fill="#0369a1" textAnchor="middle" fontFamily="'DM Mono',monospace">SGLang</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'apis-gateways')} style={cardStyle('apis-gateways', 'blue')}>
  <rect x="602" y="307" width="372" height="78" rx="9" fill="#fff" stroke="#bae6fd" strokeWidth="1"/>
  <rect x="616" y="325" width="36" height="36" rx="8" fill="#e0f2fe"/>
  <use href="#ico-cloud" x="623" y="332" width="22" height="22" color="#0284c7"/>
  <text x="665" y="338" fontSize="11.5" fontWeight="700" fill="#0f172a" fontFamily="'DM Sans',sans-serif">APIs & Gateways</text>
  <text x="665" y="353" fontSize="9.5" fill="#475569" fontFamily="'DM Sans',sans-serif">Managed endpoints and API gateways</text>
  <rect x="665" y="362" width="40" height="14" rx="4" fill="#e0f2fe" stroke="#bae6fd"/><text x="685" y="372" fontSize="7.5" fontWeight="600" fill="#0369a1" textAnchor="middle" fontFamily="'DM Mono',monospace">OpenAI</text>
  <rect x="709" y="362" width="52" height="14" rx="4" fill="#e0f2fe" stroke="#bae6fd"/><text x="735" y="372" fontSize="7.5" fontWeight="600" fill="#0369a1" textAnchor="middle" fontFamily="'DM Mono',monospace">Anthropic</text>
  <rect x="765" y="362" width="46" height="14" rx="4" fill="#e0f2fe" stroke="#bae6fd"/><text x="788" y="372" fontSize="7.5" fontWeight="600" fill="#0369a1" textAnchor="middle" fontFamily="'DM Mono',monospace">Together</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'cluster-mgmt')} style={cardStyle('cluster-mgmt', 'blue')}>
  <rect x="994" y="307" width="372" height="78" rx="9" fill="#fff" stroke="#bae6fd" strokeWidth="1"/>
  <rect x="1008" y="325" width="36" height="36" rx="8" fill="#e0f2fe"/>
  <use href="#ico-server" x="1015" y="332" width="22" height="22" color="#0284c7"/>
  <text x="1057" y="338" fontSize="11.5" fontWeight="700" fill="#0f172a" fontFamily="'DM Sans',sans-serif">Cluster & Container Mgmt</text>
  <text x="1057" y="353" fontSize="9.5" fill="#475569" fontFamily="'DM Sans',sans-serif">Job scheduling, routing, scaling, reliability</text>
  <rect x="1057" y="362" width="58" height="14" rx="4" fill="#e0f2fe" stroke="#bae6fd"/><text x="1086" y="372" fontSize="7.5" fontWeight="600" fill="#0369a1" textAnchor="middle" fontFamily="'DM Mono',monospace">Kubernetes</text>
  <rect x="1119" y="362" width="40" height="14" rx="4" fill="#e0f2fe" stroke="#bae6fd"/><text x="1139" y="372" fontSize="7.5" fontWeight="600" fill="#0369a1" textAnchor="middle" fontFamily="'DM Mono',monospace">Docker</text>
  <rect x="1163" y="362" width="36" height="14" rx="4" fill="#e0f2fe" stroke="#bae6fd"/><text x="1181" y="372" fontSize="7.5" fontWeight="600" fill="#0369a1" textAnchor="middle" fontFamily="'DM Mono',monospace">Slurm</text>
</g>

{/* ── FUNNEL SHAPES (no arrows, just shapes + flow lines) ── */}
<path d="M 30 396 C 172 396, 270 434, 438 506 L 438 682 C 270 724, 172 724, 30 724 Z" fill="url(#dataStream)" stroke="#93c5fd" strokeWidth="1.2" vectorEffect="non-scaling-stroke"/>
<path d="M 1382 396 C 1240 396, 1150 434, 1082 506 L 1082 682 C 1150 724, 1240 724, 1382 724 Z" fill="url(#systemsStream)" stroke="#fdba74" strokeWidth="1.2" vectorEffect="non-scaling-stroke"/>



{/* ── TRAINING DATA (Layer 5) ── */}
<text x="40" y="438" fontSize="12.5" fontWeight="800" fill="#1d4ed8" fontFamily="'DM Sans',sans-serif" className="layer-lbl" data-id="training-data" onClick={(e) => handleCardClick(e, 'training-data')} style={{cursor:'pointer'}}>TRAINING DATA</text>
<text x="40" y="455" fontSize="9" fill="#334155" fontFamily="'DM Sans',sans-serif">Raw material for intelligence</text>

<g className="card" onClick={(e) => handleCardClick(e, 'pretraining')} style={cardStyle('pretraining', 'blue')}>
  <rect x="48" y="470" width="228" height="50" rx="8" fill="#fff" stroke="#93c5fd" strokeWidth="1"/>
  <rect x="58" y="480" width="22" height="22" rx="5" fill="#eff6ff"/><use href="#ico-globe" x="58" y="480" width="22" height="22" color="#2563eb"/>
  <text x="88" y="488" fontSize="9.5" fontWeight="700" fill="#1e3a8a" fontFamily="'DM Sans',sans-serif">Pretraining Corpora</text>
  <text x="88" y="501" fontSize="8.5" fill="#334155" fontFamily="'DM Sans',sans-serif">Web, books, code, news</text>
  <rect x="88" y="504" width="62" height="12" rx="3" fill="#eff6ff" stroke="#bfdbfe"/><text x="119" y="513" fontSize="7" fill="#1d4ed8" textAnchor="middle" fontFamily="'DM Mono',monospace">Common Crawl</text>
  <rect x="154" y="504" width="42" height="12" rx="3" fill="#eff6ff" stroke="#bfdbfe"/><text x="175" y="513" fontSize="7" fill="#1d4ed8" textAnchor="middle" fontFamily="'DM Mono',monospace">FineWeb</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'human-feedback')} style={cardStyle('human-feedback', 'blue')}>
  <rect x="48" y="528" width="228" height="50" rx="8" fill="#fff" stroke="#93c5fd" strokeWidth="1"/>
  <rect x="58" y="538" width="22" height="22" rx="5" fill="#eff6ff"/><use href="#ico-users" x="58" y="538" width="22" height="22" color="#2563eb"/>
  <text x="88" y="546" fontSize="9.5" fontWeight="700" fill="#1e3a8a" fontFamily="'DM Sans',sans-serif">Human Feedback Data</text>
  <text x="88" y="559" fontSize="8.5" fill="#334155" fontFamily="'DM Sans',sans-serif">RLHF, preferences, alignments</text>
  <rect x="88" y="562" width="40" height="12" rx="3" fill="#eff6ff" stroke="#bfdbfe"/><text x="108" y="571" fontSize="7" fill="#1d4ed8" textAnchor="middle" fontFamily="'DM Mono',monospace">Scale AI</text>
  <rect x="132" y="562" width="66" height="12" rx="3" fill="#eff6ff" stroke="#bfdbfe"/><text x="165" y="571" fontSize="7" fill="#1d4ed8" textAnchor="middle" fontFamily="'DM Mono',monospace">UltraFeedback</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'synthetic-data')} style={cardStyle('synthetic-data', 'blue')}>
  <rect x="48" y="586" width="228" height="50" rx="8" fill="#fff" stroke="#93c5fd" strokeWidth="1"/>
  <rect x="58" y="596" width="22" height="22" rx="5" fill="#eff6ff"/><use href="#ico-wave" x="58" y="596" width="22" height="22" color="#2563eb"/>
  <text x="88" y="604" fontSize="9.5" fontWeight="700" fill="#1e3a8a" fontFamily="'DM Sans',sans-serif">Synthetic Data</text>
  <text x="88" y="617" fontSize="8.5" fill="#334155" fontFamily="'DM Sans',sans-serif">Generated data for training</text>
  <rect x="88" y="620" width="46" height="12" rx="3" fill="#eff6ff" stroke="#bfdbfe"/><text x="111" y="629" fontSize="7" fill="#1d4ed8" textAnchor="middle" fontFamily="'DM Mono',monospace">distilabel</text>
  <rect x="138" y="620" width="56" height="12" rx="3" fill="#eff6ff" stroke="#bfdbfe"/><text x="166" y="629" fontSize="7" fill="#1d4ed8" textAnchor="middle" fontFamily="'DM Mono',monospace">Cosmopedia</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'eval-datasets')} style={cardStyle('eval-datasets', 'blue')}>
  <rect x="48" y="644" width="228" height="50" rx="8" fill="#fff" stroke="#93c5fd" strokeWidth="1"/>
  <rect x="58" y="654" width="22" height="22" rx="5" fill="#eff6ff"/><use href="#ico-chart" x="58" y="654" width="22" height="22" color="#2563eb"/>
  <text x="88" y="662" fontSize="9.5" fontWeight="700" fill="#1e3a8a" fontFamily="'DM Sans',sans-serif">Evaluation Datasets</text>
  <text x="88" y="675" fontSize="8.5" fill="#334155" fontFamily="'DM Sans',sans-serif">Benchmarks, tests, safety sets</text>
  <rect x="88" y="678" width="32" height="12" rx="3" fill="#eff6ff" stroke="#bfdbfe"/><text x="104" y="687" fontSize="7" fill="#1d4ed8" textAnchor="middle" fontFamily="'DM Mono',monospace">MMLU</text>
  <rect x="124" y="678" width="52" height="12" rx="3" fill="#eff6ff" stroke="#bfdbfe"/><text x="150" y="687" fontSize="7" fill="#1d4ed8" textAnchor="middle" fontFamily="'DM Mono',monospace">HumanEval</text>
  <rect x="180" y="678" width="32" height="12" rx="3" fill="#eff6ff" stroke="#bfdbfe"/><text x="196" y="687" fontSize="7" fill="#1d4ed8" textAnchor="middle" fontFamily="'DM Mono',monospace">Arena</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'domain-data')} style={cardStyle('domain-data', 'blue')}>
  <rect x="48" y="702" width="226" height="50" rx="8" fill="#fff" stroke="#93c5fd" strokeWidth="1"/>
  <rect x="58" y="712" width="22" height="22" rx="5" fill="#eff6ff"/><use href="#ico-file" x="58" y="712" width="22" height="22" color="#2563eb"/>
  <text x="88" y="720" fontSize="9.5" fontWeight="700" fill="#1e3a8a" fontFamily="'DM Sans',sans-serif">Domain & Special Data</text>
  <text x="88" y="733" fontSize="8.5" fill="#334155" fontFamily="'DM Sans',sans-serif">Industrial, scientific, private</text>
  <rect x="88" y="736" width="38" height="12" rx="3" fill="#eff6ff" stroke="#bfdbfe"/><text x="107" y="745" fontSize="7" fill="#1d4ed8" textAnchor="middle" fontFamily="'DM Mono',monospace">PubMed</text>
  <rect x="130" y="736" width="30" height="12" rx="3" fill="#eff6ff" stroke="#bfdbfe"/><text x="145" y="745" fontSize="7" fill="#1d4ed8" textAnchor="middle" fontFamily="'DM Mono',monospace">Legal</text>
  <rect x="164" y="736" width="28" height="12" rx="3" fill="#eff6ff" stroke="#bfdbfe"/><text x="178" y="745" fontSize="7" fill="#1d4ed8" textAnchor="middle" fontFamily="'DM Mono',monospace">Math</text>
</g>

{/* ── LAYER 4: MODELS ── */}
<g className="card" onClick={(e) => handleCardClick(e, 'models')} style={cardStyle('models', 'blue')}>
  <rect x="440" y="440" width="640" height="290" rx="28" fill="url(#modelCore)" stroke="#334155" strokeWidth="1.5" filter="url(#coreShadow)" vectorEffect="non-scaling-stroke"/>
  <text x="760" y="484" fontSize="26" fontWeight="800" fill="#f8fafc" textAnchor="middle" fontFamily="'DM Sans',sans-serif">MODELS</text>
  <text x="760" y="504" fontSize="12" fontWeight="400" fill="#9ca3af" textAnchor="middle" fontFamily="'DM Sans',sans-serif" fontStyle="italic">The strategic core — forms of intelligence</text>
</g>

{/* Model row 1 — 3 cards × 190px, 12px gaps, starting x=470 */}
<g className="card" onClick={(e) => handleCardClick(e, 'frontier-models')} style={cardStyle('frontier-models', 'blue')}>
  <rect x="470" y="518" width="190" height="78" rx="8" fill="#111827" stroke="#4b5563" strokeWidth="1"/>
  <rect x="480" y="528" width="26" height="26" rx="6" fill="#1f2937"/><use href="#ico-star" x="480" y="528" width="26" height="26" color="#e2e8f0"/>
  <text x="514" y="543" fontSize="10.5" fontWeight="700" fill="#f8fafc" fontFamily="'DM Sans',sans-serif">Frontier Models</text>
  <text x="514" y="558" fontSize="8.5" fill="#9ca3af" fontFamily="'DM Sans',sans-serif">Proprietary frontier models</text>
  <rect x="514" y="568" width="38" height="12" rx="3" fill="#1f2937" stroke="#374151"/><text x="533" y="577" fontSize="7" fill="#9ca3af" textAnchor="middle" fontFamily="'DM Mono',monospace">GPT-4o</text>
  <rect x="556" y="568" width="38" height="12" rx="3" fill="#1f2937" stroke="#374151"/><text x="575" y="577" fontSize="7" fill="#9ca3af" textAnchor="middle" fontFamily="'DM Mono',monospace">Claude</text>
  <rect x="598" y="568" width="36" height="12" rx="3" fill="#1f2937" stroke="#374151"/><text x="616" y="577" fontSize="7" fill="#9ca3af" textAnchor="middle" fontFamily="'DM Mono',monospace">Gemini</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'open-models')} style={cardStyle('open-models', 'blue')}>
  <rect x="672" y="518" width="190" height="78" rx="8" fill="#111827" stroke="#4b5563" strokeWidth="1"/>
  <rect x="682" y="528" width="26" height="26" rx="6" fill="#1f2937"/><use href="#ico-unlock" x="682" y="528" width="26" height="26" color="#e2e8f0"/>
  <text x="716" y="543" fontSize="10.5" fontWeight="700" fill="#f8fafc" fontFamily="'DM Sans',sans-serif">Open Models</text>
  <text x="716" y="558" fontSize="8.5" fill="#9ca3af" fontFamily="'DM Sans',sans-serif">Open-weight foundation</text>
  <rect x="716" y="568" width="42" height="12" rx="3" fill="#1f2937" stroke="#374151"/><text x="737" y="577" fontSize="7" fill="#9ca3af" textAnchor="middle" fontFamily="'DM Mono',monospace">Llama 3</text>
  <rect x="762" y="568" width="36" height="12" rx="3" fill="#1f2937" stroke="#374151"/><text x="780" y="577" fontSize="7" fill="#9ca3af" textAnchor="middle" fontFamily="'DM Mono',monospace">Mistral</text>
  <rect x="802" y="568" width="48" height="12" rx="3" fill="#1f2937" stroke="#374151"/><text x="826" y="577" fontSize="7" fill="#9ca3af" textAnchor="middle" fontFamily="'DM Mono',monospace">DeepSeek</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'specialized-models')} style={cardStyle('specialized-models', 'blue')}>
  <rect x="854" y="518" width="190" height="78" rx="8" fill="#111827" stroke="#4b5563" strokeWidth="1"/>
  <rect x="864" y="528" width="26" height="26" rx="6" fill="#1f2937"/><use href="#ico-target" x="864" y="528" width="26" height="26" color="#e2e8f0"/>
  <text x="898" y="543" fontSize="10.5" fontWeight="700" fill="#f8fafc" fontFamily="'DM Sans',sans-serif">Specialized Models</text>
  <text x="898" y="558" fontSize="8.5" fill="#9ca3af" fontFamily="'DM Sans',sans-serif">Domain-adapted models</text>
  <rect x="898" y="568" width="56" height="12" rx="3" fill="#1f2937" stroke="#374151"/><text x="926" y="577" fontSize="7" fill="#9ca3af" textAnchor="middle" fontFamily="'DM Mono',monospace">MedGemma</text>
  <rect x="958" y="568" width="52" height="12" rx="3" fill="#1f2937" stroke="#374151"/><text x="984" y="577" fontSize="7" fill="#9ca3af" textAnchor="middle" fontFamily="'DM Mono',monospace">Code Llama</text>
</g>

{/* Model row 2 */}
<g className="card" onClick={(e) => handleCardClick(e, 'fine-tuned-models')} style={cardStyle('fine-tuned-models', 'blue')}>
  <rect x="470" y="608" width="190" height="78" rx="8" fill="#111827" stroke="#4b5563" strokeWidth="1"/>
  <rect x="480" y="618" width="26" height="26" rx="6" fill="#1f2937"/><use href="#ico-sliders" x="480" y="618" width="26" height="26" color="#e2e8f0"/>
  <text x="514" y="633" fontSize="10.5" fontWeight="700" fill="#f8fafc" fontFamily="'DM Sans',sans-serif">Fine-tuned Models</text>
  <text x="514" y="648" fontSize="8.5" fill="#9ca3af" fontFamily="'DM Sans',sans-serif">Instruction & alignment tuned</text>
  <rect x="514" y="658" width="30" height="12" rx="3" fill="#1f2937" stroke="#374151"/><text x="529" y="667" fontSize="7" fill="#9ca3af" textAnchor="middle" fontFamily="'DM Mono',monospace">LoRA</text>
  <rect x="548" y="658" width="48" height="12" rx="3" fill="#1f2937" stroke="#374151"/><text x="572" y="667" fontSize="7" fill="#9ca3af" textAnchor="middle" fontFamily="'DM Mono',monospace">Adapters</text>
  <rect x="600" y="658" width="30" height="12" rx="3" fill="#1f2937" stroke="#374151"/><text x="615" y="667" fontSize="7" fill="#9ca3af" textAnchor="middle" fontFamily="'DM Mono',monospace">PEFT</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'reasoning-models')} style={cardStyle('reasoning-models', 'blue')}>
  <rect x="672" y="608" width="190" height="78" rx="8" fill="#111827" stroke="#4b5563" strokeWidth="1"/>
  <rect x="682" y="618" width="26" height="26" rx="6" fill="#1f2937"/><use href="#ico-brain" x="682" y="618" width="26" height="26" color="#e2e8f0"/>
  <text x="716" y="633" fontSize="10.5" fontWeight="700" fill="#f8fafc" fontFamily="'DM Sans',sans-serif">Reasoning Models</text>
  <text x="716" y="648" fontSize="8.5" fill="#9ca3af" fontFamily="'DM Sans',sans-serif">Chain-of-thought reasoning</text>
  <rect x="716" y="658" width="20" height="12" rx="3" fill="#1f2937" stroke="#374151"/><text x="726" y="667" fontSize="7" fill="#9ca3af" textAnchor="middle" fontFamily="'DM Mono',monospace">o3</text>
  <rect x="740" y="658" width="20" height="12" rx="3" fill="#1f2937" stroke="#374151"/><text x="750" y="667" fontSize="7" fill="#9ca3af" textAnchor="middle" fontFamily="'DM Mono',monospace">R1</text>
  <rect x="764" y="658" width="28" height="12" rx="3" fill="#1f2937" stroke="#374151"/><text x="778" y="667" fontSize="7" fill="#9ca3af" textAnchor="middle" fontFamily="'DM Mono',monospace">QwQ</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'multimodal-models')} style={cardStyle('multimodal-models', 'blue')}>
  <rect x="854" y="608" width="190" height="78" rx="8" fill="#111827" stroke="#4b5563" strokeWidth="1"/>
  <rect x="864" y="618" width="26" height="26" rx="6" fill="#1f2937"/><use href="#ico-image" x="864" y="618" width="26" height="26" color="#e2e8f0"/>
  <text x="898" y="633" fontSize="10.5" fontWeight="700" fill="#f8fafc" fontFamily="'DM Sans',sans-serif">Multimodal Models</text>
  <text x="898" y="648" fontSize="8.5" fill="#9ca3af" fontFamily="'DM Sans',sans-serif">Cross-modal understanding</text>
  <rect x="898" y="658" width="38" height="12" rx="3" fill="#1f2937" stroke="#374151"/><text x="917" y="667" fontSize="7" fill="#9ca3af" textAnchor="middle" fontFamily="'DM Mono',monospace">GPT-4o</text>
  <rect x="940" y="658" width="36" height="12" rx="3" fill="#1f2937" stroke="#374151"/><text x="958" y="667" fontSize="7" fill="#9ca3af" textAnchor="middle" fontFamily="'DM Mono',monospace">Gemini</text>
  <rect x="980" y="658" width="34" height="12" rx="3" fill="#1f2937" stroke="#374151"/><text x="997" y="667" fontSize="7" fill="#9ca3af" textAnchor="middle" fontFamily="'DM Mono',monospace">LLaVA</text>
</g>

{/* ── MODEL SYSTEMS (Layer 6) — aligned with Layer 5 top ── */}
<text x="1092" y="438" fontSize="12.5" fontWeight="800" fill="#FF4C24" fontFamily="'DM Sans',sans-serif" className="layer-lbl" data-id="model-systems" onClick={(e) => handleCardClick(e, 'model-systems')} style={{cursor:'pointer'}}>MODEL SYSTEMS & OPTIMIZATION</text>
<text x="1092" y="455" fontSize="9" fill="#334155" fontFamily="'DM Sans',sans-serif">The recipe for building better models</text>

<g className="card" onClick={(e) => handleCardClick(e, 'model-arch')} style={cardStyle('model-arch', 'orange')}>
  <rect x="1092" y="470" width="254" height="50" rx="8" fill="#fff" stroke="#fdba74" strokeWidth="1"/>
  <rect x="1102" y="480" width="22" height="22" rx="5" fill="#fff7ed"/><use href="#ico-grid" x="1102" y="480" width="22" height="22" color="#FF4C24"/>
  <text x="1132" y="488" fontSize="9.5" fontWeight="700" fill="#9a3412" fontFamily="'DM Sans',sans-serif">Model Architecture</text>
  <text x="1132" y="501" fontSize="8.5" fill="#334155" fontFamily="'DM Sans',sans-serif">Designing model structures</text>
  <rect x="1132" y="504" width="58" height="12" rx="3" fill="#fff7ed" stroke="#fed7aa"/><text x="1161" y="513" fontSize="7" fill="#c2410c" textAnchor="middle" fontFamily="'DM Mono',monospace">Transformer</text>
  <rect x="1194" y="504" width="28" height="12" rx="3" fill="#fff7ed" stroke="#fed7aa"/><text x="1208" y="513" fontSize="7" fill="#c2410c" textAnchor="middle" fontFamily="'DM Mono',monospace">MoE</text>
  <rect x="1226" y="504" width="36" height="12" rx="3" fill="#fff7ed" stroke="#fed7aa"/><text x="1244" y="513" fontSize="7" fill="#c2410c" textAnchor="middle" fontFamily="'DM Mono',monospace">Mamba</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'training-systems')} style={cardStyle('training-systems', 'orange')}>
  <rect x="1092" y="524" width="254" height="50" rx="8" fill="#fff" stroke="#fdba74" strokeWidth="1"/>
  <rect x="1102" y="534" width="22" height="22" rx="5" fill="#fff7ed"/><use href="#ico-distribute" x="1102" y="534" width="22" height="22" color="#FF4C24"/>
  <text x="1132" y="542" fontSize="9.5" fontWeight="700" fill="#9a3412" fontFamily="'DM Sans',sans-serif">Training Systems</text>
  <text x="1132" y="555" fontSize="8.5" fill="#334155" fontFamily="'DM Sans',sans-serif">Distributed training at scale</text>
  <rect x="1132" y="558" width="30" height="12" rx="3" fill="#fff7ed" stroke="#fed7aa"/><text x="1147" y="567" fontSize="7" fill="#c2410c" textAnchor="middle" fontFamily="'DM Mono',monospace">FSDP</text>
  <rect x="1166" y="558" width="54" height="12" rx="3" fill="#fff7ed" stroke="#fed7aa"/><text x="1193" y="567" fontSize="7" fill="#c2410c" textAnchor="middle" fontFamily="'DM Mono',monospace">DeepSpeed</text>
  <rect x="1224" y="558" width="50" height="12" rx="3" fill="#fff7ed" stroke="#fed7aa"/><text x="1249" y="567" fontSize="7" fill="#c2410c" textAnchor="middle" fontFamily="'DM Mono',monospace">Megatron</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'alignment-rlhf')} style={cardStyle('alignment-rlhf', 'orange')}>
  <rect x="1092" y="578" width="254" height="50" rx="8" fill="#fff" stroke="#fdba74" strokeWidth="1"/>
  <rect x="1102" y="588" width="22" height="22" rx="5" fill="#fff7ed"/><use href="#ico-shield" x="1102" y="588" width="22" height="22" color="#FF4C24"/>
  <text x="1132" y="596" fontSize="9.5" fontWeight="700" fill="#9a3412" fontFamily="'DM Sans',sans-serif">Alignment & RLHF</text>
  <text x="1132" y="609" fontSize="8.5" fill="#334155" fontFamily="'DM Sans',sans-serif">Preference optimization</text>
  <rect x="1132" y="612" width="26" height="12" rx="3" fill="#fff7ed" stroke="#fed7aa"/><text x="1145" y="621" fontSize="7" fill="#c2410c" textAnchor="middle" fontFamily="'DM Mono',monospace">PPO</text>
  <rect x="1162" y="612" width="26" height="12" rx="3" fill="#fff7ed" stroke="#fed7aa"/><text x="1175" y="621" fontSize="7" fill="#c2410c" textAnchor="middle" fontFamily="'DM Mono',monospace">DPO</text>
  <rect x="1192" y="612" width="24" height="12" rx="3" fill="#fff7ed" stroke="#fed7aa"/><text x="1204" y="621" fontSize="7" fill="#c2410c" textAnchor="middle" fontFamily="'DM Mono',monospace">CAI</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'eval-redteam')} style={cardStyle('eval-redteam', 'orange')}>
  <rect x="1092" y="632" width="254" height="50" rx="8" fill="#fff" stroke="#fdba74" strokeWidth="1"/>
  <rect x="1102" y="642" width="22" height="22" rx="5" fill="#fff7ed"/><use href="#ico-search" x="1102" y="642" width="22" height="22" color="#FF4C24"/>
  <text x="1132" y="650" fontSize="9.5" fontWeight="700" fill="#9a3412" fontFamily="'DM Sans',sans-serif">Evaluation & Red-Teaming</text>
  <text x="1132" y="663" fontSize="8.5" fill="#334155" fontFamily="'DM Sans',sans-serif">Adversarial testing</text>
  <rect x="1132" y="666" width="32" height="12" rx="3" fill="#fff7ed" stroke="#fed7aa"/><text x="1148" y="675" fontSize="7" fill="#c2410c" textAnchor="middle" fontFamily="'DM Mono',monospace">Arena</text>
  <rect x="1168" y="666" width="50" height="12" rx="3" fill="#fff7ed" stroke="#fed7aa"/><text x="1193" y="675" fontSize="7" fill="#c2410c" textAnchor="middle" fontFamily="'DM Mono',monospace">MT-Bench</text>
  <rect x="1222" y="666" width="32" height="12" rx="3" fill="#fff7ed" stroke="#fed7aa"/><text x="1238" y="675" fontSize="7" fill="#c2410c" textAnchor="middle" fontFamily="'DM Mono',monospace">HELM</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'inference-optim')} style={cardStyle('inference-optim', 'orange')}>
  <rect x="1092" y="686" width="248" height="50" rx="8" fill="#fff" stroke="#fdba74" strokeWidth="1"/>
  <rect x="1102" y="696" width="22" height="22" rx="5" fill="#fff7ed"/><use href="#ico-speed" x="1102" y="696" width="22" height="22" color="#FF4C24"/>
  <text x="1132" y="704" fontSize="9.5" fontWeight="700" fill="#9a3412" fontFamily="'DM Sans',sans-serif">Inference Optimization</text>
  <text x="1132" y="717" fontSize="8.5" fill="#334155" fontFamily="'DM Sans',sans-serif">Efficiency improvements</text>
  <rect x="1132" y="720" width="30" height="12" rx="3" fill="#fff7ed" stroke="#fed7aa"/><text x="1147" y="729" fontSize="7" fill="#c2410c" textAnchor="middle" fontFamily="'DM Mono',monospace">GPTQ</text>
  <rect x="1166" y="720" width="28" height="12" rx="3" fill="#fff7ed" stroke="#fed7aa"/><text x="1180" y="729" fontSize="7" fill="#c2410c" textAnchor="middle" fontFamily="'DM Mono',monospace">AWQ</text>
  <rect x="1198" y="720" width="28" height="12" rx="3" fill="#fff7ed" stroke="#fed7aa"/><text x="1212" y="729" fontSize="7" fill="#c2410c" textAnchor="middle" fontFamily="'DM Mono',monospace">vLLM</text>
</g>



{/* ── LAYER 7: SOFTWARE FOUNDATION ── */}
{/* Row starts at y=748, height=96 */}
<rect x="22" y="770" width="1368" height="100" rx="8" fill="#f0fdf4" stroke="#bbf7d0" strokeWidth="1" vectorEffect="non-scaling-stroke"/>
<rect x="22" y="770" width="165" height="100" rx="0" fill="#fff" stroke="#e2e8f0" strokeWidth="1"/>
<g clipPath="url(#labelClip)">
  <text x="40" y="794" fontSize="12.5" fontWeight="800" fill="#047857" fontFamily="'DM Sans',sans-serif" className="layer-lbl" data-id="software" onClick={(e) => handleCardClick(e, 'software')} style={{cursor:'pointer'}}>SOFTWARE</text>
  <text x="40" y="810" fontSize="12.5" fontWeight="800" fill="#047857" fontFamily="'DM Sans',sans-serif">FOUNDATION</text>
  <text x="40" y="828" fontSize="9" fill="#334155" fontFamily="'DM Sans',sans-serif">Hardened software that</text>
  <text x="40" y="841" fontSize="9" fill="#334155" fontFamily="'DM Sans',sans-serif">powers AI compute</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'ml-frameworks')} style={cardStyle('ml-frameworks', 'green')}>
  <rect x="210" y="780" width="278" height="76" rx="8" fill="#fff" stroke="#bbf7d0" strokeWidth="1"/>
  <rect x="222" y="792" width="24" height="24" rx="5" fill="#f0fdf4"/><use href="#ico-layers" x="222" y="792" width="24" height="24" color="#047857"/>
  <text x="254" y="801" fontSize="10.5" fontWeight="700" fill="#0f172a" fontFamily="'DM Sans',sans-serif">ML Frameworks</text>
  <text x="254" y="816" fontSize="9" fill="#334155" fontFamily="'DM Sans',sans-serif">Core model development frameworks</text>
  <rect x="254" y="826" width="42" height="14" rx="4" fill="#dcfce7" stroke="#bbf7d0"/><text x="275" y="836" fontSize="7.5" fill="#15803d" textAnchor="middle" fontFamily="'DM Mono',monospace">PyTorch</text>
  <rect x="300" y="826" width="24" height="14" rx="4" fill="#dcfce7" stroke="#bbf7d0"/><text x="312" y="836" fontSize="7.5" fill="#15803d" textAnchor="middle" fontFamily="'DM Mono',monospace">JAX</text>
  <rect x="328" y="826" width="56" height="14" rx="4" fill="#dcfce7" stroke="#bbf7d0"/><text x="356" y="836" fontSize="7.5" fill="#15803d" textAnchor="middle" fontFamily="'DM Mono',monospace">TensorFlow</text>
  <rect x="388" y="826" width="28" height="14" rx="4" fill="#dcfce7" stroke="#bbf7d0"/><text x="402" y="836" fontSize="7.5" fill="#15803d" textAnchor="middle" fontFamily="'DM Mono',monospace">MLX</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'compute-libs')} style={cardStyle('compute-libs', 'green')}>
  <rect x="504" y="780" width="278" height="76" rx="8" fill="#fff" stroke="#bbf7d0" strokeWidth="1"/>
  <rect x="516" y="792" width="24" height="24" rx="5" fill="#f0fdf4"/><use href="#ico-cpu" x="516" y="792" width="24" height="24" color="#047857"/>
  <text x="548" y="801" fontSize="10.5" fontWeight="700" fill="#0f172a" fontFamily="'DM Sans',sans-serif">Compute Libraries</text>
  <text x="548" y="816" fontSize="9" fill="#334155" fontFamily="'DM Sans',sans-serif">High-performance compute primitives</text>
  <rect x="548" y="826" width="32" height="14" rx="4" fill="#dcfce7" stroke="#bbf7d0"/><text x="564" y="836" fontSize="7.5" fill="#15803d" textAnchor="middle" fontFamily="'DM Mono',monospace">CUDA</text>
  <rect x="584" y="826" width="34" height="14" rx="4" fill="#dcfce7" stroke="#bbf7d0"/><text x="601" y="836" fontSize="7.5" fill="#15803d" textAnchor="middle" fontFamily="'DM Mono',monospace">ROCm</text>
  <rect x="622" y="826" width="34" height="14" rx="4" fill="#dcfce7" stroke="#bbf7d0"/><text x="639" y="836" fontSize="7.5" fill="#15803d" textAnchor="middle" fontFamily="'DM Mono',monospace">cuDNN</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'distributed-libs')} style={cardStyle('distributed-libs', 'green')}>
  <rect x="798" y="780" width="278" height="76" rx="8" fill="#fff" stroke="#bbf7d0" strokeWidth="1"/>
  <rect x="810" y="792" width="24" height="24" rx="5" fill="#f0fdf4"/><use href="#ico-distribute" x="810" y="792" width="24" height="24" color="#047857"/>
  <text x="842" y="801" fontSize="10.5" fontWeight="700" fill="#0f172a" fontFamily="'DM Sans',sans-serif">Distributed Libraries</text>
  <text x="842" y="816" fontSize="9" fill="#334155" fontFamily="'DM Sans',sans-serif">Communication and collectives</text>
  <rect x="842" y="826" width="30" height="14" rx="4" fill="#dcfce7" stroke="#bbf7d0"/><text x="857" y="836" fontSize="7.5" fill="#15803d" textAnchor="middle" fontFamily="'DM Mono',monospace">NCCL</text>
  <rect x="876" y="826" width="24" height="14" rx="4" fill="#dcfce7" stroke="#bbf7d0"/><text x="888" y="836" fontSize="7.5" fill="#15803d" textAnchor="middle" fontFamily="'DM Mono',monospace">MPI</text>
  <rect x="904" y="826" width="26" height="14" rx="4" fill="#dcfce7" stroke="#bbf7d0"/><text x="917" y="836" fontSize="7.5" fill="#15803d" textAnchor="middle" fontFamily="'DM Mono',monospace">UCX</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'inference-libs')} style={cardStyle('inference-libs', 'green')}>
  <rect x="1092" y="780" width="278" height="76" rx="8" fill="#fff" stroke="#bbf7d0" strokeWidth="1"/>
  <rect x="1104" y="792" width="24" height="24" rx="5" fill="#f0fdf4"/><use href="#ico-speed" x="1104" y="792" width="24" height="24" color="#047857"/>
  <text x="1136" y="801" fontSize="10.5" fontWeight="700" fill="#0f172a" fontFamily="'DM Sans',sans-serif">Inference Libraries</text>
  <text x="1136" y="816" fontSize="9" fill="#334155" fontFamily="'DM Sans',sans-serif">Optimized inference backends</text>
  <rect x="1136" y="826" width="50" height="14" rx="4" fill="#dcfce7" stroke="#bbf7d0"/><text x="1161" y="836" fontSize="7.5" fill="#15803d" textAnchor="middle" fontFamily="'DM Mono',monospace">TensorRT</text>
  <rect x="1190" y="826" width="32" height="14" rx="4" fill="#dcfce7" stroke="#bbf7d0"/><text x="1206" y="836" fontSize="7.5" fill="#15803d" textAnchor="middle" fontFamily="'DM Mono',monospace">ONNX</text>
  <rect x="1226" y="826" width="28" height="14" rx="4" fill="#dcfce7" stroke="#bbf7d0"/><text x="1240" y="836" fontSize="7.5" fill="#15803d" textAnchor="middle" fontFamily="'DM Mono',monospace">TVM</text>
</g>

{/* ── LAYER 8: COMPUTE INFRASTRUCTURE ── */}
<rect x="22" y="870" width="1368" height="100" rx="8" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" vectorEffect="non-scaling-stroke"/>
<rect x="22" y="870" width="165" height="100" rx="0" fill="#fff" stroke="#e2e8f0" strokeWidth="1"/>
<g clipPath="url(#labelClip)">
  <text x="40" y="900" fontSize="12.5" fontWeight="800" fill="#475569" fontFamily="'DM Sans',sans-serif" className="layer-lbl" data-id="compute" onClick={(e) => handleCardClick(e, 'compute')} style={{cursor:'pointer'}}>COMPUTE</text>
  <text x="40" y="916" fontSize="12.5" fontWeight="800" fill="#475569" fontFamily="'DM Sans',sans-serif">INFRASTRUCTURE</text>
  <text x="40" y="934" fontSize="9" fill="#334155" fontFamily="'DM Sans',sans-serif">Cloud and on-prem</text>
  <text x="40" y="947" fontSize="9" fill="#334155" fontFamily="'DM Sans',sans-serif">compute</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'gpu-cloud')} style={cardStyle('gpu-cloud', 'gray')}>
  <rect x="210" y="884" width="278" height="72" rx="8" fill="#fff" stroke="#cbd5e1" strokeWidth="1"/>
  <rect x="222" y="898" width="24" height="24" rx="5" fill="#f1f5f9"/><use href="#ico-cloud" x="222" y="898" width="24" height="24" color="#475569"/>
  <text x="254" y="906" fontSize="10.5" fontWeight="700" fill="#0f172a" fontFamily="'DM Sans',sans-serif">GPU Cloud Infrastructure</text>
  <text x="254" y="921" fontSize="9" fill="#334155" fontFamily="'DM Sans',sans-serif">On-demand H100/H200 GPU clusters</text>
  <rect x="254" y="931" width="26" height="14" rx="4" fill="#f1f5f9" stroke="#cbd5e1"/><text x="267" y="941" fontSize="7.5" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">AWS</text>
  <rect x="284" y="931" width="26" height="14" rx="4" fill="#f1f5f9" stroke="#cbd5e1"/><text x="297" y="941" fontSize="7.5" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">GCP</text>
  <rect x="314" y="931" width="52" height="14" rx="4" fill="#f1f5f9" stroke="#cbd5e1"/><text x="340" y="941" fontSize="7.5" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">CoreWeave</text>
  <rect x="370" y="931" width="40" height="14" rx="4" fill="#f1f5f9" stroke="#cbd5e1"/><text x="390" y="941" fontSize="7.5" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">Lambda</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'dist-train-infra')} style={cardStyle('dist-train-infra', 'gray')}>
  <rect x="504" y="884" width="278" height="72" rx="8" fill="#fff" stroke="#cbd5e1" strokeWidth="1"/>
  <rect x="516" y="898" width="24" height="24" rx="5" fill="#f1f5f9"/><use href="#ico-server" x="516" y="898" width="24" height="24" color="#475569"/>
  <text x="548" y="906" fontSize="10.5" fontWeight="700" fill="#0f172a" fontFamily="'DM Sans',sans-serif">Distributed Training Infra</text>
  <text x="548" y="921" fontSize="9" fill="#334155" fontFamily="'DM Sans',sans-serif">Job scheduling and orchestration</text>
  <rect x="548" y="931" width="24" height="14" rx="4" fill="#f1f5f9" stroke="#cbd5e1"/><text x="560" y="941" fontSize="7.5" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">Ray</text>
  <rect x="576" y="931" width="56" height="14" rx="4" fill="#f1f5f9" stroke="#cbd5e1"/><text x="604" y="941" fontSize="7.5" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">Kubernetes</text>
  <rect x="636" y="931" width="34" height="14" rx="4" fill="#f1f5f9" stroke="#cbd5e1"/><text x="653" y="941" fontSize="7.5" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">Slurm</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'storage-systems')} style={cardStyle('storage-systems', 'gray')}>
  <rect x="798" y="884" width="278" height="72" rx="8" fill="#fff" stroke="#cbd5e1" strokeWidth="1"/>
  <rect x="810" y="898" width="24" height="24" rx="5" fill="#f1f5f9"/><use href="#ico-db" x="810" y="898" width="24" height="24" color="#475569"/>
  <text x="842" y="906" fontSize="10.5" fontWeight="700" fill="#0f172a" fontFamily="'DM Sans',sans-serif">Storage Systems</text>
  <text x="842" y="921" fontSize="9" fill="#334155" fontFamily="'DM Sans',sans-serif">High-throughput dataset storage</text>
  <rect x="842" y="931" width="20" height="14" rx="4" fill="#f1f5f9" stroke="#cbd5e1"/><text x="852" y="941" fontSize="7.5" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">S3</text>
  <rect x="866" y="931" width="26" height="14" rx="4" fill="#f1f5f9" stroke="#cbd5e1"/><text x="879" y="941" fontSize="7.5" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">GCS</text>
  <rect x="896" y="931" width="30" height="14" rx="4" fill="#f1f5f9" stroke="#cbd5e1"/><text x="911" y="941" fontSize="7.5" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">Ceph</text>
  <rect x="930" y="931" width="34" height="14" rx="4" fill="#f1f5f9" stroke="#cbd5e1"/><text x="947" y="941" fontSize="7.5" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">Lustre</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'networking')} style={cardStyle('networking', 'gray')}>
  <rect x="1092" y="884" width="278" height="72" rx="8" fill="#fff" stroke="#cbd5e1" strokeWidth="1"/>
  <rect x="1104" y="898" width="24" height="24" rx="5" fill="#f1f5f9"/><use href="#ico-network" x="1104" y="898" width="24" height="24" color="#475569"/>
  <text x="1136" y="906" fontSize="10.5" fontWeight="700" fill="#0f172a" fontFamily="'DM Sans',sans-serif">Networking</text>
  <text x="1136" y="921" fontSize="9" fill="#334155" fontFamily="'DM Sans',sans-serif">Low-latency GPU interconnects</text>
  <rect x="1136" y="931" width="52" height="14" rx="4" fill="#f1f5f9" stroke="#cbd5e1"/><text x="1162" y="941" fontSize="7.5" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">InfiniBand</text>
  <rect x="1192" y="931" width="38" height="14" rx="4" fill="#f1f5f9" stroke="#cbd5e1"/><text x="1211" y="941" fontSize="7.5" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">NVLink</text>
  <rect x="1234" y="931" width="44" height="14" rx="4" fill="#f1f5f9" stroke="#cbd5e1"/><text x="1256" y="941" fontSize="7.5" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">Ethernet</text>
</g>

{/* ── LAYER 9: PHYSICAL FOUNDATION ── */}
<rect x="22" y="970" width="1368" height="100" rx="8" fill="#fff" stroke="#cbd5e1" strokeWidth="1" vectorEffect="non-scaling-stroke"/>
<rect x="22" y="970" width="165" height="100" rx="0" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1"/>
<g clipPath="url(#labelClip)">
  <text x="40" y="1000" fontSize="12.5" fontWeight="800" fill="#334155" fontFamily="'DM Sans',sans-serif" className="layer-lbl" data-id="physical" onClick={(e) => handleCardClick(e, 'physical')} style={{cursor:'pointer'}}>PHYSICAL</text>
  <text x="40" y="1016" fontSize="12.5" fontWeight="800" fill="#334155" fontFamily="'DM Sans',sans-serif">FOUNDATION</text>
  <text x="40" y="1034" fontSize="9" fill="#334155" fontFamily="'DM Sans',sans-serif">Silicon, memory, and</text>
  <text x="40" y="1047" fontSize="9" fill="#334155" fontFamily="'DM Sans',sans-serif">power systems</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'gpus-accel')} style={cardStyle('gpus-accel', 'gray')}>
  <rect x="210" y="984" width="278" height="72" rx="8" fill="#fff" stroke="#e2e8f0" strokeWidth="1"/>
  <rect x="222" y="998" width="24" height="24" rx="5" fill="#f8fafc"/><use href="#ico-cpu" x="222" y="998" width="24" height="24" color="#475569"/>
  <text x="254" y="1006" fontSize="10.5" fontWeight="700" fill="#0f172a" fontFamily="'DM Sans',sans-serif">GPUs & Accelerators</text>
  <text x="254" y="1021" fontSize="9" fill="#334155" fontFamily="'DM Sans',sans-serif">Primary AI compute substrate</text>
  <rect x="254" y="1031" width="30" height="14" rx="4" fill="#f1f5f9" stroke="#e2e8f0"/><text x="269" y="1041" fontSize="7.5" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">H100</text>
  <rect x="288" y="1031" width="36" height="14" rx="4" fill="#f1f5f9" stroke="#e2e8f0"/><text x="306" y="1041" fontSize="7.5" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">TPU v5</text>
  <rect x="328" y="1031" width="40" height="14" rx="4" fill="#f1f5f9" stroke="#e2e8f0"/><text x="348" y="1041" fontSize="7.5" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">MI300X</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'memory-hw')} style={cardStyle('memory-hw', 'gray')}>
  <rect x="504" y="984" width="278" height="72" rx="8" fill="#fff" stroke="#e2e8f0" strokeWidth="1"/>
  <rect x="516" y="998" width="24" height="24" rx="5" fill="#f8fafc"/><use href="#ico-memory" x="516" y="998" width="24" height="24" color="#475569"/>
  <text x="548" y="1006" fontSize="10.5" fontWeight="700" fill="#0f172a" fontFamily="'DM Sans',sans-serif">Memory Systems</text>
  <text x="548" y="1021" fontSize="9" fill="#334155" fontFamily="'DM Sans',sans-serif">Bandwidth is the LLM bottleneck</text>
  <rect x="548" y="1031" width="36" height="14" rx="4" fill="#f1f5f9" stroke="#e2e8f0"/><text x="566" y="1041" fontSize="7.5" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">HBM3e</text>
  <rect x="588" y="1031" width="30" height="14" rx="4" fill="#f1f5f9" stroke="#e2e8f0"/><text x="603" y="1041" fontSize="7.5" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">DDR5</text>
  <rect x="622" y="1031" width="36" height="14" rx="4" fill="#f1f5f9" stroke="#e2e8f0"/><text x="640" y="1041" fontSize="7.5" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">GDDR7</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'storage-hw')} style={cardStyle('storage-hw', 'gray')}>
  <rect x="798" y="984" width="278" height="72" rx="8" fill="#fff" stroke="#e2e8f0" strokeWidth="1"/>
  <rect x="810" y="998" width="24" height="24" rx="5" fill="#f8fafc"/><use href="#ico-drive" x="810" y="998" width="24" height="24" color="#475569"/>
  <text x="842" y="1006" fontSize="10.5" fontWeight="700" fill="#0f172a" fontFamily="'DM Sans',sans-serif">Storage Hardware</text>
  <text x="842" y="1021" fontSize="9" fill="#334155" fontFamily="'DM Sans',sans-serif">Fast checkpoints and datasets</text>
  <rect x="842" y="1031" width="32" height="14" rx="4" fill="#f1f5f9" stroke="#e2e8f0"/><text x="858" y="1041" fontSize="7.5" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">NVMe</text>
  <rect x="878" y="1031" width="56" height="14" rx="4" fill="#f1f5f9" stroke="#e2e8f0"/><text x="906" y="1041" fontSize="7.5" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">Object Store</text>
  <rect x="938" y="1031" width="28" height="14" rx="4" fill="#f1f5f9" stroke="#e2e8f0"/><text x="952" y="1041" fontSize="7.5" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">Tape</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'power-cooling')} style={cardStyle('power-cooling', 'gray')}>
  <rect x="1092" y="984" width="278" height="72" rx="8" fill="#fff" stroke="#e2e8f0" strokeWidth="1"/>
  <rect x="1104" y="998" width="24" height="24" rx="5" fill="#f8fafc"/><use href="#ico-power" x="1104" y="998" width="24" height="24" color="#475569"/>
  <text x="1136" y="1006" fontSize="10.5" fontWeight="700" fill="#0f172a" fontFamily="'DM Sans',sans-serif">Power & Cooling</text>
  <text x="1136" y="1021" fontSize="9" fill="#334155" fontFamily="'DM Sans',sans-serif">Liquid cooling now mandatory</text>
  <rect x="1136" y="1031" width="34" height="14" rx="4" fill="#f1f5f9" stroke="#e2e8f0"/><text x="1153" y="1041" fontSize="7.5" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">Liquid</text>
  <rect x="1174" y="1031" width="20" height="14" rx="4" fill="#f1f5f9" stroke="#e2e8f0"/><text x="1184" y="1041" fontSize="7.5" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">Air</text>
  <rect x="1198" y="1031" width="26" height="14" rx="4" fill="#f1f5f9" stroke="#e2e8f0"/><text x="1211" y="1041" fontSize="7.5" fill="#475569" textAnchor="middle" fontFamily="'DM Mono',monospace">UPS</text>
</g>

{/* ── GOVERNANCE COLUMN ── */}
<rect x="1404" y="90" width="184" height="980" rx="12" fill="#fff" stroke="#d7dee8" strokeWidth="1" vectorEffect="non-scaling-stroke"/>
<text x="1424" y="122" fontSize="13" fontWeight="800" fill="#0f172a" fontFamily="'DM Sans',sans-serif">GOVERNANCE</text>
<text x="1424" y="139" fontSize="13" fontWeight="800" fill="#0f172a" fontFamily="'DM Sans',sans-serif">& OVERSIGHT</text>
<line x1="1414" y1="152" x2="1576" y2="152" stroke="#f1f5f9" strokeWidth="1"/>

{/* TECHNICAL section */}
<text x="1424" y="170" fontSize="9.5" fontWeight="700" fill="#4338ca" fontFamily="'DM Sans',sans-serif" letterSpacing="0.05em">TECHNICAL</text>
<line x1="1414" y1="176" x2="1576" y2="176" stroke="#c7d2fe" strokeWidth="1"/>

{/* 4 blue cards: 90px tall, 16px gap → y=182, 288, 394, 500 */}
<g className="card" onClick={(e) => handleCardClick(e, 'safety')} style={cardStyle('safety', 'blue')}>
  <rect x="1414" y="182" width="162" height="90" rx="8" fill="#eef2ff" stroke="#c7d2fe" strokeWidth="1"/>
  <rect x="1424" y="196" width="20" height="20" rx="4" fill="#e0e7ff"/><use href="#ico-shield-check" x="1424" y="196" width="20" height="20" color="#4338ca"/>
  <text x="1452" y="210" fontSize="10" fontWeight="700" fill="#3730a3" fontFamily="'DM Sans',sans-serif">Safety & Alignment</text>
  <text x="1424" y="230" fontSize="8.5" fill="#334155" fontFamily="'DM Sans',sans-serif">Prevent harm and misuse</text>
  <rect x="1424" y="242" width="44" height="12" rx="3" fill="#e0e7ff" stroke="#c7d2fe"/><text x="1446" y="251" fontSize="7" fill="#4338ca" textAnchor="middle" fontFamily="'DM Mono',monospace">Red-team</text>
  <rect x="1472" y="242" width="30" height="12" rx="3" fill="#e0e7ff" stroke="#c7d2fe"/><text x="1487" y="251" fontSize="7" fill="#4338ca" textAnchor="middle" fontFamily="'DM Mono',monospace">RLHF</text>
  <rect x="1506" y="242" width="28" height="12" rx="3" fill="#e0e7ff" stroke="#c7d2fe"/><text x="1520" y="251" fontSize="7" fill="#4338ca" textAnchor="middle" fontFamily="'DM Mono',monospace">Evals</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'privacy')} style={cardStyle('privacy', 'blue')}>
  <rect x="1414" y="288" width="162" height="90" rx="8" fill="#eef2ff" stroke="#c7d2fe" strokeWidth="1"/>
  <rect x="1424" y="302" width="20" height="20" rx="4" fill="#e0e7ff"/><use href="#ico-lock" x="1424" y="302" width="20" height="20" color="#4338ca"/>
  <text x="1452" y="316" fontSize="10" fontWeight="700" fill="#3730a3" fontFamily="'DM Sans',sans-serif">Privacy & Data Rights</text>
  <text x="1424" y="336" fontSize="8.5" fill="#334155" fontFamily="'DM Sans',sans-serif">Protect user data</text>
  <rect x="1424" y="348" width="30" height="12" rx="3" fill="#e0e7ff" stroke="#c7d2fe"/><text x="1439" y="357" fontSize="7" fill="#4338ca" textAnchor="middle" fontFamily="'DM Mono',monospace">GDPR</text>
  <rect x="1458" y="348" width="50" height="12" rx="3" fill="#e0e7ff" stroke="#c7d2fe"/><text x="1483" y="357" fontSize="7" fill="#4338ca" textAnchor="middle" fontFamily="'DM Mono',monospace">Federated</text>
  <rect x="1512" y="348" width="40" height="12" rx="3" fill="#e0e7ff" stroke="#c7d2fe"/><text x="1532" y="357" fontSize="7" fill="#4338ca" textAnchor="middle" fontFamily="'DM Mono',monospace">Erasure</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'security')} style={cardStyle('security', 'blue')}>
  <rect x="1414" y="394" width="162" height="90" rx="8" fill="#eef2ff" stroke="#c7d2fe" strokeWidth="1"/>
  <rect x="1424" y="408" width="20" height="20" rx="4" fill="#e0e7ff"/><use href="#ico-shield" x="1424" y="408" width="20" height="20" color="#4338ca"/>
  <text x="1452" y="422" fontSize="10" fontWeight="700" fill="#3730a3" fontFamily="'DM Sans',sans-serif">Security</text>
  <text x="1424" y="442" fontSize="8.5" fill="#334155" fontFamily="'DM Sans',sans-serif">Secure systems & supply chains</text>
  <rect x="1424" y="454" width="44" height="12" rx="3" fill="#e0e7ff" stroke="#c7d2fe"/><text x="1446" y="463" fontSize="7" fill="#4338ca" textAnchor="middle" fontFamily="'DM Mono',monospace">Injection</text>
  <rect x="1472" y="454" width="52" height="12" rx="3" fill="#e0e7ff" stroke="#c7d2fe"/><text x="1498" y="463" fontSize="7" fill="#4338ca" textAnchor="middle" fontFamily="'DM Mono',monospace">Watermark</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'evalmon')} style={cardStyle('evalmon', 'blue')}>
  <rect x="1414" y="500" width="162" height="90" rx="8" fill="#eef2ff" stroke="#c7d2fe" strokeWidth="1"/>
  <rect x="1424" y="514" width="20" height="20" rx="4" fill="#e0e7ff"/><use href="#ico-trending" x="1424" y="514" width="20" height="20" color="#4338ca"/>
  <text x="1452" y="528" fontSize="10" fontWeight="700" fill="#3730a3" fontFamily="'DM Sans',sans-serif">Eval & Monitoring</text>
  <text x="1424" y="548" fontSize="8.5" fill="#334155" fontFamily="'DM Sans',sans-serif">Observe, measure, detect</text>
  <rect x="1424" y="560" width="50" height="12" rx="3" fill="#e0e7ff" stroke="#c7d2fe"/><text x="1449" y="569" fontSize="7" fill="#4338ca" textAnchor="middle" fontFamily="'DM Mono',monospace">LLM-judge</text>
  <rect x="1478" y="560" width="26" height="12" rx="3" fill="#e0e7ff" stroke="#c7d2fe"/><text x="1491" y="569" fontSize="7" fill="#4338ca" textAnchor="middle" fontFamily="'DM Mono',monospace">Drift</text>
  <rect x="1508" y="560" width="30" height="12" rx="3" fill="#e0e7ff" stroke="#c7d2fe"/><text x="1523" y="569" fontSize="7" fill="#4338ca" textAnchor="middle" fontFamily="'DM Mono',monospace">Alerts</text>
</g>

{/* SOCIETAL section — 28px gap from last Technical card (590) */}
<text x="1424" y="618" fontSize="9.5" fontWeight="700" fill="#B45309" fontFamily="'DM Sans',sans-serif" letterSpacing="0.05em">SOCIETAL IMPACT</text>
<line x1="1414" y1="624" x2="1576" y2="624" stroke="#FDE68A" strokeWidth="1"/>

{/* 4 orange cards: 86px tall, 14px gap → y=632, 732, 832, 932. Last ends 1018. */}
<g className="card" onClick={(e) => handleCardClick(e, 'labor')} style={cardStyle('labor', 'orange')}>
  <rect x="1414" y="632" width="162" height="86" rx="8" fill="#FFFBEB" stroke="#FDE68A" strokeWidth="1"/>
  <rect x="1424" y="646" width="20" height="20" rx="4" fill="#FEF3C7"/><use href="#ico-users" x="1424" y="646" width="20" height="20" color="#B45309"/>
  <text x="1452" y="660" fontSize="10" fontWeight="700" fill="#92400E" fontFamily="'DM Sans',sans-serif">Labor & Human Impact</text>
  <text x="1424" y="678" fontSize="8.5" fill="#334155" fontFamily="'DM Sans',sans-serif">Working conditions, rights</text>
  <rect x="1424" y="688" width="64" height="12" rx="3" fill="#FEF3C7" stroke="#FDE68A"/><text x="1456" y="697" fontSize="7" fill="#B45309" textAnchor="middle" fontFamily="'DM Mono',monospace">Displacement</text>
  <rect x="1492" y="688" width="56" height="12" rx="3" fill="#FEF3C7" stroke="#FDE68A"/><text x="1520" y="697" fontSize="7" fill="#B45309" textAnchor="middle" fontFamily="'DM Mono',monospace">Annotators</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'env')} style={cardStyle('env', 'orange')}>
  <rect x="1414" y="732" width="162" height="86" rx="8" fill="#FFFBEB" stroke="#FDE68A" strokeWidth="1"/>
  <rect x="1424" y="746" width="20" height="20" rx="4" fill="#FEF3C7"/><use href="#ico-leaf" x="1424" y="746" width="20" height="20" color="#B45309"/>
  <text x="1452" y="760" fontSize="10" fontWeight="700" fill="#92400E" fontFamily="'DM Sans',sans-serif">Environmental Impact</text>
  <text x="1424" y="778" fontSize="8.5" fill="#334155" fontFamily="'DM Sans',sans-serif">Energy use and footprint</text>
  <rect x="1424" y="788" width="40" height="12" rx="3" fill="#FEF3C7" stroke="#FDE68A"/><text x="1444" y="797" fontSize="7" fill="#B45309" textAnchor="middle" fontFamily="'DM Mono',monospace">Carbon</text>
  <rect x="1468" y="788" width="58" height="12" rx="3" fill="#FEF3C7" stroke="#FDE68A"/><text x="1497" y="797" fontSize="7" fill="#B45309" textAnchor="middle" fontFamily="'DM Mono',monospace">Renewables</text>
  <rect x="1530" y="788" width="26" height="12" rx="3" fill="#FEF3C7" stroke="#FDE68A"/><text x="1543" y="797" fontSize="7" fill="#B45309" textAnchor="middle" fontFamily="'DM Mono',monospace">PUE</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'geo')} style={cardStyle('geo', 'orange')}>
  <rect x="1414" y="832" width="162" height="86" rx="8" fill="#FFFBEB" stroke="#FDE68A" strokeWidth="1"/>
  <rect x="1424" y="846" width="20" height="20" rx="4" fill="#FEF3C7"/><use href="#ico-globe" x="1424" y="846" width="20" height="20" color="#B45309"/>
  <text x="1452" y="860" fontSize="10" fontWeight="700" fill="#92400E" fontFamily="'DM Sans',sans-serif">Geopolitics & Security</text>
  <text x="1424" y="878" fontSize="8.5" fill="#334155" fontFamily="'DM Sans',sans-serif">National security and policy</text>
  <rect x="1424" y="888" width="56" height="12" rx="3" fill="#FEF3C7" stroke="#FDE68A"/><text x="1452" y="897" fontSize="7" fill="#B45309" textAnchor="middle" fontFamily="'DM Mono',monospace">Export ctrl</text>
  <rect x="1484" y="888" width="58" height="12" rx="3" fill="#FEF3C7" stroke="#FDE68A"/><text x="1513" y="897" fontSize="7" fill="#B45309" textAnchor="middle" fontFamily="'DM Mono',monospace">Sovereignty</text>
</g>

<g className="card" onClick={(e) => handleCardClick(e, 'transp')} style={cardStyle('transp', 'orange')}>
  <rect x="1414" y="932" width="162" height="86" rx="8" fill="#FFFBEB" stroke="#FDE68A" strokeWidth="1"/>
  <rect x="1424" y="946" width="20" height="20" rx="4" fill="#FEF3C7"/><use href="#ico-scale" x="1424" y="946" width="20" height="20" color="#B45309"/>
  <text x="1452" y="960" fontSize="10" fontWeight="700" fill="#92400E" fontFamily="'DM Sans',sans-serif">Transparency</text>
  <text x="1424" y="978" fontSize="8.5" fill="#334155" fontFamily="'DM Sans',sans-serif">Auditability and accountability</text>
  <rect x="1424" y="988" width="58" height="12" rx="3" fill="#FEF3C7" stroke="#FDE68A"/><text x="1453" y="997" fontSize="7" fill="#B45309" textAnchor="middle" fontFamily="'DM Mono',monospace">Model cards</text>
  <rect x="1486" y="988" width="30" height="12" rx="3" fill="#FEF3C7" stroke="#FDE68A"/><text x="1501" y="997" fontSize="7" fill="#B45309" textAnchor="middle" fontFamily="'DM Mono',monospace">Audit</text>
</g>




        </svg>
        </div>
      </div>

      {tipData && (
        <div className="stack-tooltip" ref={tipRef} onClick={(e) => e.stopPropagation()}>
          <div className="stack-tip-bar" style={{ background: barGrad }} />
          <div className="stack-tip-body">
            <div className="stack-tip-lbl" style={{ color: accentColor }}>{tipData.lbl}</div>
            <div className="stack-tip-title">{tipData.title}</div>
            <div className="stack-tip-desc">{tipData.desc}</div>
            {tipData.tools.length > 0 && (
              <div className="stack-tip-chips">
                {tipData.tools.map(t => <span key={t} className={`stack-tip-chip ${chipCls}`}>{t}</span>)}
              </div>
            )}
            <div className="stack-tip-feats">
              {tipData.feats.map((f, i) => (
                <div key={i} className="stack-tip-feat">
                  <div className="stack-tip-dot" style={{ background: accentColor }} />
                  <span>{f}</span>
                </div>
              ))}
            </div>
            {tipData.trend && (
              <div className="stack-tip-trend" style={{ background: trendBg, border: `1px solid ${trendBorder}` }}>
                <div className="stack-tip-trend-lbl" style={{ color: accentColor }}>Current Trend</div>
                <div>{tipData.trend}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
