import storyDawn from '../assets/story-dawn.png';
import storyDusk from '../assets/story-dusk.png';

const STORY_LINES_DUSK = [
  'And, in the spiced Indian air, by night,',
  "Full often hath she gossip'd by my side,",
  "And sat with me on Neptune's yellow sands,",
  'Marking the embarked traders on the flood',
  "When we have laugh'd to see the sails conceive",
  'And grow big-bellied with the wanton wind',
];

const STORY_BODY_DAWN =
  '"Duration is the continuous progress of the past which gnaws into the future and which swells as it advances. And as the past grows without ceasing, so also there is no limit to its preservation. Memory [...] is not a faculty of putting away recollections in a drawer, or of inscribing them in a register." - Henri Bergson';

const quoteBodyStyle = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: 'clamp(0.98rem, 2.05vw, 1.125rem)',
  fontWeight: 400,
  fontStyle: 'italic',
  color: 'rgba(255,255,255,.58)',
  lineHeight: 1.72,
  margin: 0,
  letterSpacing: '0.01em',
  textShadow: '0 1px 20px rgba(0,0,0,.85), 0 0 1px rgba(0,0,0,.6)',
};

export function StorySection({ mode }) {
  const bgSrc = mode === 'dawn' ? storyDawn : storyDusk;
  const objectPosition = mode === 'dawn' ? '48% 44%' : '82% 46%';

  return (
    <div className="grain" style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#030508' }} data-screen-label="04 Story">
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          overflow: 'hidden',
          background: '#030508',
        }}
        aria-hidden="true"
      >
        <img
          src={bgSrc}
          alt=""
          decoding="async"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'radial-gradient(ellipse 88% 82% at 50% 50%, rgba(0,0,0,.2) 0%, rgba(0,0,0,.62) 100%)',
          }}
        />
      </div>
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          flex: 1,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: mode === 'dawn' ? 'flex-end' : 'flex-start',
          padding: 'clamp(28px, 5vw, 56px)',
          paddingBottom: 'clamp(72px, 14vh, 140px)',
        }}
      >
        <blockquote
          style={{
            margin: 0,
            padding: 0,
            border: 'none',
            maxWidth: 'min(36em, 88vw)',
            textAlign: 'left',
          }}
        >
          {mode === 'dawn' ? (
            <p style={quoteBodyStyle}>{STORY_BODY_DAWN}</p>
          ) : (
            <p style={quoteBodyStyle}>
              {STORY_LINES_DUSK.map((line, i) => (
                <span key={i}>
                  {line}
                  {i < STORY_LINES_DUSK.length - 1 ? <br /> : null}
                </span>
              ))}
            </p>
          )}
        </blockquote>
      </div>
    </div>
  );
}
