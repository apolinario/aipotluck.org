// Prewritten share copy + the social-card strings. "Sharing" is a named launch KPI and the
// goal is narrative spread of the INITIATIVE — so we share the site (not a private
// conversation), with a non-personal `?ref=share` tag the already-wired GTM can attribute.
// Kept in one place so the share sheet and the <meta> social card stay in sync.

export const SHARE_TITLE = "AI Potluck";

// Appended after the app name on social cards → "AI Potluck — open-source, sovereign AI".
export const SHARE_TAGLINE = "open-source, sovereign AI";

// Used for the native share sheet's text AND the og/twitter:description, so a shared link
// reads the same wherever it lands. Plain, non-hype voice.
export const SHARE_TEXT =
	"A public, open-source AI you can actually use — and see what's behind every answer.";

// Non-personal campaign tag on the shared URL (never anything user-identifying — privacy rule).
export const SHARE_REF = "share";

// OG/Twitter card image (1200×630), served from static/. Functional default on the editorial
// theme; the polished branded asset is a Clever Franke hand-off.
export const SHARE_IMAGE = "/aipotluck-og.png";
