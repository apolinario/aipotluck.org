import { pillars, activeWork, partners } from '../data/missionContent.js';

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
            We make the tools, research, and policy foundations that let communities, governments, and civil society shape their own AI futures — not just the institutions that can afford to.
          </p>
        </div>
        <div style={{ marginBottom: 72 }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: '#687A84', marginBottom: 24 }}>What we stand for</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 20 }}>
            {pillars.map((pl, i) => (
              <div key={i} style={{ padding: '26px 30px', background: '#fff', borderRadius: 10, border: '1px solid rgba(0,0,0,.06)', borderTop: '3px solid #E8796A', boxShadow: '0 2px 12px rgba(0,0,0,.04)' }}>
                <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: '#0B1E2D', margin: '0 0 10px', letterSpacing: '-.01em' }}>{pl.title}</h3>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, lineHeight: 1.7, color: '#687A84', margin: 0 }}>{pl.body}</p>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 72 }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: '#687A84', marginBottom: 8 }}>Active work</div>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, lineHeight: 1.7, color: '#8E9BA2', margin: '0 0 28px', maxWidth: 540 }}>
            We build in public. Everything we produce is open — code, data, drafts and process.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(0,0,0,.07)' }}>
            {activeWork.map((w, i) => (
              <div
                key={i}
                style={{
                  background: '#fff',
                  padding: '24px 30px',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: '16px 40px',
                  alignItems: 'start',
                  borderBottom: i < activeWork.length - 1 ? '1px solid rgba(0,0,0,.05)' : 'none',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: '.12em', textTransform: 'uppercase', color: '#8E9BA2', background: '#F0EDE8', padding: '2px 7px', borderRadius: 3 }}>{w.tag}</span>
                    <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: '#0B1E2D', margin: 0 }}>{w.title}</h3>
                  </div>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, lineHeight: 1.65, color: '#687A84', margin: 0 }}>{w.body}</p>
                </div>
                <div style={{ paddingTop: 4, textAlign: 'right' }}>
                  <div
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 8,
                      letterSpacing: '.12em',
                      textTransform: 'uppercase',
                      color: w.sc,
                      border: `1px solid ${w.sc}55`,
                      padding: '2px 8px',
                      borderRadius: 3,
                      display: 'inline-block',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {w.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 72 }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: '#687A84', marginBottom: 24 }}>Partners & collaborators</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {partners.map((name, i) => (
              <div key={i} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: '#4A5D66', background: '#fff', border: '1px solid rgba(0,0,0,.08)', borderRadius: 6, padding: '8px 16px' }}>
                {name}
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 72, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: '#0B1E2D', borderRadius: 10, padding: '32px 36px' }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: '#3DAAB8', marginBottom: 14 }}>Stay current</div>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', fontWeight: 300, color: '#fff', margin: '0 0 10px' }}>The field moves fast.</h3>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, lineHeight: 1.65, color: 'rgba(255,255,255,.48)', margin: '0 0 22px' }}>
              Our monthly digest covers open-source AI developments, policy changes, and what we&apos;re working on.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="email"
                placeholder="your@email.org"
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,.07)',
                  border: '1px solid rgba(255,255,255,.12)',
                  borderRadius: 6,
                  color: '#fff',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  padding: '9px 14px',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                style={{
                  background: '#E8796A',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  fontWeight: 500,
                  padding: '9px 18px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Subscribe
              </button>
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: 10, padding: '32px 36px', border: '1px solid rgba(0,0,0,.06)' }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: '#E8796A', marginBottom: 14 }}>Get involved</div>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', fontWeight: 300, color: '#0B1E2D', margin: '0 0 10px' }}>Join us in building it.</h3>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, lineHeight: 1.65, color: '#687A84', margin: '0 0 22px' }}>
              We&apos;re a nonprofit. We collaborate openly, welcome contributors, and work with organizations that share our values.
            </p>
            <button
              type="button"
              style={{
                background: '#0B1E2D',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13,
                fontWeight: 500,
                padding: '10px 22px',
                cursor: 'pointer',
              }}
            >
              Get in touch →
            </button>
          </div>
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
