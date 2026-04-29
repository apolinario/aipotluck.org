export function SectionDots({ section, setSection }) {
  return (
    <div style={{ position: 'fixed', right: 18, top: '50%', transform: 'translateY(-50%)', zIndex: 200, display: 'flex', flexDirection: 'column', gap: 9 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => setSection(i)}
          aria-label={`Go to section ${i + 1}`}
          style={{
            width: i === section ? 8 : 5,
            height: i === section ? 8 : 5,
            borderRadius: '50%',
            background: i === section ? '#E8796A' : 'rgba(255,255,255,.28)',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            transition: 'all 250ms ease',
            boxShadow: i === section ? '0 0 10px rgba(232,121,106,.55)' : 'none',
          }}
        />
      ))}
    </div>
  );
}
