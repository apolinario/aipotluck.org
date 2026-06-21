import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true, channel: "chrome" });
async function run(label, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto("http://localhost:5173/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const s = page.getByRole("button", { name: /start chatting/i });
  if (await s.isVisible().catch(() => false)) { await s.click(); await page.waitForTimeout(300); }
  const measure = async () => page.evaluate(() => {
    const main = document.querySelector('[role="main"]');
    const panel = document.querySelector('[role="dialog"][aria-label^="Behind the scenes"]');
    const toggle = [...document.querySelectorAll("button")].find(b => /behind the scenes|what's behind/i.test(b.getAttribute("aria-label")+b.textContent));
    const r = (el) => el ? el.getBoundingClientRect() : null;
    const mr = r(main), pr = r(panel);
    return { mainW: mr?Math.round(mr.width):null, panelX: pr?Math.round(pr.x):null, panelW: pr?Math.round(pr.width):null, toggleVisible: !!toggle && (toggle.getBoundingClientRect().width>0) };
  });
  const before = await measure();
  // click the toggle
  await page.evaluate(() => { const t=[...document.querySelectorAll("button")].find(b => /behind the scenes|what's behind/i.test(b.getAttribute("aria-label")+b.textContent)); t?.click(); });
  await page.waitForTimeout(500);
  const after = await measure();
  await page.screenshot({ path: `evals/ux/maptoggle-${label}.png`, fullPage: false });
  console.log(`${label} ${JSON.stringify({ before, after })}`);
  await ctx.close();
}
await run("desktop", 1280, 860);
await run("mobile", 390, 780);
await browser.close();
