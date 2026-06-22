import { describe, expect, test } from "vitest";
import { processBlocksSync, processTokensSync } from "./marked";

function renderHtml(md: string): string {
	const tokens = processTokensSync(md, []);
	const textToken = tokens.find((token) => token.type === "text");
	if (!textToken || textToken.type !== "text") return "";
	return typeof textToken.html === "string" ? textToken.html : "";
}

function renderHtmlWithSources(
	md: string,
	sources: Array<{ title: string; link: string }>
): string {
	const tokens = processTokensSync(md, sources);
	const textToken = tokens.find((token) => token.type === "text");
	if (!textToken || textToken.type !== "text") return "";
	return typeof textToken.html === "string" ? textToken.html : "";
}

// Full pipeline render (block splitting + optional streaming repairs), as used by MarkdownRenderer
function renderBlocksHtml(md: string, streaming: boolean): string {
	return processBlocksSync(md, [], streaming)
		.flatMap((block) => block.tokens)
		.map((token) => (token.type === "text" && typeof token.html === "string" ? token.html : ""))
		.join("");
}

describe("marked basic rendering", () => {
	test("renders bold text", () => {
		const html = renderHtml("**bold**");
		expect(html).toContain("<strong>bold</strong>");
	});

	test("renders links", () => {
		const html = renderHtml("[link](https://example.com)");
		expect(html).toContain('<a href="https://example.com"');
		expect(html).toContain("link</a>");
	});

	test("renders paragraphs", () => {
		const html = renderHtml("hello world");
		expect(html).toContain("<p>hello world</p>");
	});
});

describe("inline web-search citations", () => {
	const sources = [
		{ title: "First", link: "https://a.example/page" },
		{ title: "Second", link: "https://b.example/page" },
	];

	test("turns [n] into a baseline bracketed link to the matching source (not a superscript)", () => {
		const html = renderHtmlWithSources("The capital is Bern [1].", sources);
		expect(html).not.toContain("<sup>");
		expect(html).toContain('<a href="https://a.example/page"');
		expect(html).toContain('target="_blank"');
		expect(html).toContain("[1]</a>");
		expect(html).toContain("vertical-align: baseline");
	});

	test("links each citation to its own source", () => {
		const html = renderHtmlWithSources("See [1] and also [2].", sources);
		expect(html).toContain('href="https://a.example/page"');
		expect(html).toContain('href="https://b.example/page"');
		expect(html).toContain("[1]</a>");
		expect(html).toContain("[2]</a>");
	});

	test("leaves [n] literal when the index is out of range", () => {
		const html = renderHtmlWithSources("Citing [3] here.", sources);
		expect(html).not.toContain('<a href="https://a.example/page"');
		expect(html).toContain("[3]");
	});

	test("leaves [0] literal (no zero-th source)", () => {
		const html = renderHtmlWithSources("Footnote [0].", sources);
		expect(html).not.toContain("<a href=");
		expect(html).toContain("[0]");
	});

	test("leaves [n] literal when there are no sources", () => {
		const html = renderHtmlWithSources("No web search [1].", []);
		expect(html).not.toContain("<a href=");
		expect(html).toContain("[1]");
	});

	test("renders a non-link marker (never a dead href) for a source with no url", () => {
		// RAG / local-knowledge sources often have no public URL — the marker must NOT be a dead
		// <a href="">[n]</a> that looks clickable but goes nowhere.
		const html = renderHtmlWithSources("From the catalog [1].", [{ title: "Catalog entry", link: "" }]);
		expect(html).not.toContain('href=""');
		expect(html).not.toContain("<a ");
		expect(html).toContain("[1]");
		expect(html).toContain("<span"); // static marker
	});

	test("escapes special characters in the source URL", () => {
		const html = renderHtmlWithSources("Ref [1].", [
			{ title: "Q", link: "https://x.example/?a=1&b=2" },
		]);
		expect(html).toContain("&amp;");
		expect(html).not.toContain('?a=1&b=2"');
	});
});

describe("marked image renderer", () => {
	test("renders video extensions as <video>", () => {
		const html = renderHtml("![](https://example.com/clip.mp4)");
		expect(html).toContain("<video controls");
		expect(html).toContain('<source src="https://example.com/clip.mp4">');
	});

	test("renders audio extensions as <audio>", () => {
		const html = renderHtml("![](https://example.com/clip.mp3)");
		expect(html).toContain("<audio controls");
		expect(html).toContain('<source src="https://example.com/clip.mp3">');
	});

	test("renders non-video images as <img>", () => {
		const html = renderHtml("![](https://example.com/pic.png)");
		expect(html).toContain('<img src="https://example.com/pic.png"');
	});

	test("renders video with query params", () => {
		const html = renderHtml("![](https://example.com/clip.mp4?token=abc)");
		expect(html).toContain("<video controls");
		expect(html).toContain("clip.mp4?token=abc");
	});
});

describe("marked html video tag support", () => {
	test("allows raw <video> tags with controls", () => {
		const html = renderHtml('<video controls src="https://example.com/video.mp4"></video>');
		expect(html).toContain("<video");
		expect(html).toContain("controls");
		expect(html).toContain('src="https://example.com/video.mp4"');
	});

	test("allows <video> with nested <source> tags", () => {
		const html = renderHtml(
			'<video controls><source src="https://example.com/video.webm" type="video/webm"></video>'
		);
		expect(html).toContain("<video");
		expect(html).toContain("<source");
		expect(html).toContain('src="https://example.com/video.webm"');
	});

	test("strips disallowed attributes from video tags", () => {
		const html = renderHtml('<video onclick="alert(1)" src="https://example.com/v.mp4"></video>');
		expect(html).toContain("<video");
		expect(html).not.toContain("onclick");
	});

	test("strips javascript: URLs from media sources", () => {
		const html = renderHtml('<video controls src="javascript:alert(1)"></video>');
		expect(html).not.toContain("javascript:");
	});

	test("escapes disallowed html tags", () => {
		const html = renderHtml("<script>alert(1)</script>");
		expect(html).not.toContain("<script>");
		expect(html).toContain("&lt;script&gt;");
	});

	test("allows <audio> tags with controls", () => {
		const html = renderHtml(
			'<audio controls><source src="https://example.com/audio.mp3" type="audio/mpeg"></audio>'
		);
		expect(html).toContain("<audio");
		expect(html).toContain("<source");
		expect(html).toContain('type="audio/mpeg"');
	});
});

describe("streaming incomplete markdown", () => {
	test("incomplete link renders as inert anchor, not a dead clickable link", () => {
		const html = renderBlocksHtml("Check [the docs](https://exam", true);
		expect(html).toContain("<a data-incomplete-link>the docs</a>");
		expect(html).not.toContain("streamdown:incomplete-link");
		expect(html).not.toContain("target=");
	});

	test("incomplete link text renders as inert anchor", () => {
		const html = renderBlocksHtml("Check [the doc", true);
		expect(html).toContain("<a data-incomplete-link>the doc</a>");
	});

	test("complete links keep their href", () => {
		const html = renderBlocksHtml("Check [the docs](https://example.com)", true);
		expect(html).toContain('<a href="https://example.com" target="_blank" rel="noreferrer">');
		expect(html).not.toContain("data-incomplete-link");
	});

	test("incomplete bold renders as bold", () => {
		const html = renderBlocksHtml("Some **important tex", true);
		expect(html).toContain("<strong>important tex</strong>");
	});

	test("incomplete inline code renders as code", () => {
		const html = renderBlocksHtml("Run `npm insta", true);
		// translate="no": inline code is opted out of browser auto-translate (DE/FR readers)
		// so identifiers/commands aren't rewritten into the target language.
		expect(html).toContain('<code translate="no">npm insta</code>');
	});

	test("partial trailing HTML tag does not flash as raw text", () => {
		const html = renderBlocksHtml("Some text <video contro", true);
		expect(html).toContain("Some text");
		expect(html).not.toContain("video contro");
	});

	test("lone dash while a list streams in does not flash previous text as heading", () => {
		const html = renderBlocksHtml("Shopping list:\n-", true);
		expect(html).not.toContain("<h2>");
		expect(html).toContain("Shopping list:");
	});

	test("single tilde ranges do not flash as strikethrough", () => {
		const html = renderBlocksHtml("Heat to 20~25°C", true);
		expect(html).not.toContain("<del>");
		expect(html).toContain("20~25°C");
	});

	test("comparison operator in list items does not render a blockquote", () => {
		const html = renderBlocksHtml("- > 25: expensive", true);
		expect(html).not.toContain("<blockquote>");
		expect(html).toContain("&gt; 25: expensive");
	});
});

describe("completed messages render unmodified markdown", () => {
	test("a trailing setext heading still renders as a heading", () => {
		// Regression: remend's setext flash guard must not rewrite completed content
		const html = renderBlocksHtml("Title\n-", false);
		expect(html).toContain("<h2>Title</h2>");
	});

	test("the same trailing setext heading is guarded while streaming", () => {
		const html = renderBlocksHtml("Title\n-", true);
		expect(html).not.toContain("<h2>");
	});

	test("incomplete markers in completed content render literally", () => {
		const html = renderBlocksHtml("Some **truncated outpu", false);
		expect(html).toContain("**truncated outpu");
		expect(html).not.toContain("<strong>");
	});

	test("incomplete links in completed content render literally", () => {
		const html = renderBlocksHtml("Check [the docs](https://exam", false);
		expect(html).not.toContain("data-incomplete-link");
		// Bracket syntax stays literal text (the bare URL may still be autolinked by GFM)
		expect(html).toContain("[the docs](");
	});
});

describe("processBlocksSync streaming behavior", () => {
	test("regex character classes in code do not collapse the document into one block", () => {
		const content = [
			"Match whitespace:",
			"",
			"```js",
			"const re = /[^\\s>]+/;",
			"```",
			"",
			"And some trailing explanation.",
		].join("\n");
		const blocks = processBlocksSync(content, []);
		expect(blocks.length).toBeGreaterThan(1);
	});

	test("block ids of completed blocks are stable while streaming and after completion", () => {
		const full = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.";
		// Final render: completed message, no streaming repairs
		const fullIds = processBlocksSync(full, [], false).map((b) => b.id);
		// Mid-stream render: third paragraph still arriving, repairs active
		const partialIds = processBlocksSync(`${full.slice(0, -10)}`, [], true).map((b) => b.id);
		expect(partialIds.slice(0, -1)).toEqual(fullIds.slice(0, partialIds.length - 1));
	});
});

// ── Lazy heavy-render path ──────────────────────────────────────────────────────────────────
// processBlocks (async) is what the worker uses. It dynamically loads highlight.js / KaTeX only
// when the content needs them, then renders full-fidelity — the upgrade over the readable
// sync fallback. These assert the lazy load actually wires up correctly.
import { processBlocks, highlightCode, ensureHljs, ensureKatex } from "./marked";

describe("lazy full-render (processBlocks async)", () => {
	test("sync code render is plain+readable BEFORE highlight.js loads", () => {
		// Fresh module state isn't guaranteed across the suite, but the contract holds either way:
		// the output must contain the literal code text (readable), highlighted or not.
		const tokens = processTokensSync("```js\nconst x = 1;\n```", []);
		const code = tokens.find((t) => t.type === "code");
		expect(code && code.type === "code" && code.code).toContain("const x = 1;");
	});

	test("async render highlights code (loads highlight.js on demand)", async () => {
		await ensureHljs();
		expect(highlightCode("const x = 1;", "javascript")).toContain("hljs-");
		const blocks = await processBlocks("```js\nconst x = 1;\n```", []);
		const code = blocks.flatMap((b) => b.tokens).find((t) => t.type === "code");
		expect(code && code.type === "code" && code.code).toContain("hljs-");
	});

	test("async render produces KaTeX HTML for math (loads katex on demand)", async () => {
		await ensureKatex();
		const blocks = await processBlocks("energy $E=mc^2$ today", []);
		const htmls = await Promise.all(
			blocks
				.flatMap((b) => b.tokens)
				.filter((t) => t.type === "text")
				.map((t) => (t.type === "text" ? t.html : ""))
		);
		expect(htmls.join(" ")).toContain('class="katex"');
	});

	// Regression: dollar AMOUNTS in prose ("$1 more, together $1.10") were parsed as $...$ inline math
	// and rendered garbled (italicised, spaces stripped → "1morethanthe..."). The currency-safe rule
	// must leave them as literal text. A math token renders the <code data-katex-pending> sync fallback,
	// so its absence proves the amounts weren't treated as math.
	test("dollar amounts are NOT parsed as inline math (currency-safe)", () => {
		const html = renderHtml("the ball is $0.05, the bat $1.05, together $1.10");
		expect(html).toContain("$0.05");
		expect(html).toContain("$1.10");
		expect(html).not.toContain("data-katex-pending");
	});

	// (Real inline math still works is covered by the "$E=mc^2$" async test above — the currency-safe
	// regex matches that expression unchanged; it only rejects $-amounts.)
});
