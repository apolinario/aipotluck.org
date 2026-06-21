// Hardening — demo choreography pass (Apertus-70B). Clicks each of the 3 launch starter chips and
// verifies the doc-promised beat (§1.3): Geneva→governance/no-gap, Rwanda→honest-limits/no-gap,
// EU-AI-Act→search + gap CTA ("Touches an open gap" + see-the-gap/get-involved → websearch node).
// Incremental NDJSON. Run: node evals/choreography-probe.mjs  (dev :5176)
import { chromium } from "playwright";
const BASE = process.env.PROBE_BASE || "http://localhost:5176";
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });

const CHIPS = [
	{ id: "geneva-governance", name: /humanitarian policy in Geneva/i, wantSearch: null, wantGap: false, expect: /governance|framework|regulat|public institution/i },
	{ id: "rwanda-honest-limits", name: /farmer in Rwanda/i, wantSearch: null, wantGap: false, expect: /limit|can't|cannot|not able|don't have|general|verif|up to date|real-time/i },
	{ id: "eu-ai-act-search", name: /EU AI Act/i, wantSearch: true, wantGap: true, expect: /EU AI Act|regulation|2024|implementation/i },
];

const log = (o) => console.log("RESULT " + JSON.stringify(o));
for (const chip of CHIPS) {
	const page = await ctx.newPage();
	await page.goto(BASE, { waitUntil: "domcontentloaded" });
	await page.waitForTimeout(800); // let the welcome modal mount before dismissing
	const start = page.getByRole("button", { name: /start chatting/i });
	if (await start.isVisible().catch(() => false)) await start.click();
	await page.locator('[role="dialog"][aria-label="Welcome to AI Potluck"]')
		.waitFor({ state: "hidden", timeout: 6000 }).catch(() => {});
	// click the starter chip (button whose text contains the distinctive phrase)
	const btn = page.getByRole("button", { name: chip.name }).first();
	await btn.waitFor({ state: "visible", timeout: 10000 });
	await btn.click();
	// wait for the answer to stream + settle
	let last = -1, stable = 0, errored = false, txt = "";
	for (let i = 0; i < 55; i++) {
		await page.waitForTimeout(1000);
		errored = await page.evaluate(() => /an error occurred/i.test(document.body.innerText));
		if (errored) break;
		const s = await page.evaluate(() => {
			const a = [...document.querySelectorAll('[data-message-role="assistant"]')];
			return { n: a.length, t: (()=>{let s="";for(const b of a){const p=[...b.querySelectorAll(".prose")].map((x)=>x.innerText).join("\n").trim();if(p)s=p;}return s;})() };
		});
		if (s.n < 1) continue;
		txt = s.t;
		if (txt.length === last && txt.length > 0) { if (++stable >= 2) break; } else { stable = 0; last = txt.length; }
	}
	const searched = await page.evaluate(() => /looked it up/i.test(document.body.innerText));
	const gapCta = await page.evaluate(() => /touches an open gap/i.test(document.body.innerText));
	const getInvolved = await page.evaluate(() => /get involved/i.test(document.body.innerText));
	const beatOk = chip.expect.test(txt);
	const pass = !errored && beatOk &&
		(chip.wantSearch === null || searched === chip.wantSearch) &&
		gapCta === chip.wantGap;
	log({ id: chip.id, pass, errored, searched, gapCta, getInvolved, beatOk, answer: txt.slice(0, 180) });
	await page.close();
}
await browser.close();
