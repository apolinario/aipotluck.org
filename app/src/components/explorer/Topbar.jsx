import { Link } from 'react-router-dom';
import { SEARCH_PLACEHOLDERS } from '../../explorer/constants.js';
import logoBlack from '../../assets/currentai-logo-black-transparent.png';

const SearchIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    style={{ color: 'var(--ink-3)', flexShrink: 0 }}>
    <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
  </svg>
);

export function Topbar({ view, setView, searchValue, onSearchChange, statsText }) {
  return (
    <div className="topbar">
      <div className="topbar-inner">
        <Link to="/" className="brand" aria-label="Current AI home">
          <img
            src={logoBlack}
            alt="Current AI"
            style={{ height: 28, width: 'auto', display: 'block' }}
          />
        </Link>

        <div className="nav-tabs" style={{ marginLeft: 24 }}>
          {['stacks', 'repos'].map(v => (
            <button
              key={v}
              className={`nav-tab${view === v ? ' active' : ''}`}
              onClick={() => setView(v)}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        <select
          className="mobile-nav-select"
          value={view === 'teams' ? 'stacks' : view}
          onChange={e => setView(e.target.value)}
        >
          <option value="stacks">Stacks</option>
          <option value="repos">Repos</option>
        </select>

        <div className="topbar-divider" />
        <span className="view-stats">{statsText}</span>

        <div className="topbar-search" style={{ marginLeft: 'auto' }}>
          <SearchIcon />
          <input
            placeholder={SEARCH_PLACEHOLDERS[view] || 'Search…'}
            autoComplete="off"
            value={searchValue}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>

        <button className="pill primary">Contribute →</button>
      </div>
    </div>
  );
}
