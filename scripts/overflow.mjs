// Detecta elementos que desbordan horizontalmente en móvil. Uso: node scripts/overflow.mjs <ruta> <email>
import { chromium } from "playwright-core";
// Empresa con la que se inicia sesión: la de la ruta, o la empresa principal del usuario.
const companyFor = (p = "", mail = "") => p.match(/^\/empresa\/([^/]+)/)?.[1] ?? (/mparedes|lfernandez/.test(mail) ? "02" : "01");
const [, , path, email] = process.argv;
const browser = await chromium.launch({ channel: "chrome" });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await page.addInitScript(() => sessionStorage.setItem("gc-preloaded", "1"));
await page.goto(`http://localhost:3000/login?empresa=${companyFor(typeof path === "string" ? path : "", typeof email === "string" ? email : "gerencia@grupocruz.pe")}`);
await page.fill('input[type="email"]', email);
await page.fill('input[type="password"]', "GrupoCruz2026!");
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 });
await page.goto(`http://localhost:3000${path}`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const res = await page.evaluate(() => {
  const W = document.documentElement.clientWidth;
  const out = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.right > W + 1 && r.width > 0) {
      let p = el.parentElement, clipped = false;
      while (p) { const s = getComputedStyle(p); if (["auto", "scroll", "hidden"].includes(s.overflowX)) { clipped = true; break; } p = p.parentElement; }
      if (!clipped) out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 90)} right=${Math.round(r.right)}`);
    }
  }
  return { W, scroll: document.documentElement.scrollWidth, items: out.slice(0, 12) };
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
