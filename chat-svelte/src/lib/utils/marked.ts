import { Marked } from "marked";
import type { Tokens, TokenizerExtension, RendererExtension } from "marked";
import { parseDocument } from "htmlparser2";
// Simple type to replace removed WebSearchSource
type SimpleSource = {
	title?: string;
	link: string;
};
import { parseIncompleteMarkdown } from "./parseIncompleteMarkdown";
import { parseMarkdownIntoBlocks } from "./parseBlocks";

// ── Lazy heavy renderers ──────────────────────────────────────────────────────────────────────
// KaTeX (~80KB gz) and highlight.js (+languages) are the bulk of the markdown bundle, but the
// landing renders no math/code — so they are DYNAMICALLY imported, never static. That keeps them
// out of the eager client chunk (much faster first hydration, esp. on mobile). They load on first
// actual need (a math token / a code block) or via prefetchMarkdownAssets() during idle. Until a
// lib is present the sync path renders a READABLE fallback (plain code / raw math) and the async
// worker render upgrades it once loaded — content is NEVER blocked on the download.

type KatexRender = (tex: string, opts: { throwOnError: boolean; displayMode: boolean }) => string;
let katexRender: KatexRender | null = null;
let katexPromise: Promise<void> | null = null;
/** Load KaTeX (idempotent). Triggered only when a math token is actually present. */
export function ensureKatex(): Promise<void> {
	if (katexRender) return Promise.resolve();
	if (!katexPromise) {
		katexPromise = import("katex")
			.then(async (m) => {
				// mhchem is a side-effect-only extension (chemistry macros) with no type declaration.
				// @ts-expect-error - no types; imported for its side effect on the katex singleton
				await import("katex/dist/contrib/mhchem.mjs");
				katexRender = (tex, opts) => m.default.renderToString(tex, opts);
			})
			.catch(() => {
				katexPromise = null; // transient failure — allow a later retry
			});
	}
	return katexPromise;
}

type HljsLike = {
	getLanguage: (n: string) => unknown;
	highlight: (
		code: string,
		opts: { language: string; ignoreIllegals: boolean }
	) => { value: string };
	highlightAuto: (code: string) => { value: string };
};
let hljs: HljsLike | null = null;
let hljsPromise: Promise<void> | null = null;
/** Load highlight.js core + a trimmed common-language set (idempotent). The long tail
 *  (java/c#/c/c++/scss/…) falls back to highlightAuto, which still works — just smaller. */
export function ensureHljs(): Promise<void> {
	if (hljs) return Promise.resolve();
	if (!hljsPromise) {
		hljsPromise = (async () => {
			const [core, ...langs] = await Promise.all([
				import("highlight.js/lib/core"),
				import("highlight.js/lib/languages/javascript"),
				import("highlight.js/lib/languages/typescript"),
				import("highlight.js/lib/languages/python"),
				import("highlight.js/lib/languages/json"),
				import("highlight.js/lib/languages/bash"),
				import("highlight.js/lib/languages/shell"),
				import("highlight.js/lib/languages/go"),
				import("highlight.js/lib/languages/rust"),
				import("highlight.js/lib/languages/sql"),
				import("highlight.js/lib/languages/yaml"),
				import("highlight.js/lib/languages/xml"),
				import("highlight.js/lib/languages/css"),
				import("highlight.js/lib/languages/markdown"),
				import("highlight.js/lib/languages/plaintext"),
			]);
			const names = [
				"javascript",
				"typescript",
				"python",
				"json",
				"bash",
				"shell",
				"go",
				"rust",
				"sql",
				"yaml",
				"xml",
				"css",
				"markdown",
				"plaintext",
			];
			const h = core.default;
			names.forEach((n, i) => h.registerLanguage(n, langs[i].default));
			h.registerLanguage("html", langs[names.indexOf("xml")].default); // html ↦ xml grammar
			hljs = h as unknown as HljsLike;
		})().catch(() => {
			hljsPromise = null;
		});
	}
	return hljsPromise;
}

/** Warm both heavy renderers during idle so they're ready before the first answer needs them —
 *  the eager bundle stays light (fast hydration) while the libs prefetch in the background. */
export function prefetchMarkdownAssets(): void {
	void ensureKatex();
	void ensureHljs();
}

// Media URL detection
const VIDEO_EXTENSIONS = /\.(mp4|webm|ogg|mov|m4v)([?#]|$)/i;
const AUDIO_EXTENSIONS = /\.(mp3|wav|m4a|aac|flac)([?#]|$)/i;

function isVideoUrl(url: string): boolean {
	return VIDEO_EXTENSIONS.test(url);
}

function isAudioUrl(url: string): boolean {
	return AUDIO_EXTENSIONS.test(url);
}

// Multimedia HTML sanitization (works in Web Workers - no DOM needed)
const MULTIMEDIA_TAGS = new Set(["video", "source", "audio"]);
const MULTIMEDIA_ALLOWED_ATTRS = new Set([
	"src",
	"type",
	"controls",
	"autoplay",
	"loop",
	"muted",
	"playsinline",
	"poster",
	"width",
	"height",
	"preload",
]);
const MULTIMEDIA_BOOLEAN_ATTRS = new Set(["controls", "autoplay", "loop", "muted", "playsinline"]);
const MULTIMEDIA_URI_ATTRS = new Set(["src", "poster"]);
const MULTIMEDIA_ALLOWED_URI_PATTERN = /^(?!javascript:|data:text\/html)/i;
const MULTIMEDIA_HTML_REGEX = /<\/?(video|source|audio)\b/i;

type HtmlNode = {
	type: string;
	name?: string;
	attribs?: Record<string, string>;
	children?: HtmlNode[];
	data?: string;
};

interface katexBlockToken extends Tokens.Generic {
	type: "katexBlock";
	raw: string;
	text: string;
	displayMode: true;
}

interface katexInlineToken extends Tokens.Generic {
	type: "katexInline";
	raw: string;
	text: string;
	displayMode: false;
}

export const katexBlockExtension: TokenizerExtension & RendererExtension = {
	name: "katexBlock",
	level: "block",

	start(src: string): number | undefined {
		const match = src.match(/(\${2}|\\\[)/);
		return match ? match.index : -1;
	},

	tokenizer(src: string): katexBlockToken | undefined {
		// 1) $$ ... $$
		const rule1 = /^\${2}([\s\S]+?)\${2}/;
		const match1 = rule1.exec(src);
		if (match1) {
			const token: katexBlockToken = {
				type: "katexBlock",
				raw: match1[0],
				text: match1[1].trim(),
				displayMode: true,
			};
			return token;
		}

		// 2) \[ ... \]
		const rule2 = /^\\\[([\s\S]+?)\\\]/;
		const match2 = rule2.exec(src);
		if (match2) {
			const token: katexBlockToken = {
				type: "katexBlock",
				raw: match2[0],
				text: match2[1].trim(),
				displayMode: true,
			};
			return token;
		}

		return undefined;
	},

	renderer(token) {
		if (token.type === "katexBlock") {
			if (katexRender) {
				return katexRender(token.text, { throwOnError: false, displayMode: token.displayMode });
			}
			void ensureKatex();
			// Readable, muted fallback until KaTeX loads (the async/worker render upgrades it).
			return `<div data-katex-pending style="opacity:.55;font-family:ui-monospace,monospace">${escapeHTML(token.text)}</div>`;
		}
		return undefined;
	},
};

const katexInlineExtension: TokenizerExtension & RendererExtension = {
	name: "katexInline",
	level: "inline",

	start(src: string): number | undefined {
		const match = src.match(/(\$|\\\()/);
		return match ? match.index : -1;
	},

	tokenizer(src: string): katexInlineToken | undefined {
		// 1) $...$ — currency-safe inline math. A naive /^\$([^$]+?)\$/ swallows ordinary prose with
		// dollar AMOUNTS: "it costs $1 more, and together they cost $1.10" parses as math and renders
		// garbled (italicised, spaces stripped). Guard like GitHub's math extension: the opening $ must
		// NOT be followed by a space or digit (so "$1" reads as currency, not a math start), the content
		// is single-line and $-free, the closing $ must not be preceded by a space, and must not be
		// followed by a digit. Real inline math ("$x$", "$E=mc^2$") still matches; "\(...\)" is the
		// space/digit-proof alternative below.
		const rule1 = /^\$(?![\s\d])([^$\n]+?)(?<!\s)\$(?!\d)/;
		const match1 = rule1.exec(src);
		if (match1) {
			const token: katexInlineToken = {
				type: "katexInline",
				raw: match1[0],
				text: match1[1].trim(),
				displayMode: false,
			};
			return token;
		}

		// 2) \(...\)
		const rule2 = /^\\\(([\s\S]+?)\\\)/;
		const match2 = rule2.exec(src);
		if (match2) {
			const token: katexInlineToken = {
				type: "katexInline",
				raw: match2[0],
				text: match2[1].trim(),
				displayMode: false,
			};
			return token;
		}

		return undefined;
	},

	renderer(token) {
		if (token.type === "katexInline") {
			if (katexRender) {
				return katexRender(token.text, { throwOnError: false, displayMode: token.displayMode });
			}
			void ensureKatex();
			return `<code data-katex-pending style="opacity:.55">${escapeHTML(token.text)}</code>`;
		}
		return undefined;
	},
};

function escapeHTML(content: string) {
	return content.replace(
		/[<>&"']/g,
		(x) =>
			({
				"<": "&lt;",
				">": "&gt;",
				"&": "&amp;",
				"'": "&#39;",
				'"': "&quot;",
			})[x] || x
	);
}

function addInlineCitations(md: string, webSearchSources: SimpleSource[] = []): string {
	// Baseline bracketed reference markers — e.g. [1] or [1][2] — NOT a raised <sup>. A superscript
	// floats orphaned when the answer is a summary rather than inline-cited prose (and Apertus tends
	// to cite sparsely, so a lone raised digit reads as a typo). Bracketed baseline links also match
	// the SourceStrip's own "[n]" notation, so the inline marker and the source list read as one
	// system. Brand coral (themeable var), not the old off-palette generic blue.
	const linkStyle =
		"color: var(--ap-coral-text); text-decoration: none; font-size: 0.82em; vertical-align: baseline; letter-spacing: 0.02em;";
	return md.replace(/\[(\d+)\]/g, (match: string) => {
		const indices: number[] = (match.match(/\d+/g) || []).map(Number);
		const links: string = indices
			.map((index: number) => {
				if (index === 0) return false;
				const source = webSearchSources[index - 1];
				if (source) {
					return `<a href="${escapeHTML(source.link)}" target="_blank" rel="noreferrer" style="${linkStyle}">[${index}]</a>`;
				}
				return "";
			})
			.filter(Boolean)
			.join("");
		// Hair space keeps the marker from kerning into the preceding word; nowrap keeps it on the
		// same line as that word so a citation never wraps to a line on its own.
		return links ? `<span style="white-space:nowrap;">&#8202;${links}</span>` : match;
	});
}

function sanitizeHref(href?: string | null): string | undefined {
	if (!href) return undefined;
	const trimmed = href.trim();
	const lower = trimmed.toLowerCase();
	if (lower.startsWith("javascript:") || lower.startsWith("data:text/html")) {
		return undefined;
	}
	return trimmed.replace(/>$/, "");
}

export function highlightCode(text: string, lang?: string): string {
	if (!hljs) {
		void ensureHljs();
		// Plain (but fully readable) code until highlight.js loads; the worker render adds colors.
		return escapeHTML(text);
	}
	if (lang && hljs.getLanguage(lang)) {
		try {
			return hljs.highlight(text, { language: lang, ignoreIllegals: true }).value;
		} catch {
			// fall through to auto-detect
		}
	}
	return hljs.highlightAuto(text).value;
}

function sanitizeMediaUrl(value: string): string | undefined {
	const trimmed = value.trim().replace(/>$/, "");
	if (!MULTIMEDIA_ALLOWED_URI_PATTERN.test(trimmed)) return undefined;
	return trimmed;
}

function serializeMediaAttributes(attribs?: Record<string, string>): string {
	if (!attribs) return "";
	const parts: string[] = [];
	for (const [rawName, rawValue] of Object.entries(attribs)) {
		const name = rawName.toLowerCase();
		if (!MULTIMEDIA_ALLOWED_ATTRS.has(name)) continue;
		if (MULTIMEDIA_BOOLEAN_ATTRS.has(name)) {
			parts.push(name);
			continue;
		}
		let value = rawValue ?? "";
		if (MULTIMEDIA_URI_ATTRS.has(name)) {
			const safeUrl = sanitizeMediaUrl(value);
			if (!safeUrl) continue;
			value = safeUrl;
		}
		parts.push(`${name}="${escapeHTML(value)}"`);
	}
	return parts.length ? ` ${parts.join(" ")}` : "";
}

function serializeMediaNode(node: HtmlNode, state: { hasDisallowedTag: boolean }): string {
	if (node.type === "text") {
		return escapeHTML(node.data ?? "");
	}
	if (node.type === "tag" || node.type === "script" || node.type === "style") {
		const tagName = node.name?.toLowerCase() ?? "";
		if (!MULTIMEDIA_TAGS.has(tagName)) {
			state.hasDisallowedTag = true;
			return "";
		}
		const attrs = serializeMediaAttributes(node.attribs);
		if (tagName === "source") {
			return `<source${attrs}>`;
		}
		const children = (node.children ?? [])
			.map((child) => serializeMediaNode(child, state))
			.join("");
		return `<${tagName}${attrs}>${children}</${tagName}>`;
	}
	if (node.type === "comment") {
		return "";
	}
	return "";
}

/**
 * Sanitizes HTML to allow only video/audio/source tags with safe attributes.
 * Uses htmlparser2 which works in Web Workers (no DOM needed).
 * If any disallowed tags are found, escapes the entire input.
 */
function sanitizeHtmlForMultimedia(html: string): string {
	if (!MULTIMEDIA_HTML_REGEX.test(html)) {
		return escapeHTML(html);
	}
	const document = parseDocument(html, {
		lowerCaseAttributeNames: true,
		lowerCaseTags: true,
		recognizeSelfClosing: true,
	}) as unknown as { children: HtmlNode[] };
	const state = { hasDisallowedTag: false };
	const sanitized = (document.children ?? [])
		.map((child) => serializeMediaNode(child, state))
		.join("");
	if (state.hasDisallowedTag) {
		return escapeHTML(html);
	}
	return sanitized;
}

function createMarkedInstance(sources: SimpleSource[]): Marked {
	return new Marked({
		hooks: {
			// Mark inline `code` spans translate="no" so browser auto-translate (DE/FR readers)
			// doesn't rewrite identifiers/commands/model names into the target language. Fenced
			// blocks are tokenized out to CodeBlock.svelte (protected there), so the only <code>
			// left in this prose HTML is inline codespans — a plain replace is safe + signature-
			// independent (no marked renderer-override needed). Default marked emits bare <code>.
			postprocess: (html) =>
				addInlineCitations(html, sources).replaceAll("<code>", '<code translate="no">'),
		},
		extensions: [katexBlockExtension, katexInlineExtension],
		renderer: {
			link: (href, title, text) => {
				// Placeholder emitted by parseIncompleteMarkdown while a link's URL is
				// still streaming in: render an inert anchor instead of a dead link.
				if (href === "streamdown:incomplete-link") {
					return `<a data-incomplete-link>${text}</a>`;
				}
				const safeHref = sanitizeHref(href);
				return safeHref
					? `<a href="${escapeHTML(safeHref)}" target="_blank" rel="noreferrer">${text}</a>`
					: `<span>${escapeHTML(text ?? "")}</span>`;
			},
			image: (href, title, text) => {
				const safeHref = sanitizeHref(href);
				if (!safeHref) return `<span>${escapeHTML(text ?? "")}</span>`;

				const safeSrc = escapeHTML(safeHref);
				const safeTitle = title ? ` title="${escapeHTML(title)}"` : "";
				const safeAlt = escapeHTML(text ?? "");

				if (isVideoUrl(safeHref)) {
					return `<video controls${safeTitle}><source src="${safeSrc}">${safeAlt}</video>`;
				}
				if (isAudioUrl(safeHref)) {
					return `<audio controls${safeTitle}><source src="${safeSrc}">${safeAlt}</audio>`;
				}
				return `<img src="${safeSrc}" alt="${safeAlt}"${safeTitle} />`;
			},
			html: (html) => sanitizeHtmlForMultimedia(html),
		},
		gfm: true,
		breaks: true,
	});
}
function isFencedBlockClosed(raw?: string): boolean {
	if (!raw) return true;
	/* eslint-disable-next-line no-control-regex */
	const trimmed = raw.replace(/[\s\u0000]+$/, "");
	const openingFenceMatch = trimmed.match(/^([`~]{3,})/);
	if (!openingFenceMatch) {
		return true;
	}
	const fence = openingFenceMatch[1];
	const closingFencePattern = new RegExp(`(?:\n|\r\n)${fence}(?:[\t ]+)?$`);
	return closingFencePattern.test(trimmed);
}

type CodeToken = {
	type: "code";
	lang: string;
	code: string;
	rawCode: string;
	isClosed: boolean;
};

type TextToken = {
	type: "text";
	html: string | Promise<string>;
};

const blockCache = new Map<string, BlockToken>();

function cacheKey(index: number, blockContent: string, sources: SimpleSource[]) {
	const sourceKey = sources.map((s) => s.link).join("|");
	return `${index}-${hashString(blockContent)}|${sourceKey}`;
}

export async function processTokens(content: string, sources: SimpleSource[]): Promise<Token[]> {
	// Full-fidelity render (the worker / no-worker async path). Load only what THIS content needs,
	// then render — so a plain-text answer never pulls KaTeX/highlight.js, and KaTeX loads only when
	// a math delimiter is actually present (lazy KaTeX). The sync path already painted a readable
	// fallback; awaiting here is what upgrades it.
	const needsMath = /\$|\\\(/.test(content);
	const needsCode = content.includes("```") || content.includes("~~~") || content.includes("`");
	await Promise.all([needsMath ? ensureKatex() : undefined, needsCode ? ensureHljs() : undefined]);

	const marked = createMarkedInstance(sources);
	const tokens = marked.lexer(content);

	const processedTokens = await Promise.all(
		tokens.map(async (token) => {
			if (token.type === "code") {
				return {
					type: "code" as const,
					lang: token.lang,
					code: highlightCode(token.text, token.lang),
					rawCode: token.text,
					isClosed: isFencedBlockClosed(token.raw ?? ""),
				};
			} else {
				return {
					type: "text" as const,
					html: marked.parse(token.raw),
				};
			}
		})
	);

	return processedTokens;
}

export function processTokensSync(content: string, sources: SimpleSource[]): Token[] {
	const marked = createMarkedInstance(sources);
	const tokens = marked.lexer(content);
	return tokens.map((token) => {
		if (token.type === "code") {
			return {
				type: "code" as const,
				lang: token.lang,
				code: highlightCode(token.text, token.lang),
				rawCode: token.text,
				isClosed: isFencedBlockClosed(token.raw ?? ""),
			};
		}
		return { type: "text" as const, html: marked.parse(token.raw) };
	});
}

export type Token = CodeToken | TextToken;

export type BlockToken = {
	id: string;
	content: string;
	tokens: Token[];
};

/**
 * Simple hash function for generating stable block IDs
 */
function hashString(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32bit integer
	}
	return Math.abs(hash).toString(36);
}

/**
 * Process markdown content into blocks with stable IDs for efficient memoization.
 * Each block is processed independently and assigned a content-based hash ID.
 *
 * `streaming` applies incomplete-markdown repairs (remend) to the content before
 * splitting, like upstream streamdown does in streaming mode. It must be false for
 * completed messages so valid final markdown (e.g. a trailing setext heading) is
 * not rewritten by the streaming flash guards.
 */
export async function processBlocks(
	content: string,
	sources: SimpleSource[] = [],
	streaming = false
): Promise<BlockToken[]> {
	const processedContent = streaming ? parseIncompleteMarkdown(content) : content;
	const blocks = parseMarkdownIntoBlocks(processedContent);

	return await Promise.all(
		blocks.map(async (blockContent, index) => {
			const key = cacheKey(index, blockContent, sources);
			const cached = blockCache.get(key);
			if (cached) return cached;

			const tokens = await processTokens(blockContent, sources);
			const block: BlockToken = {
				id: `${index}-${hashString(blockContent)}`,
				content: blockContent,
				tokens,
			};
			blockCache.set(key, block);
			return block;
		})
	);
}

/**
 * Synchronous version of processBlocks for SSR
 */
export function processBlocksSync(
	content: string,
	sources: SimpleSource[] = [],
	streaming = false
): BlockToken[] {
	const processedContent = streaming ? parseIncompleteMarkdown(content) : content;
	const blocks = parseMarkdownIntoBlocks(processedContent);

	return blocks.map((blockContent, index) => {
		const key = cacheKey(index, blockContent, sources);
		const cached = blockCache.get(key);
		if (cached) return cached;

		const tokens = processTokensSync(blockContent, sources);
		const block: BlockToken = {
			id: `${index}-${hashString(blockContent)}`,
			content: blockContent,
			tokens,
		};
		blockCache.set(key, block);
		return block;
	});
}
