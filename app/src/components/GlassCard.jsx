export function GlassCard({ children, style, active, activeColor, onClick, ...props }) {
  const base = {
    background: active ? `${activeColor || 'rgba(255,255,255,.07)'}18` : 'rgba(255,255,255,.04)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: `1px solid ${active ? (activeColor || 'rgba(255,255,255,.3)') + '66' : 'rgba(255,255,255,.10)'}`,
    borderRadius: 10,
    transition: 'all 200ms ease',
    cursor: onClick ? 'pointer' : 'default',
    ...style,
  };

  return (
    <div
      style={base}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'rgba(255,255,255,.07)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,.18)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = base.background;
          e.currentTarget.style.borderColor = base.border.match(/1px solid (.+)/)?.[1] || '';
        }
      }}
      {...props}
    >
      {children}
    </div>
  );
}
