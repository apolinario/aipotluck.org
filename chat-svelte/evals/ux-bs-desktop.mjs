// Desktop-only re-probe of the "behind the scenes ↗" right drawer (server warm).
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:5180";
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
const s = page.getByRole("button", { name: /start chatting/i });
if (await s.isVisible().catch(() => false)) {
	await s.click();
	await page.waitForTimeout(400);
}
// Send and wait for the answer to fully settle.
await page.evaluate(() => document.querySelector("textarea")?.focus());
await page.keyboard.type("What is the capital of Switzerland?", { delay: 3 });
await page.waitForTimeout(120);
await page.keyboard.press("Enter");
let last = -1,
	stable = 0;
for (let i = 0; i < 70; i++) {
	await page.waitForTimeout(1000);
	const len = await page.evaluate(() => {
		const a = [...document.querySelectorAll('[data-message-role="assistant"]')];
		return (a.at(-1)?.innerText || "").length;
	});
	if (len === last && len > 0) {
		if (++stable >= 2) break;
	} else {
		stable = 0;
		last = len;
	}
}
await page.waitForTimeout(500);
// Expand the trace, then click the single tail link.
const head = page.getByRole("button", { name: /how this answer was made/i }).last();
await head.scrollIntoViewIfNeeded().catch(() => {});
await head.click().catch(() => {});
await page.waitForTimeout(300);
const link = page.getByRole("button", { name: /behind the scenes/i }).last();
const linkSeen = await link.isVisible().catch(() => false);
if (linkSeen) {
	await link.scrollIntoViewIfNeeded().catch(() => {});
	await link.click();
}
await page.waitForTimeout(700);
const open = await page.evaluate(() => {
	const d = document.querySelector('[role="dialog"][aria-label*="Behind the scenes"]');
	const r = d?.getBoundingClientRect();
	// any node currently flashed/highlighted on the map?
	const flashed = document.querySelectorAll('[data-flash="true"], .flash, .ring-flash').length;
	return {
		hidden: d?.getAttribute("aria-hidden"),
		x: Math.round(r?.x ?? -1),
		w: Math.round(r?.width ?? -1),
		inView: !!r && r.x < window.innerWidth - 8,
		flashed,
	};
});
await page.screenshot({ path: "evals/ux/bs-desktop-open.png" });
await page.keyboard.press("Escape");
await page.waitForTimeout(450);
await page.screenshot({ path: "evals/ux/bs-desktop-closed.png" });
console.log(`RESULT ${JSON.stringify({ linkSeen, ...open })}`);
await browser.close();
