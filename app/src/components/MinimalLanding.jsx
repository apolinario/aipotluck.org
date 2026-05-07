import logoBlack from '../assets/currentai-logo-black-transparent.png';

const CONTACT_SUBJECT = encodeURIComponent('Joining the AI Potluck');
const CONTACT_BODY = encodeURIComponent(
  [
    'Hi Current AI team,',
    '',
    "I'd love to join the AI Potluck and get involved.",
    '',
    'AI Potluck is a shared table for builders: a collaborative effort to map the open-source AI ecosystem, identify meaningful gaps, and coordinate contributions so the ecosystem grows stronger together.',
    '',
    'A little about me:',
    '- Name:',
    '- Background:',
    '- What I want to contribute:',
    '- Links (GitHub/website):',
    '',
    'Looking forward to connecting.',
  ].join('\n'),
);

export function MinimalLanding() {
  return (
    <main className="minimal-landing">
      <div className="minimal-landing__inner">
        <img
          src={logoBlack}
          alt="Current AI"
          className="minimal-landing__logo"
          width={506}
          height={96}
        />

        <div className="minimal-landing__copy">
          <p>
            Every culture in the world has a version of the shared meal. The Persian sofreħ, the
            Lebanese mezza, the Indian thali, the Spanish tapas. Long before states and institutions
            existed, humans had technologies for coordination, and the most enduring one is the shared
            table. When people bring their best and break bread together, something emerges that no
            single person could have done alone.
          </p>
          <p>
            We’re making a bet that this oldest model of collective abundance is also the right one
            for the moment we are in.
          </p>
        </div>

        <div className="minimal-landing__actions">
          <div className="minimal-landing__links-row">
            <a className="minimal-landing__link" href="/gaps">
              Gaps
            </a>
            <span className="minimal-landing__link minimal-landing__link--muted" aria-disabled="true">
              Roadmap (coming soon)
            </span>
          </div>
          <a
            className="minimal-landing__link"
            href={`mailto:ayah@currentai.org,josh@currentai.org?subject=${CONTACT_SUBJECT}&body=${CONTACT_BODY}`}
          >
            Get in touch
          </a>
        </div>
      </div>
    </main>
  );
}
