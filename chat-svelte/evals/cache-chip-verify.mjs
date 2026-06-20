// Verifier for the conference-wifi cache-honesty CHIP (CacheNotice). Reuses the
// request-never-arrives stall from wifi-resync-repro.mjs: hold the conversation POST
// so the time-to-first-token watchdog fires and falls back to the warm 70B starter
// cache, setting message.servedFromCache. Then assert the HONESTY INVARIANT in the
// rendered DOM:
//   1) the CacheNotice chip is present ("Saved answer — your connection dropped…")
//   2) the live ProvenanceTrace is SUPPRESSED (no "How this answer was made") — a
//      cache turn must NOT claim the live pipeline ran
//   3) the cached answer text actually rendered (the fallback worked)
//   4) a "get a live answer →" retry affordance is offered
// Screenshot saved for an eyeball. Run: node evals/cache-chip-verify.mjs  (dev :5176)
import { chromium } from "playwright";

const BASE = "http://localhost:5176";
const CACHED_PROMPT =
	"I need the current status of the EU AI Act for a policy briefing next week. How do you find that?";
const CACHED_NEEDLE = "entered into force on 1 August 2024";
const CHIP_NEEDLE = "Saved answer";
const TRACE_NEEDLE = "How this answer was made";
const RETRY_NEEDLE = "get a live answer";
const GEN_POST = /\/conversation\/[0-9a-fA-F-]{16,}(\?|$)/i;

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

// Hold EVERY conversation POST (not just the first): W3's connect-retry re-POSTs after a
// ~3.5s connect-timeout, so a single stall would let the retry escape to the server. Holding
// all of them reproduces the true "request never reaches server" regime — every attempt hangs
// until the 8s time-to-first-token watchdog aborts and applyEarlyStreamFailure serves cache.
let stalled = false;
await page.route(GEN_POST, async (route) => {
	if (route.request().method() === "POST") {
		stalled = true;
		return; // hold forever
	}
	return route.continue();
});

await page.goto(BASE, { waitUntil: "domcontentloaded" });
// Dismiss the WelcomeModal splash so the composer underneath is the live chat input.
const startBtn = page.getByRole("button", { name: /start chatting/i });
if (await startBtn.isVisible().catch(() => false)) {
	await startBtn.click();
	await page.waitForTimeout(400);
}
await page.locator("textarea").first().waitFor({ state: "visible", timeout: 15000 });
await page.evaluate(() => document.querySelector("textarea")?.focus());
await page.keyboard.type(CACHED_PROMPT, { delay: 6 });
await page.waitForTimeout(150);
await page.keyboard.press("Enter");

await page.waitForTimeout(16000); // past 8s watchdog + cache paint + any reconcile

const body = await page.evaluate(() => (document.body.innerText || "").replace(/\s+/g, " ").trim());
await page.screenshot({ path: "evals/cache-chip.png", fullPage: true });

const chipPresent = body.includes(CHIP_NEEDLE);
const tracePresent = body.includes(TRACE_NEEDLE);
const cacheAnswerPresent = body.includes(CACHED_NEEDLE);
const retryPresent = body.includes(RETRY_NEEDLE);

const result = {
	stalled,
	chipPresent,
	traceSuppressed: !tracePresent,
	cacheAnswerPresent,
	retryPresent,
	verdict:
		stalled && chipPresent && !tracePresent && cacheAnswerPresent && retryPresent ? "PASS" : "FAIL",
};
console.log(JSON.stringify(result, null, 2));
await browser.close();
