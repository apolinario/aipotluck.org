export function Chevron({ dir, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={dir === 'up' ? 'chevron-up' : 'chevron-down'}
      aria-label={dir === 'up' ? 'Scroll up' : 'Scroll down'}
      style={{
        position: 'fixed',
        left: '50%',
        ...(dir === 'up' ? { top: 20 } : { bottom: 20 }),
        zIndex: 200,
        background: 'rgba(255,255,255,.06)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,.13)',
        borderRadius: '50%',
        width: 42,
        height: 42,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: 'rgba(255,255,255,.65)',
        fontSize: 16,
        lineHeight: 1,
        transition: 'background 200ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,.14)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,.06)';
      }}
    >
      {dir === 'up' ? '∧' : '∨'}
    </button>
  );
}
