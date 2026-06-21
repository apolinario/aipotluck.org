# Security Policy

We take the security and privacy of AI Potluck Chat seriously — it's a public-interest
project, and people trust it with their questions.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Email **[justin@publicai.co](mailto:justin@publicai.co)** with:

- a description of the issue and where it lives (file, endpoint, or page),
- steps to reproduce, or a proof-of-concept, and
- the potential impact as you see it.

We aim to acknowledge your report within a few business days, keep you updated as we
investigate, and credit you (if you'd like) once a fix ships. Please give us a reasonable
window to address the issue before any public disclosure.

## Scope

Most useful to us: authentication/session handling, the chat and conversation API routes,
the moderation/safety pre-screen, prompt-injection and data-exfiltration paths, and anything
that could expose another user's data. Findings in upstream dependencies are welcome too —
point us at the advisory and where we're affected.

## Out of scope

Reports generated solely by automated scanners with no demonstrated impact, missing
security headers without an exploit, and social-engineering or physical attacks.

Thank you for helping keep the Potluck safe.
