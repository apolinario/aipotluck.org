// Verifier for the request-lost-before-egress wifi tail fix. Corrects the
// main.innerText selector bug in evals/wifi-resync-verify.mjs (messages render
// OUTSIDE <main>, so that selector always reads empty). Uses body.innerText +
// rendered message-bubble count, which is what actually reflects the panel.
//
//   A) request-never-arrives stall -> watchdog fires -> cache answer must PERSIST
//      (user prompt + answer needle visible, 2 bubbles, no empty-conversation wipe).
//   B) happy path regression -> a normal live stream still answers.
//
// Run: node evals/wifi-resync-repro.mjs   (dev server up on :5173)
import { chromium } from "playwright";

const BASE = "http://localhost:5173";
const CACHED_PROMPT =
	"I need the current status of the EU AI Act for a policy briefing next week. How do you find that?";
const CACHED_NEEDLE = "entered into force on 1 August 2024";
const USER_NEEDLE = "status of the EU AI Act for a policy briefing";
const GEN_POST = /\/conversation\/[0-9a-fA-F-]{16,}(\?|$)/i;

const browser = await chromium.launch({ headless: true, channel: "chrome" });

async function submit(page, text) {
	await page.locator("textarea").first().waitFor({ state: "attached", timeout: 15000 });
	await page.evaluate(() => document.querySelector("textarea")?.focus());
	await page.keyboard.type(text, { delay: 6 });
	await page.waitForTimeout(150);
	await page.keyboard.press("Enter");
}

const probe = (page) =>
	page.evaluate(() => ({
		body: (document.body.innerText || "").replace(/\s+/g, " ").trim(),
		bubbles: document.querySelectorAll('[class*="prose"]').length,
		roles: document.querySelectorAll("[data-message-role],[data-message-id]").length,
	}));

const results = {};

// ---- A: stall (request never reaches server) -> cache answer must persist ----
{
	const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
	const page = await ctx.newPage();
	const pollerLogs = [];
	page.on("console", (m) => {
		if (m.text().includes("[BackgroundGenerationPoller]")) pollerLogs.push(m.text().slice(0, 90));
	});
	let stalled = false;
	await page.route(GEN_POST, async (route) => {
		if (route.request().method() === "POST" && !stalled) {
			stalled = true;
			return; // hold forever
		}
		return route.continue();
	});
	await page.goto(BASE, { waitUntil: "domcontentloaded" });
	await submit(page, CACHED_PROMPT);
	await page.waitForTimeout(16000); // past 8s watchdog + cache paint + any reconcile
	const p = await probe(page);
	results.A_stall_cachePersists = {
		stalled,
		userPromptVisible: p.body.includes(USER_NEEDLE),
		cacheAnswerVisible: p.body.includes(CACHED_NEEDLE),
		bubbleCount: p.bubbles,
		messageRoles: p.roles,
		pollerFired: pollerLogs.length > 0,
		pollerLogs,
		verdict:
			stalled && p.body.includes(USER_NEEDLE) && p.body.includes(CACHED_NEEDLE) && p.roles >= 2
				? "PASS"
				: "FAIL",
	};
	await ctx.close();
}

// ---- B: happy path (no stall) -> live stream still answers ----
{
	const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
	const page = await ctx.newPage();
	await page.goto(BASE, { waitUntil: "domcontentloaded" });
	await submit(page, "What is the capital of Switzerland? Answer in one short sentence.");
	let body = "";
	for (let i = 0; i < 40; i++) {
		await page.waitForTimeout(1000);
		body = (await page.evaluate(() => document.body.innerText)) || "";
		if (/bern/i.test(body)) break;
	}
	results.B_happyPath = {
		answerMentionsBern: /bern/i.test(body),
		verdict: /bern/i.test(body) ? "PASS" : "FAIL",
	};
	await ctx.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
