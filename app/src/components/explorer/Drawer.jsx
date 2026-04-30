import { useEffect } from 'react';

export function Drawer({ open, onClose, crumb, title, titleStyle, children }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <>
      <div
        className={`drawer-scrim${open ? ' open' : ''}`}
        onClick={onClose}
      />
      <aside
        className={`drawer${open ? ' open' : ''}`}
        aria-hidden={!open}
      >
        <div className="drawer-head">
          <div>
            <div className="crumb">{crumb}</div>
            <h2 style={titleStyle}>{title}</h2>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Close">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="drawer-body">
          {children}
        </div>
      </aside>
    </>
  );
}
