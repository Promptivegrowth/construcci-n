// Capturas para QA visual. Uso: node scripts/shot.mjs <ruta> <salida.png> [email] [ancho] [alto] [full]
import { chromium } from "playwright-core";
const [, , path, out, email, w = "1440", h = "900", full = "0"] = process.argv;
const BASE = "http://localhost:3000";
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 300)); });
await page.addInitScript(() => sessionStorage.setItem("gc-preloaded", "1"));
if (email) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', "GrupoCruz2026!");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 });
}
await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(+(process.env.SHOT_WAIT ?? 2500));
  if (process.env.SHOT_SCROLL) { for (let y = 0; y < 6000; y += 700) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(250); } await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(800); }
await page.screenshot({ path: out, fullPage: full === "1" });
console.log("ok", page.url());
await browser.close();
