// Dev-only mobile-viewport screenshot harness.
//
// Why this exists: most Gap Chat users arrive from a QR code at the end of a
// talk, on a wide variety of (often small, often EU) phones we don't have on
// hand. The claude-in-chrome extension can't shrink its window below the md
// breakpoint here because the Wayland WM ignores resize requests — so we drive
// a Playwright-controlled browser instead, which sets an EXPLICIT viewport
// inside its own context, independent of the window manager.
//
// Playwright is already a devDependency; this uses the system Chrome
// (channel: "chrome") so there's no ~150MB browser download.
//
// Usage:
//   node scripts/mobile-shots.mjs                 # default device matrix
//   BASE=http://localhost:5173 node scripts/mobile-shots.mjs
//   CHANNEL=chromium node scripts/mobile-shots.mjs
//   SEARCH=1 node scripts/mobile-shots.mjs         # also drive the web-search flow
// Output: gitignored .shots/*.png
//
// With SEARCH=1 a second pass drives the open-web search UX end to end on a
// couple of representative phones: type a recency query, toggle the composer
// globe, send, and capture the grounded answer + citations strip (and the
// "Under the hood" map with the Web-search node lit). Needs the dev server
// reachable AND its HF token configured, since it streams a real turn.

import { chromium, devices } from "playwright";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = process.env.BASE ?? "http://localhost:5173";
const CHANNEL = process.env.CHANNEL ?? "chrome";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", ".shots");

// Device matrix — small/odd sizes are deliberate (the EU-phone, QR-code
// audience). `descriptor` pulls Playwright's built-in device emulation
// (touch + UA + DPR); `viewport` entries are explicit custom sizes.
const MATRIX = [
	{ name: "android-360x640", viewport: { width: 360, height: 640 }, mobile: true },
	{ name: "iphone-se", descriptor: "iPhone SE", mobile: true },
	{ name: "iphone-12", descriptor: "iPhone 12", mobile: true },
	{ name: "pixel-7", descriptor: "Pixel 7", mobile: true },
	{ name: "galaxy-s9", descriptor: "Galaxy S9+", mobile: true },
	{ name: "ipad-mini", descriptor: "iPad Mini", mobile: false },
	{ name: "desktop-1440", viewport: { width: 1440, height: 900 }, mobile: false },
];

async function shoot(browser, spec) {
	const ctxOpts = spec.descriptor ? { ...devices[spec.descriptor] } : { viewport: spec.viewport };
	const context = await browser.newContext(ctxOpts);
	const page = await context.newPage();
	try {
		await page.goto(BASE, { waitUntil: "networkidle", timeout: 20000 });
		// Fresh (cookieless) contexts get chat-ui's first-visit welcome modal, which
		// covers the UI — exactly what a QR-code first-timer sees. Capture it first
		// (it's the literal first impression), then dismiss it so the later shots
		// show the actual chat + map. (Match a couple of likely labels.)
		if (await page.getByRole("button", { name: "Start chatting" }).count()) {
			await page.screenshot({ path: join(OUT, `${spec.name}-welcome.png`), fullPage: false });
		}
		for (const label of ["Start chatting", "Get started", "Continue"]) {
			const btn = page.getByRole("button", { name: label });
			if (await btn.count()) {
				await btn
					.first()
					.click()
					.catch(() => {});
				break;
			}
		}
		// The map fetches /data/stack-map.json after mount; wait for a node to paint.
		await page.waitForSelector('[data-node-id="apertus"]', { timeout: 8000 }).catch(() => {});
		await page.screenshot({ path: join(OUT, `${spec.name}.png`), fullPage: false });

		// On phones the map is one tap away — capture the "Under the hood" tab too.
		if (spec.mobile) {
			const tab = page.getByRole("button", { name: "Under the hood" });
			if (await tab.count()) {
				await tab.first().click();
				await page.waitForTimeout(300);
				await page.screenshot({ path: join(OUT, `${spec.name}-map.png`), fullPage: false });
			}
		}
		console.log(`✓ ${spec.name}`);
	} catch (err) {
		console.log(`✗ ${spec.name}: ${err.message}`);
	} finally {
		await context.close();
	}
}

// ── Web-search flow (opt-in via SEARCH=1) ────────────────────────────────────
// A couple of representative phones, run through the full grounded turn.
const SEARCH_DEVICES = [
	{ name: "iphone-12", descriptor: "iPhone 12", mobile: true },
	{ name: "pixel-7", descriptor: "Pixel 7", mobile: true },
	{ name: "android-360x640", viewport: { width: 360, height: 640 }, mobile: true },
];

async function dismissWelcome(page) {
	// The first-visit modal overlays the whole UI and intercepts pointer events,
	// so it must be GONE before we touch the composer — not merely clicked. Click
	// the dismiss button and wait for it to detach; retry a couple of times since
	// the overlay animates out.
	for (let attempt = 0; attempt < 3; attempt++) {
		let clicked = false;
		for (const label of ["Start chatting", "Get started", "Continue"]) {
			const btn = page.getByRole("button", { name: label });
			if (await btn.count()) {
				await btn
					.first()
					.click()
					.catch(() => {});
				await btn
					.first()
					.waitFor({ state: "detached", timeout: 3000 })
					.catch(() => {});
				clicked = true;
				break;
			}
		}
		if (!clicked) return; // no modal present
		const stillUp = await page
			.getByRole("button", { name: "Start chatting" })
			.count()
			.catch(() => 0);
		if (!stillUp) return;
	}
}

async function shootSearch(browser, spec) {
	const ctxOpts = spec.descriptor ? { ...devices[spec.descriptor] } : { viewport: spec.viewport };
	const context = await browser.newContext(ctxOpts);
	const page = await context.newPage();
	try {
		await page.goto(BASE, { waitUntil: "networkidle", timeout: 20000 });
		await dismissWelcome(page);
		// Gate on the page being interactive (map node painted ⇒ modal gone).
		await page.waitForSelector('[data-node-id="apertus"]', { timeout: 8000 }).catch(() => {});

		const box = page.getByPlaceholder("Ask anything");
		await box.waitFor({ timeout: 8000 });
		await box.click();
		await box.fill("What is the latest stable version of the Linux kernel?");

		// Toggle the open-web search globe. Its accessible name is the aria-label
		// ("Search open sources for current info"), not the visible "Open search".
		const globe = page.getByRole("button", { name: /search open sources/i });
		await globe.first().click();
		await page.waitForTimeout(150);
		await page.screenshot({ path: join(OUT, `${spec.name}-search-composer.png`), fullPage: false });

		// Send via the explicit button — emulated-touch contexts suppress the
		// Enter-to-send path (virtual-keyboard guard).
		await page.getByRole("button", { name: "Send message" }).first().click();

		// The citations strip appears as soon as the turn is created (client stamps
		// webSearch before the answer streams); then let the answer stream a little.
		await page
			.getByText(/open source/i)
			.first()
			.waitFor({ timeout: 15000 });
		await page.waitForTimeout(9000);
		await page.screenshot({ path: join(OUT, `${spec.name}-search-answer.png`), fullPage: false });

		// Expand the strip to show the numbered sources on a narrow viewport.
		await page
			.getByText(/open source/i)
			.first()
			.click()
			.catch(() => {});
		await page.waitForTimeout(250);
		await page.screenshot({ path: join(OUT, `${spec.name}-search-sources.png`), fullPage: false });

		// "Under the hood" should now light the Web-search node for this turn.
		if (spec.mobile) {
			const tab = page.getByRole("button", { name: "Under the hood" });
			if (await tab.count()) {
				await tab.first().click();
				await page.waitForTimeout(400);
				await page.screenshot({ path: join(OUT, `${spec.name}-search-map.png`), fullPage: false });
			}
		}
		console.log(`✓ ${spec.name} (search)`);
	} catch (err) {
		console.log(`✗ ${spec.name} (search): ${err.message.split("\n")[0]}`);
		await page
			.screenshot({ path: join(OUT, `${spec.name}-search-FAIL.png`), fullPage: false })
			.catch(() => {});
	} finally {
		await context.close();
	}
}

const browser = await chromium.launch({ channel: CHANNEL }).catch(() => chromium.launch());
await mkdir(OUT, { recursive: true });
console.log(`base=${BASE} channel=${CHANNEL} → ${OUT}`);
// SEARCH_ONLY skips the (slow) base matrix so the streaming search pass fits a
// shorter timeout when iterating on just the web-search UX.
if (!process.env.SEARCH_ONLY) for (const spec of MATRIX) await shoot(browser, spec);
if (process.env.SEARCH || process.env.SEARCH_ONLY) {
	console.log("— web-search flow —");
	const only = process.env.SEARCH_DEVICE;
	for (const spec of SEARCH_DEVICES) {
		if (only && spec.name !== only) continue;
		await shootSearch(browser, spec);
	}
}
await browser.close();
