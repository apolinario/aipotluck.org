// One-off mobile a11y/layout audit at a real phone viewport (Playwright sets the viewport
// reliably; the desktop window manager here ignores programmatic resize). Hits the running dev
// server, checks for horizontal overflow, the chat/map tab switcher, and sub-24px tap targets,
// and saves screenshots to /tmp. Run: node scripts/mobile-audit.mjs
import { chromium, devices } from "playwright";

const BASE = process.env.BASE || "http://localhost:5173";
const CONV = process.env.CONV || "/conversation/6a334289c10bd33f9ffe3e0a";
const iphone = devices["iPhone 13"];

// Playwright's bundled chromium doesn't ship for this OS; use the system Google Chrome.
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ ...iphone });
const page = await ctx.newPage();
const findings = [];

async function audit(url, name, { tapBtn } = {}) {
	await page.goto(BASE + url, { waitUntil: "networkidle" }).catch(() => {});
	await page.waitForTimeout(1200);
	if (tapBtn) {
		await page
			.getByRole("button", { name: tapBtn })
			.first()
			.click()
			.catch(() => {});
		await page.waitForTimeout(600);
	}
	const data = await page.evaluate(() => {
		const innerW = window.innerWidth;
		const docW = document.documentElement.scrollWidth;
		const tabs = [...document.querySelectorAll("button")]
			.map((b) => (b.textContent || "").trim())
			.filter((t) => /^(Chat|Under the hood|Open chat|Map)$/i.test(t));
		const small = [...document.querySelectorAll("button,a")]
			.map((el) => {
				const r = el.getBoundingClientRect();
				return {
					t: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 18),
					w: Math.round(r.width),
					h: Math.round(r.height),
				};
			})
			.filter((x) => x.w > 0 && x.h > 0 && (x.w < 24 || x.h < 24));
		return {
			innerW,
			docW,
			hScroll: docW > innerW + 1,
			tabs,
			smallCount: small.length,
			small: small.slice(0, 10),
		};
	});
	await page.screenshot({ path: `/tmp/mobile-${name}.png` });
	findings.push({ name, url: url + (tapBtn ? ` [tap:${tapBtn}]` : ""), ...data });
}

await audit("/", "landing");
await audit(CONV, "conversation");
await audit(CONV, "conversation-maptab", { tapBtn: /under the hood|map/i });

console.log(JSON.stringify(findings, null, 2));
await browser.close();
