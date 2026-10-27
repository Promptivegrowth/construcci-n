// Prueba de exportaciones reales (descarga de archivos) con Chrome.
import { chromium } from "playwright-core";
// Empresa con la que se inicia sesión: la de la ruta, o la empresa principal del usuario.
const companyFor = (p = "", mail = "") => p.match(/^\/empresa\/([^/]+)/)?.[1] ?? (/mparedes|lfernandez/.test(mail) ? "02" : "01");
const OUT = process.argv[2];
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await page.addInitScript(() => sessionStorage.setItem("gc-preloaded", "1"));
await page.goto(`http://localhost:3000/login?empresa=${companyFor(typeof path === "string" ? path : "", typeof email === "string" ? email : "gerencia@grupocruz.pe")}`);
await page.fill('input[type="email"]', "gerencia@grupocruz.pe");
await page.fill('input[type="password"]', "GrupoCruz2026!");
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 });
async function grab(label, action) {
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 180000 }), action()]);
  const path = `${OUT}/${dl.suggestedFilename()}`;
  await dl.saveAs(path);
  console.log(label, "→", dl.suggestedFilename());
}
await page.goto("http://localhost:3000/empresa/01/obra/010-HCVC", { waitUntil: "networkidle" });
await page.waitForTimeout(3000);
for (const kind of ["Excel", "PDF ejecutivo"]) {
  await grab(kind, async () => { await page.getByRole("button", { name: "Reporte ejecutivo" }).click(); await page.getByRole("menuitem", { name: new RegExp(kind) }).click(); });
}
await page.goto("http://localhost:3000/empresa/02/obra/023-PATR/reportes", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await grab("Liquidación PDF", () => page.getByRole("button", { name: "PDF con sustentos" }).click());
await grab("Liquidación Excel", () => page.getByRole("button", { name: "Excel" }).last().click());
await browser.close();
