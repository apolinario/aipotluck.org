import { useState, useEffect, useRef } from 'react';

export function SearchBar({ value, onChange }) {
  const [local, setLocal] = useState(value);
  const timerRef = useRef(null);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const handleChange = (e) => {
    const v = e.target.value;
    setLocal(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(v), 150);
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: 'rgba(255,255,255,.05)',
      border: '1px solid rgba(255,255,255,.10)',
      borderRadius: 8,
      padding: '6px 12px',
      minWidth: 240,
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="2" strokeLinecap="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        value={local}
        onChange={handleChange}
        placeholder="Search repos, packages, models..."
        style={{
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: '#fff',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13,
          flex: 1,
        }}
      />
      {local && (
        <button
          onClick={() => { setLocal(''); onChange(''); }}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,.35)',
            cursor: 'pointer',
            fontSize: 14,
            lineHeight: 1,
            padding: 0,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
