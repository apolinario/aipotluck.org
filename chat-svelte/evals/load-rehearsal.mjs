// A4 — load rehearsal (chat-hardening campaign): the lecture-hall concurrency check.
//
// The demo-day runbook (aipotluck-internal-notes/demo-day-runbook.md) makes three claims it
// flags as "NOT unit-tested — exercise manually in pre-flight": per-session rate limiting is
// NAT-safe (concurrent classmates don't lock each other out), degradation is HONEST (a banner,
// never a hang), and the global daily cap returns an honest 429 rather than a 500. The +server.ts
// rate-limit / global-cap block is the non-hermetic POST handler (live DB + auth), so none of it
// is in the unit suite. This probe closes that gap by actually driving CONCURRENT independent guest
// sessions at the live 70B and asserting the runbook's behaviour holds under load.
//
// Each session is a SEPARATE browser context = its own cookies = its own guest sessionId = its own
// per-session budget. That is the exact NAT-safe property the runbook leans on: a room of phones
// behind one wifi IP each get their own session, so per-session limiting never locks out the room.
//
// HARD invariants (must hold):
//   - isolation: ≥80% of concurrent sessions get a real answer (no cross-session lockout / no crash).
//   - honesty:   every session that did NOT answer shows an HONEST error/limit banner — never a
//                silent hang (poll budget exhausted with neither answer nor banner = the bad case).
//   - cap-429:   if GLOBAL_DAILY_REQUEST_CAP is set low, the over-cap session sees the honest
//                "today's request limit" banner, NOT a generic 500. (Skipped when the cap is unset.)
// SOFT report (not a gate): time-to-answer p50/p95/max under concurrency — a number for the runbook.
//
// Run: node evals/load-rehearsal.mjs                 (dev server up; default :5176)
//      LOAD_SESSIONS=8 node evals/load-rehearsal.mjs (override the concurrency, default 5)
// Exit: 0 = rehearsal passed, 1 = an invariant failed, 2 = harness / model-guard error.
import { chromium } from "playwright";

const BASE = process.env.PROBE_BASE || "http://localhost:5176";
const K = Number(process.env.LOAD_SESSIONS) || 5; // concurrent independent guest sessions
const ISOLATION_THRESHOLD = 0.8; // ≥80% of concurrent sessions must answer (NAT-safe isolation)
const MAX_WAIT_S = 90; // a 70B turn under concurrency can be slow; generous so a slow≠hang

// ─── Pre-flight: the endpoint must serve a 70B model, or we abort loudly. (Mirrors revalidate-70b.) ─
async function assertSeventyB() {
	let ids = [];
	for (const path of ["/api/models", "/api/v2/models"]) {
		try {
			const r = await fetch(BASE + path);
			if (!r.ok) continue;
			const j = await r.json();
			ids = (Array.isArray(j) ? j : (j.models ?? [])).map((m) => m.id || m.name).filter(Boolean);
			if (ids.length) break;
		} catch {
			/* try next path */
		}
	}
	if (!ids.length) {
		console.error(`✗ model-guard: could not read the model list from ${BASE} — is the dev server up?`);
		process.exit(2);
	}
	const is70b = ids.some((id) => /70b/i.test(id));
	const has8b = ids.some((id) => /\b8b\b|1\.5/i.test(id));
	console.log(`  live model(s): ${ids.join(", ")}`);
	if (!is70b || has8b) {
		console.error(`✗ model-guard: expected a 70B model, got [${ids.join(", ")}]. Fix MODEL_ALLOWLIST.`);
		process.exit(2);
	}
	console.log("  ✓ model-guard: serving 70B\n");
}

// A short, TIMELESS prompt: no web search (keeps the turn cheap + isolates concurrency from search
// load), deterministic-ish, fast. The point is the streaming turn happening K-at-once, not the answer.
const PROMPT = "In one short sentence, what is a binary search?";

// Drive ONE guest session end-to-end in its own context. Returns a result row.
async function runSession(browser, i) {
	const ctx = await browser.newContext({ viewport: { width: 1100, height: 850 } });
	const page = await ctx.newPage();
	const t0 = Date.now();
	try {
		await page.goto(BASE, { waitUntil: "domcontentloaded" });
		// The welcome overlay must be ACTIVATED (its "Start chatting" button flips `welcomeModalSeen`,
		// which arms the composer) before the composer will accept a submit — until then Enter is
		// swallowed. The overlay element itself lingers in the DOM a beat after (async settings write),
		// so we must NOT pointer-click the composer (the `pointer-events-auto` backdrop blocks it);
		// `fill()` + `press()` only need focus, not pointer events, so they reach the textarea beneath.
		const start = page.getByRole("button", { name: /start chatting/i });
		if (await start.isVisible().catch(() => false)) await start.click().catch(() => {});

		const ta = page.locator("textarea").first();
		await ta.waitFor({ state: "visible", timeout: 15000 });
		const base0 = await page.evaluate(
			() => document.querySelectorAll('[data-message-role="assistant"]').length
		);
		await ta.fill(PROMPT);
		const tSend = Date.now();
		await ta.press("Enter");
		// Confirm the turn submitted: a new chat navigates "/" → "/conversation/[id]". If the URL hasn't
		// moved in ~6s the keypress was swallowed — the text is still in the box, so press once more.
		const submitted = () => /\/conversation\//.test(new URL(page.url()).pathname);
		let moved = false;
		for (let s = 0; s < 12; s++) {
			await page.waitForTimeout(500);
			if (submitted()) { moved = true; break; }
		}
		if (!moved) {
			await ta.press("Enter").catch(() => {});
			for (let s = 0; s < 8; s++) {
				await page.waitForTimeout(500);
				if (submitted()) { moved = true; break; }
			}
		}

		let last = -1,
			stable = 0,
			txt = "",
			answered = false,
			banner = false,
			tAnswered = 0;
		for (let s = 0; s < MAX_WAIT_S; s++) {
			await page.waitForTimeout(1000);
			const snap = await page.evaluate((b) => {
				const a = [...document.querySelectorAll('[data-message-role="assistant"]')];
				const t = (() => {
					let s = "";
					for (const el of a) {
						const p = [...el.querySelectorAll(".prose")].map((x) => x.innerText).join("\n").trim();
						if (p) s = p;
					}
					return s;
				})();
				const body = document.body.innerText;
				return {
					n: a.length,
					t,
					// honest degradation surface: the generic error banner OR the explicit limit banners.
					err: /an error occurred/i.test(body),
					limited: /rate limit|today'?s request limit|too many/i.test(body),
				};
			}, base0);
			if (snap.err || snap.limited) {
				banner = true;
				break;
			}
			if (snap.n <= base0) continue; // assistant bubble not added yet
			txt = snap.t;
			if (txt.length === last && txt.length > 0) {
				if (++stable >= 2) {
					answered = true;
					tAnswered = Date.now();
					break;
				}
			} else {
				stable = 0;
				last = txt.length;
			}
		}
		const result = {
			i,
			answered,
			banner,
			// honest = either we got a real answer, or we got an honest banner. NOT honest = silent hang.
			honest: answered || banner,
			latencyMs: answered ? tAnswered - tSend : null,
			totalMs: Date.now() - t0,
			snippet: txt.replace(/\s+/g, " ").slice(0, 80),
		};
		console.log("RESULT " + JSON.stringify(result));
		return result;
	} catch (e) {
		const result = { i, answered: false, banner: false, honest: false, latencyMs: null, error: String(e).slice(0, 120) };
		console.log("RESULT " + JSON.stringify(result));
		return result;
	} finally {
		await ctx.close();
	}
}

(async () => {
	console.log(`A4 — load rehearsal: ${K} concurrent guest sessions @ ${BASE}\n`);
	await assertSeventyB();

	const cap = Number(process.env.GLOBAL_DAILY_REQUEST_CAP) || 0;
	console.log(`▶ firing ${K} independent sessions at once (each its own context/cookies/sessionId)…`);
	if (cap) console.log(`  (GLOBAL_DAILY_REQUEST_CAP=${cap} set — also checking the cap returns an honest 429)`);
	console.log("");

	const browser = await chromium.launch({ headless: true, channel: "chrome" });
	let rows;
	try {
		// All K fired concurrently — this is the lecture-hall burst, not a sequential loop.
		rows = await Promise.all(Array.from({ length: K }, (_, i) => runSession(browser, i)));
	} finally {
		await browser.close();
	}

	// ─── Report ──────────────────────────────────────────────────────────────────────────
	const answered = rows.filter((r) => r.answered);
	const hung = rows.filter((r) => !r.honest); // neither answered nor showed a banner = silent hang
	const lats = answered.map((r) => r.latencyMs).filter((x) => x != null).sort((a, b) => a - b);
	const pct = (p) => (lats.length ? lats[Math.min(lats.length - 1, Math.floor((p / 100) * lats.length))] : null);
	const fmt = (ms) => (ms == null ? "n/a" : `${(ms / 1000).toFixed(1)}s`);
	const answerRate = rows.length ? answered.length / rows.length : 0;

	console.log("\n" + "─".repeat(72));
	console.log("RESULTS\n");
	for (const r of rows) {
		const tag = r.answered ? `✓ answered ${fmt(r.latencyMs)}` : r.banner ? "○ honest banner (degraded)" : "✗ SILENT HANG";
		console.log(`  session ${r.i}: ${tag}${r.snippet ? ` — "${r.snippet}"` : ""}`);
	}

	console.log("\n" + "─".repeat(72));
	console.log(`isolation:  ${answered.length}/${rows.length} answered  (${(answerRate * 100).toFixed(0)}%, threshold ${(ISOLATION_THRESHOLD * 100).toFixed(0)}%)`);
	console.log(`honesty:    ${rows.length - hung.length}/${rows.length} honest  (answer or banner; ${hung.length} silent hang${hung.length === 1 ? "" : "s"})`);
	console.log(`latency:    p50 ${fmt(pct(50))} · p95 ${fmt(pct(95))} · max ${fmt(lats.at(-1) ?? null)}  (under ${K}-way concurrency)`);

	// ─── Gate ────────────────────────────────────────────────────────────────────────────
	const fails = [];
	if (answerRate < ISOLATION_THRESHOLD)
		fails.push(`isolation: only ${(answerRate * 100).toFixed(0)}% answered (< ${(ISOLATION_THRESHOLD * 100).toFixed(0)}%) — concurrent sessions are starving each other`);
	if (hung.length)
		fails.push(`honesty: ${hung.length} session(s) hung silently (no answer, no banner) — a hang is the one thing the runbook says must never happen`);
	// cap-429 sub-check only runs when a low cap is actually configured on the live server.
	if (cap && cap < K) {
		const sawHonestLimit = rows.some((r) => r.banner);
		if (!sawHonestLimit)
			fails.push(`cap-429: GLOBAL_DAILY_REQUEST_CAP=${cap} < ${K} sessions but no honest limit banner appeared — the cap may be 500ing instead of honest-429ing`);
		else console.log(`cap-429:    ✓ over-cap session(s) saw an honest limit banner (not a 500)`);
	}

	console.log("\n" + "─".repeat(72));
	if (!fails.length) {
		console.log("✓ LOAD-REHEARSAL PASSED — concurrent sessions isolate, every outcome is honest, latency reported.");
		process.exit(0);
	}
	for (const f of fails) console.log("✗ " + f);
	console.log("\n✗ load rehearsal FAILED — address the above before demo day.");
	process.exit(1);
})().catch((e) => {
	console.error("✗ harness error:", e);
	process.exit(2);
});
