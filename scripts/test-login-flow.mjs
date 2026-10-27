// Flujo de ingreso: empresa → usuario. Verifica pasos, roles por empresa y rechazo de empresa ajena.
import { chromium } from "playwright-core";
const OUT = process.argv[2] ?? (await import("node:os")).tmpdir();
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.addInitScript(() => sessionStorage.setItem("gc-preloaded", "1"));
const ok = (l, c) => console.log(c ? "✓" : "✗ FALLA", l);

await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/login-1.png` });
ok("paso 1 muestra selector de empresas", await page.getByText("Selecciona tu empresa").isVisible());

await page.locator("button", { hasText: "GRUPO CRUZ INFRAESTRUCTURA" }).first().click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/login-2.png` });
ok("URL guarda ?empresa=02", page.url().includes("empresa=02"));
const roles02 = await page.locator("[data-quick-role]").evaluateAll((els) => els.map((e) => e.getAttribute("data-quick-role")));
ok(`empresa 02 lista sus roles (${roles02.join(", ")})`, roles02.length > 0 && !roles02.join().includes("Almacén"));

await page.getByText("Cambiar de empresa").click();
await page.locator("button", { hasText: "EDIFICACIONES" }).first().click();
await page.waitForTimeout(900);
const roles03 = await page.locator("[data-quick-role]").evaluateAll((els) => els.map((e) => e.getAttribute("data-quick-role")));
ok(`empresa 03 solo Gerencia General (${roles03.join(", ")})`, roles03.length === 1 && roles03[0] === "Gerencia General");
await page.screenshot({ path: `${OUT}/login-3.png` });

// Usuario de la empresa 02 intenta entrar por la empresa 01
await page.goto("http://localhost:3000/login?empresa=01", { waitUntil: "networkidle" });
await page.fill('input[type="email"]', "mparedes@grupocruz.pe");
await page.fill('input[type="password"]', "GrupoCruz2026!");
await page.click('button[type="submit"]');
await page.waitForTimeout(3500);
ok("usuario de la 02 rechazado en la 01", page.url().includes("/login") && (await page.getByText("No tienes acceso").count()) > 0);
await page.screenshot({ path: `${OUT}/login-denied.png` });

// Ingreso correcto: entra directo al tablero de su empresa
await page.goto("http://localhost:3000/login?empresa=02", { waitUntil: "networkidle" });
await page.fill('input[type="email"]', "mparedes@grupocruz.pe");
await page.fill('input[type="password"]', "GrupoCruz2026!");
await page.click('button[type="submit"]');
await page.waitForURL((u) => u.pathname.startsWith("/empresa/02"), { timeout: 60000 });
ok("ingreso correcto va directo a /empresa/02", true);
await browser.close();
