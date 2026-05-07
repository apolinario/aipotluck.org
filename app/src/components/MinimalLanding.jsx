import logoBlack from '../assets/currentai-logo-black.jpg';

const CONTACT_SUBJECT = encodeURIComponent('Current AI — Get in touch');
const CONTACT_BODY = encodeURIComponent(
  'Hi Current AI,\n\nI would like to get in touch.\n',
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
          <a className="minimal-landing__link" href="/gaps">
            Gaps
          </a>
          <span className="minimal-landing__link minimal-landing__link--muted" aria-disabled="true">
            Roadmap (coming soon)
          </span>
          <a
            className="minimal-landing__link"
            href={`mailto:?subject=${CONTACT_SUBJECT}&body=${CONTACT_BODY}`}
          >
            Get in touch
          </a>
        </div>
      </div>
    </main>
  );
}
