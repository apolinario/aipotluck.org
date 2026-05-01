export function MissionSection() {
  return (
    <div style={{ width: '100vw', background: '#F5F2EE', display: 'flex', flexDirection: 'column' }} data-screen-label="05 Mission">
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '72px 64px 120px', flex: 1, width: '100%' }}>
        <div style={{ marginBottom: 64 }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: '#E8796A', marginBottom: 20 }}>
            Mission
          </div>
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 'clamp(2.4rem,4.5vw,4rem)',
              fontWeight: 300,
              color: '#0B1E2D',
              letterSpacing: '-.02em',
              lineHeight: 1.1,
              margin: '0 0 24px',
              maxWidth: 780,
            }}
          >
            AI infrastructure built for the public good.
          </h2>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, lineHeight: 1.7, color: '#687A84', maxWidth: 620, margin: 0 }}>
            Placeholder for new content or existing content from the website.
          </p>
        </div>
        <div style={{ borderTop: '1px solid rgba(0,0,0,.08)', paddingTop: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', fontWeight: 300, color: '#0B1E2D', letterSpacing: '.02em' }}>Current AI</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: '#B0BCBE', letterSpacing: '.08em' }}>A nonprofit organization · currentai.org · © 2026</div>
          <div style={{ display: 'flex', gap: 20 }}>
            {['GitHub', 'Writing', 'Privacy'].map((l) => (
              <a key={l} href="#" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: '#687A84', textDecoration: 'none' }}>
                {l}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
