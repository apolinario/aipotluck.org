// Capture the chat transcript (map closed) at 2x: a plain turn + a grounded (cited) turn,
// to study user/assistant alignment and how inline [n] citations render.
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:5180";
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1100, height: 950 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
const s = page.getByRole("button", { name: /start chatting/i });
if (await s.isVisible().catch(() => false)) { await s.click(); await page.waitForTimeout(400); }

async function ask(q) {
	const before = await page.evaluate(() => document.querySelectorAll('[data-message-role="assistant"]').length);
	await page.evaluate(() => document.querySelector("textarea")?.focus());
	await page.keyboard.type(q, { delay: 2 });
	await page.waitForTimeout(120);
	await page.keyboard.press("Enter");
	let last = -1, stable = 0;
	for (let i = 0; i < 75; i++) {
		await page.waitForTimeout(1000);
		const st = await page.evaluate((b) => {
			const a = [...document.querySelectorAll('[data-message-role="assistant"]')];
			return { n: a.length, len: (a.at(-1)?.innerText || "").length };
		}, before);
		if (st.n <= before) continue;
		if (st.len === last && st.len > 0) { if (++stable >= 2) break; } else { stable = 0; last = st.len; }
	}
}

await ask("What is the capital of Switzerland?");
await page.waitForTimeout(400);
await ask("What's the current status of the EU AI Act enforcement timeline?");
await page.waitForTimeout(600);
// measure left offsets of user vs assistant text
const offsets = await page.evaluate(() => {
	const u = document.querySelector('[data-message-type="user"] p');
	const a = document.querySelector('[data-message-role="assistant"] .prose');
	const sup = document.querySelector('[data-message-role="assistant"] sup');
	const r = (el) => (el ? Math.round(el.getBoundingClientRect().left) : null);
	return {
		userLeft: r(u),
		assistantLeft: r(a),
		hasSup: !!sup,
		supHTML: sup ? sup.outerHTML.slice(0, 200) : null,
		viewport: window.innerWidth,
	};
});
console.log(`RESULT ${JSON.stringify(offsets)}`);
await page.screenshot({ path: "evals/ux/transcript-2x.png", fullPage: true });
await browser.close();
