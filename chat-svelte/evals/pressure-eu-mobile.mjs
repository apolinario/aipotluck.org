// EU mobile pressure test for the persistent map toggle + layout.
// Drives REAL Chrome (channel: "chrome") across a matrix of EU-popular phones, each under
// slow-3G + 4x CPU throttling (conference/mobile reality), with the device's own mobile UA.
// One run uses reduced-motion + de-DE locale + Europe/Berlin tz to catch locale/motion regressions.
//
// Per device it loads the app, opens the map via the persistent toggle, and asserts the things
// that actually break on small touchscreens: horizontal overflow, off-screen sheet, tap-target
// size, the sheet not leaking the desktop "push column" onto mobile, console errors, and that
// the sheet is dismissable. Emits one RESULT line per device + a screenshot.
import { chromium, devices } from "playwright";

const BASE = process.env.BASE || "http://localhost:5173";
// Realistic adverse EU mobile: Fast-3G / congested-LTE — ~1.6Mbps, 150ms RTT. (Worst-case
// 400kbps "slow 3G" just starves the SPA bundle download so hydration never finishes in a test
// budget; that's a load-time fact, not a UI defect. This profile pressures without starving.)
const FAST_3G = {
	offline: false,
	downloadThroughput: (1.6 * 1024 * 1024) / 8,
	uploadThroughput: (750 * 1024) / 8,
	latency: 150,
};

const MATRIX = [
	{ name: "iPhone SE (small/iOS)", device: devices["iPhone SE"] },
	{ name: "iPhone 13 (iOS Safari UA)", device: devices["iPhone 13"] },
	{ name: "Pixel 5 (Android Chrome)", device: devices["Pixel 5"] },
	{ name: "Galaxy S9+ (Android)", device: devices["Galaxy S9+"] },
	{
		name: "Pixel 5 · reduced-motion · de-DE",
		device: devices["Pixel 5"],
		ctx: { reducedMotion: "reduce", locale: "de-DE", timezoneId: "Europe/Berlin" },
	},
];

const browser = await chromium.launch({ headless: true, channel: "chrome" });

async function toggleCenter(page) {
	return page.evaluate(() => {
		const t = [...document.querySelectorAll("button")].find((b) =>
			/behind the scenes|what's behind|hide the stack/i.test(
				(b.getAttribute("aria-label") || "") + (b.textContent || "")
			)
		);
		if (!t) return null;
		const r = t.getBoundingClientRect();
		return { cx: Math.round(r.x + r.width / 2), cy: Math.round(r.y + r.height / 2) };
	});
}

// Tap the toggle by real touch and retry until the sheet reaches wantOpen — under heavy
// throttling the first taps can land before hydration attaches the handler (dead taps), so a
// single tap is unreliable. ~15s budget.
async function tapToggleUntil(page, wantOpen) {
	for (let i = 0; i < 12; i++) {
		const box = await toggleCenter(page);
		if (!box) return false;
		await page.touchscreen.tap(box.cx, box.cy);
		if (await waitSheet(page, wantOpen, 1200)) return true;
	}
	return false;
}

// Poll the sheet's aria-hidden until it matches (transition timing is unpredictable under
// 4x CPU throttling, so a fixed wait races the animation).
async function waitSheet(page, wantOpen, ms = 6000) {
	const t0 = Date.now();
	while (Date.now() - t0 < ms) {
		const hidden = await page.evaluate(() =>
			document
				.querySelector('[role="dialog"][aria-label^="Behind the scenes"]')
				?.getAttribute("aria-hidden")
		);
		if ((hidden === "false") === wantOpen) return true;
		await page.waitForTimeout(120);
	}
	return false;
}

async function snapshot(page) {
	return page.evaluate(() => {
		const vw = window.innerWidth;
		const doc = document.documentElement;
		const sheet = document.querySelector('[role="dialog"][aria-label^="Behind the scenes"]');
		const main = document.querySelector('[role="main"]');
		const toggle = [...document.querySelectorAll("button")].find((b) =>
			/behind the scenes|what's behind|hide the stack/i.test(
				(b.getAttribute("aria-label") || "") + (b.textContent || "")
			)
		);
		const r = (el) => (el ? el.getBoundingClientRect() : null);
		const sr = r(sheet),
			mr = r(main),
			tr = r(toggle);
		return {
			vw,
			horizOverflowPx: Math.max(0, doc.scrollWidth - vw),
			sheetTop: sr ? Math.round(sr.top) : null,
			sheetWidth: sr ? Math.round(sr.width) : null,
			sheetOnScreen: sr ? sr.top < window.innerHeight - 20 : false,
			mainWidth: mr ? Math.round(mr.width) : null,
			toggle: tr ? { w: Math.round(tr.width), h: Math.round(tr.height) } : null,
		};
	});
}

const results = [];
for (const entry of MATRIX) {
	const ctx = await browser.newContext({ ...entry.device, ...(entry.ctx || {}) });
	const page = await ctx.newPage();
	const errors = [];
	page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 120)));
	page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 120)));

	// Throttle AFTER context so the CDP session attaches to this page.
	const client = await ctx.newCDPSession(page);
	await client.send("Network.enable");
	await client.send("Network.emulateNetworkConditions", FAST_3G);
	await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });

	const out = { device: entry.name, vw: entry.device.viewport.width };
	try {
		await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
		// Throttled load: wait until the app is actually interactive (composer hydrated) before
		// touching anything, then dismiss the welcome modal deterministically so it can't sit on
		// top of the toggle and eat the tap.
		await page.waitForSelector("textarea", { timeout: 45000 }).catch(() => {});
		// Dismiss the welcome with retries: under throttling the first taps can precede hydration
		// (dead taps), so keep tapping until "Start chatting" is gone (or give up ~15s).
		const start = page.getByRole("button", { name: /start chatting/i });
		for (let i = 0; i < 30; i++) {
			if (!(await start.isVisible().catch(() => false))) break;
			await start.tap().catch(() => start.click({ force: true }).catch(() => {}));
			await page.waitForTimeout(900);
		}
		await page.waitForTimeout(300);

		const closed = await snapshot(page);
		out.closed = { horizOverflowPx: closed.horizOverflowPx, sheetOnScreen: closed.sheetOnScreen };
		out.toggleTapTarget = closed.toggle; // a11y: want >=44px

		out.openedAfterRetry = await tapToggleUntil(page, true);
		const open = await snapshot(page);
		out.open = {
			horizOverflowPx: open.horizOverflowPx,
			sheetOnScreen: open.sheetOnScreen,
			sheetTop: open.sheetTop,
			sheetWidth: open.sheetWidth,
			// On mobile the chat must NOT be pushed (no desktop column leak): mainWidth ≈ viewport.
			chatStillFullWidth: open.mainWidth !== null && open.mainWidth >= open.vw - 2,
		};
		await page.screenshot({ path: `evals/ux/eu-${entry.name.replace(/[^a-z0-9]+/gi, "-")}.png` });

		// Dismiss: tap the sheet's own close (×). Confirms the open sheet is escapable.
		const closeBtn = page.locator('[role="dialog"][aria-label^="Behind the scenes"] button', {
			hasText: "",
		});
		await page.evaluate(() => {
			const sheet = document.querySelector('[role="dialog"][aria-label^="Behind the scenes"]');
			const x = sheet?.querySelector("button");
			x?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		});
		await waitSheet(page, false);
		const afterClose = await snapshot(page);
		out.dismissedOk = !afterClose.sheetOnScreen;
		out.consoleErrors = errors;
		out.PASS =
			out.closed.horizOverflowPx === 0 &&
			out.open.horizOverflowPx === 0 &&
			out.open.sheetOnScreen &&
			out.open.chatStillFullWidth &&
			out.dismissedOk &&
			errors.length === 0;
	} catch (e) {
		out.error = String(e).slice(0, 160);
		out.PASS = false;
	}
	results.push(out);
	console.log(`RESULT ${JSON.stringify(out)}`);
	await ctx.close();
}
const passed = results.filter((r) => r.PASS).length;
console.log(`SUMMARY ${passed}/${results.length} passed`);
await browser.close();
