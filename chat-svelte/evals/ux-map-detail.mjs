// Expand specific map nodes and capture the detail view at 2x for a design pass.
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:5180";
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
const s = page.getByRole("button", { name: /start chatting/i });
if (await s.isVisible().catch(() => false)) { await s.click(); await page.waitForTimeout(400); }
await page.evaluate(() => document.querySelector("textarea")?.focus());
await page.keyboard.type("What is the capital of Switzerland?", { delay: 3 });
await page.waitForTimeout(120);
await page.keyboard.press("Enter");
let last = -1, stable = 0;
for (let i = 0; i < 70; i++) {
	await page.waitForTimeout(1000);
	const len = await page.evaluate(() => {
		const a = [...document.querySelectorAll('[data-message-role="assistant"]')];
		return (a.at(-1)?.innerText || "").length;
	});
	if (len === last && len > 0) { if (++stable >= 2) break; } else { stable = 0; last = len; }
}
await page.waitForTimeout(400);
await page.getByRole("button", { name: /how this answer was made/i }).last().click().catch(() => {});
await page.waitForTimeout(250);
await page.getByRole("button", { name: /behind the scenes/i }).last().click().catch(() => {});
await page.waitForTimeout(700);

async function expandAndShoot(nodeId, label) {
	const ok = await page.evaluate((id) => {
		const btn = document.querySelector(`[role="dialog"] [data-node-id="${id}"]`);
		if (!btn) return false;
		btn.scrollIntoView({ block: "center" });
		if (btn.getAttribute("aria-expanded") !== "true") btn.click();
		return true;
	}, nodeId);
	if (!ok) { console.log(`RESULT ${JSON.stringify({ nodeId, found: false })}`); return; }
	await page.waitForTimeout(450);
	const box = await page.evaluate((id) => {
		const btn = document.querySelector(`[role="dialog"] [data-node-id="${id}"]`);
		const r = btn.getBoundingClientRect();
		return { x: Math.max(0, r.x - 8), y: Math.max(0, r.y - 8), width: r.width + 16, height: r.height + 16 };
	}, nodeId);
	await page.screenshot({ path: `evals/ux/node-${label}-2x.png`, clip: box });
	// collapse again so the next node sits at a predictable scroll
	await page.evaluate((id) => {
		const btn = document.querySelector(`[role="dialog"] [data-node-id="${id}"]`);
		if (btn?.getAttribute("aria-expanded") === "true") btn.click();
	}, nodeId);
	await page.waitForTimeout(200);
	console.log(`RESULT ${JSON.stringify({ nodeId, found: true })}`);
}

// list available node ids for reference
const ids = await page.evaluate(() =>
	[...document.querySelectorAll('[role="dialog"] [data-node-id]')].map((b) => b.getAttribute("data-node-id"))
);
console.log(`RESULT ${JSON.stringify({ ids })}`);
await expandAndShoot("apertus", "apertus");
// a gap/wanted node (has "Get involved →"): pick the first wanted one if present
const wantedId = await page.evaluate(() => {
	const b = [...document.querySelectorAll('[role="dialog"] [data-node-id]')]
		.find((x) => /open invitation|building|gap/i.test(x.innerText) && /get involved/i.test(x.innerText));
	return b?.getAttribute("data-node-id") ?? null;
});
if (wantedId) await expandAndShoot(wantedId, "gap");
await browser.close();
