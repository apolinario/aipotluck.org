// High-DPI capture of the revealed map for a nitpicky design pass. @2x device scale.
// Desktop: tight crop of the drawer. Mobile: the sheet. Also one node expanded.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const BASE = process.env.BASE || "http://localhost:5180";
mkdirSync("evals/ux", { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });

async function openMap(page) {
	const s = page.getByRole("button", { name: /start chatting/i });
	if (await s.isVisible().catch(() => false)) {
		await s.click();
		await page.waitForTimeout(400);
	}
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
	await page.waitForTimeout(400);
	const head = page.getByRole("button", { name: /how this answer was made/i }).last();
	await head.click().catch(() => {});
	await page.waitForTimeout(250);
	const link = page.getByRole("button", { name: /behind the scenes/i }).last();
	await link.click().catch(() => {});
	await page.waitForTimeout(700);
}

// Desktop @2x — tight crop of the drawer.
const d = await browser.newContext({
	viewport: { width: 1366, height: 900 },
	deviceScaleFactor: 2,
});
let page = await d.newPage();
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
await openMap(page);
const box = await page.evaluate(() => {
	const el = document.querySelector('[role="dialog"][aria-label*="Behind the scenes"]');
	const r = el.getBoundingClientRect();
	return { x: r.x, y: r.y, width: r.width, height: r.height };
});
await page.screenshot({ path: "evals/ux/map-desktop-2x.png", clip: box });
// Expand the model node for the detail-view typography.
await page.getByText("Apertus 70B").first().click().catch(() => {});
await page.waitForTimeout(400);
await page.screenshot({ path: "evals/ux/map-desktop-expanded-2x.png", clip: box });
await page.close();

// Mobile @2x.
const m = await browser.newContext({
	viewport: { width: 390, height: 844 },
	deviceScaleFactor: 2,
	isMobile: true,
});
page = await m.newPage();
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
await openMap(page);
await page.screenshot({ path: "evals/ux/map-mobile-2x.png" });
await page.close();

await browser.close();
console.log("RESULT captured");
