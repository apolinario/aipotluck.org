import { useState } from 'react';
import logoBlack from '../assets/currentai-logo-black-transparent.png';

const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mrejlvak';

export function MinimalLanding() {
  const [email, setEmail] = useState('');
  const [submitState, setSubmitState] = useState('idle');

  const handleEmailDrop = async (event) => {
    event.preventDefault();
    const normalized = email.trim();
    if (!normalized) return;

    setSubmitState('submitting');

    try {
      const formData = new FormData();
      formData.append('email', normalized);
      formData.append('source', 'current-ai-landing');

      const response = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        body: formData,
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Form submission failed');
      }

      setSubmitState('success');
      setEmail('');
    } catch {
      setSubmitState('error');
    }
  };

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
            Every culture in the world has a version of the shared meal. The Lebanese mezza, the
            Indian thali, the Spanish tapas. Long before states and institutions existed, humans had
            technologies for coordination, and the most enduring one is the shared table. When people
            bring their best and break bread together, something emerges that no single person could
            have done alone.
          </p>
          <p>
            We’re making a bet that this oldest model of collective abundance is also the right one
            for the moment we are in.
          </p>
        </div>

        <div className="minimal-landing__actions">
          <div className="minimal-landing__links-row">
            <a className="minimal-landing__link" href="/stacks">
              Stacks
            </a>
          </div>
          <form className="minimal-landing__email-drop" onSubmit={handleEmailDrop}>
            <label className="minimal-landing__email-label" htmlFor="email-drop">
              Get in touch
            </label>
            <div className="minimal-landing__email-row">
              <input
                id="email-drop"
                className="minimal-landing__email-input"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (submitState !== 'idle') setSubmitState('idle');
                }}
                placeholder="Drop your email"
                required
              />
              <button
                type="submit"
                className="minimal-landing__email-submit"
                disabled={submitState === 'submitting'}
              >
                {submitState === 'submitting' ? 'Submitting…' : 'Submit'}
              </button>
            </div>
            {submitState === 'success' ? (
              <p className="minimal-landing__email-note">Thanks, your email has been saved.</p>
            ) : null}
            {submitState === 'error' ? (
              <p className="minimal-landing__email-note minimal-landing__email-note--error">
                We could not save your email. Please try again.
              </p>
            ) : null}
          </form>
        </div>
      </div>
    </main>
  );
}
