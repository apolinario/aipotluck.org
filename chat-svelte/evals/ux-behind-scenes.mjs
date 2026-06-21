// Step 3 verify — the map is hidden by default and revealed by the trace's single
// "behind the scenes ↗" tail link. One responsive overlay: right drawer (desktop) / bottom
// sheet (mobile). Run: node evals/ux-behind-scenes.mjs  (dev :5173). PNGs → evals/ux/bs-*.png
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const BASE = process.env.BASE || "http://localhost:5173";
mkdirSync("evals/ux", { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });

async function dismiss(page) {
	const s = page.getByRole("button", { name: /start chatting/i });
	if (await s.isVisible().catch(() => false)) {
		await s.click();
		await page.waitForTimeout(400);
	}
}
async function answer(page, q, maxS = 60) {
	const base0 = await page.evaluate(
		() => document.querySelectorAll('[data-message-role="assistant"]').length
	);
	await page.evaluate(() => document.querySelector("textarea")?.focus());
	await page.keyboard.type(q, { delay: 3 });
	await page.waitForTimeout(120);
	await page.keyboard.press("Enter");
	let last = -1,
		stable = 0;
	for (let i = 0; i < maxS; i++) {
		await page.waitForTimeout(1000);
		const s = await page.evaluate((b) => {
			const a = [...document.querySelectorAll('[data-message-role="assistant"]')];
			return { n: a.length, len: (a.at(-1)?.innerText || "").length };
		}, base0);
		if (s.n <= base0) continue;
		if (s.len === last && s.len > 0) {
			if (++stable >= 2) break;
		} else {
			stable = 0;
			last = s.len;
		}
	}
}

async function revealAndProbe(page, label) {
	// Expand the trace (the summary-chip head), then click the single tail link.
	const head = page.getByRole("button", { name: /how this answer was made/i }).last();
	if (await head.isVisible().catch(() => false)) {
		await head.click();
		await page.waitForTimeout(250);
	}
	const link = page.getByRole("button", { name: /behind the scenes/i }).last();
	const linkSeen = await link.isVisible().catch(() => false);
	if (linkSeen) await link.click();
	await page.waitForTimeout(600); // slide-in + flash
	const open = await page.evaluate(() => {
		const d = document.querySelector('[role="dialog"][aria-label*="Behind the scenes"]');
		if (!d) return { mounted: false };
		const r = d.getBoundingClientRect();
		return {
			mounted: true,
			hidden: d.getAttribute("aria-hidden"),
			inView: r.left < window.innerWidth - 8 && r.top < window.innerHeight - 8 && r.right > 8,
			rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) },
			vw: window.innerWidth,
		};
	});
	await page.screenshot({ path: `evals/ux/bs-${label}-open.png`, fullPage: false });
	await page.keyboard.press("Escape");
	await page.waitForTimeout(400);
	const closed = await page.evaluate(() => {
		const d = document.querySelector('[role="dialog"][aria-label*="Behind the scenes"]');
		return d ? d.getAttribute("aria-hidden") : "gone";
	});
	await page.screenshot({ path: `evals/ux/bs-${label}-closed.png`, fullPage: false });
	console.log(
		`RESULT ${JSON.stringify({ label, linkSeen, ...open, closedAriaHidden: closed })}`
	);
}

// Desktop: map must be ABSENT from the empty state, then revealed as a right drawer.
const d = await browser.newContext({ viewport: { width: 1366, height: 900 } });
let page = await d.newPage();
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await dismiss(page);
const mapVisibleAtRest = await page.evaluate(() => {
	const d = document.querySelector('[role="dialog"][aria-label*="Behind the scenes"]');
	if (!d) return false;
	const r = d.getBoundingClientRect();
	return r.left < window.innerWidth - 8; // any part on-screen
});
console.log(`RESULT ${JSON.stringify({ check: "desktop-at-rest", mapVisibleAtRest })}`);
await page.screenshot({ path: "evals/ux/bs-desktop-empty.png" });
await answer(page, "What is the capital of Switzerland?");
await page.waitForTimeout(600);
await revealAndProbe(page, "desktop");
await page.close();

// Mobile: revealed as a bottom sheet.
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
page = await m.newPage();
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await dismiss(page);
await answer(page, "What is the capital of Switzerland?");
await page.waitForTimeout(600);
await revealAndProbe(page, "mobile");
await page.close();

await browser.close();
