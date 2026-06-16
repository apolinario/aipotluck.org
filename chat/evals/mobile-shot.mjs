// One-off: capture the mobile split-screen (chat tab + map tab) at a real phone
// viewport, since the dev browser's WM won't honor a narrow resize. Not wired
// into CI — a manual visual aid for the responsive work.
import { chromium, devices } from "@playwright/test";

const iphone = devices["iPhone 13"];
// Use the system Chrome (Playwright's bundled chromium isn't downloaded here).
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ ...iphone });
const page = await ctx.newPage();
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
// Fresh context → no onboarded flag → the welcome overlay is showing.
await page.screenshot({ path: "/tmp/mobile-welcome.png" });

// Dismiss into the chat empty state.
await page.getByRole("button", { name: /start chatting/i }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: "/tmp/mobile-chat.png" });

// Switch to the map tab via the mobile tab bar.
await page.getByRole("button", { name: /under the hood/i }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: "/tmp/mobile-map.png" });

const innerWidth = await page.evaluate(() => window.innerWidth);
console.log(`viewport innerWidth=${innerWidth}`);
await browser.close();
