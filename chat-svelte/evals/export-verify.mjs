// Verify the conversation Export button: renders after a turn, click downloads a
// well-formed Markdown file (frontmatter + ## You / ## Assistant, no system prompt).
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:5174";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ acceptDownloads: true });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: "domcontentloaded" });

// send a quick message (real inference); JS-focus + keyboard.type (the reliable path)
await page.locator("textarea").first().waitFor({ state: "attached", timeout: 15000 });
await page.evaluate(() => document.querySelector("textarea")?.focus());
await page.keyboard.type("Reply with exactly: hello world", { delay: 8 });
await page.waitForTimeout(150);
await page.keyboard.press("Enter");

let answered = false;
for (let i = 0; i < 40; i++) {
	await page.waitForTimeout(1000);
	const t = await page.evaluate(() => document.body.innerText);
	if (/hello/i.test(t) && t.length > 60) {
		answered = true;
		break;
	}
}

const exportBtn = page.getByRole("button", { name: /^export$/i });
const exportButtonVisible = await exportBtn.isVisible().catch(() => false);

let download = null;
if (exportButtonVisible) {
	const [dl] = await Promise.all([
		page.waitForEvent("download", { timeout: 8000 }).catch(() => null),
		exportBtn.click(),
	]);
	download = dl;
}

let head = null;
let leaksPersona = null;
if (download) {
	const p = await download.path();
	const md = readFileSync(p, "utf8");
	head = md.split("\n").slice(0, 14).join("\n");
	// the export must NEVER contain the system prompt — sanity check for a known persona word
	leaksPersona = /you are a machine|persona|system prompt/i.test(md);
}

console.log(
	JSON.stringify(
		{
			answered,
			exportButtonVisible,
			downloadTriggered: !!download,
			filename: download ? download.suggestedFilename() : null,
			leaksPersona,
			head,
		},
		null,
		2
	)
);
await browser.close();
