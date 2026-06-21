// Verify the optimistic-send fix: after submitting from the home screen, the user's message
// must appear ~immediately and PERSIST (not vanish), with a calm search status on the pending
// answer — instead of the old multi-second gap where nothing showed while classify+search ran.
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:5173";
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1100, height: 950 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
const start = page.getByRole("button", { name: /start chatting/i });
if (await start.isVisible().catch(() => false)) { await start.click(); await page.waitForTimeout(300); }

// A recency query → margin strategy runs the classify+search round-trip (the slow path).
const Q = "what are the latest AI regulations in the EU this year";
await page.evaluate(() => document.querySelector("textarea")?.focus());
await page.keyboard.type(Q, { delay: 2 });
const t0 = Date.now();
await page.keyboard.press("Enter");

let userMsgAt = null, assistantAt = null, searchStatusAt = null, searchStatusText = null;
let userMsgEverDisappeared = false, sawUser = false;
for (let i = 0; i < 120; i++) {
	await page.waitForTimeout(100);
	const s = await page.evaluate(() => {
		const users = [...document.querySelectorAll('[data-message-type="user"]')];
		const asst = [...document.querySelectorAll('[data-message-role="assistant"]')];
		const userText = users.map((u) => u.innerText).join(" ");
		// searchStatus renders as the calm mono line on the pending answer.
		const statusEl = [...document.querySelectorAll("span")].find((el) =>
			/Checking whether this needs current info|Searching the open web/.test(el.textContent || "")
		);
		return {
			nUser: users.length,
			nAsst: asst.length,
			hasQ: userText.includes("latest AI regulations"),
			statusText: statusEl ? statusEl.textContent.trim() : null,
			lastAsstLen: (asst.at(-1)?.innerText || "").length,
		};
	});
	const t = Date.now() - t0;
	if (s.hasQ && userMsgAt === null) { userMsgAt = t; sawUser = true; }
	if (sawUser && !s.hasQ) userMsgEverDisappeared = true; // appeared then vanished = the bug
	if (s.nAsst > 0 && assistantAt === null) assistantAt = t;
	if (s.statusText && searchStatusAt === null) { searchStatusAt = t; searchStatusText = s.statusText; }
	// Stop once a real answer is streaming (we've seen what we need).
	if (s.lastAsstLen > 40) break;
}
console.log(`RESULT ${JSON.stringify({
	userMsgAppearedMs: userMsgAt,
	assistantBubbleMs: assistantAt,
	searchStatusMs: searchStatusAt,
	searchStatusText,
	userMsgEverDisappeared,
})}`);
await browser.close();
