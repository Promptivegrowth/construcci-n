// QA: recorre todas las pantallas por usuario y empresa, pulsa los botones no destructivos y reporta fallos.
// Uso: node scripts/qa-crawl.mjs [salida.json] [usuarios separados por coma]
import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT = process.argv[2] ?? `${(await import("node:os")).tmpdir()}/qa-crawl.json`;
const ONLY = process.argv[3]?.split(",");
const PASS = "GrupoCruz2026!";

const USERS = [
  { email: "gerencia@grupocruz.pe", role: "gerente_general", companies: ["01", "02", "03"], deep: true },
  { email: "jcastillo@grupocruz.pe", role: "gerente_proyectos", companies: ["01", "02"] },
  { email: "rquispe@grupocruz.pe", role: "residente", companies: ["01"] },
  { email: "jrojas@grupocruz.pe", role: "administrador", companies: ["01"] },
  { email: "contabilidad@grupocruz.pe", role: "contabilidad", companies: ["01", "02"] },
  { email: "almacen@grupocruz.pe", role: "almacen", companies: ["01"] },
  { email: "mparedes@grupocruz.pe", role: "administrador", companies: ["02"] },
  { email: "lfernandez@grupocruz.pe", role: "residente", companies: ["02"] },
].filter((u) => !ONLY || ONLY.some((o) => u.email.startsWith(o)));

// Todas las subpantallas de obra (para probar acceso directo por URL aunque el menú las oculte)
const PROJECT_SUBS = ["", "/presupuesto", "/reportes", "/gastos", "/gastos/nuevo", "/aprobaciones", "/ordenes", "/ordenes/nueva", "/caja", "/pagos",
  "/conciliacion", "/cuentas-por-pagar", "/valorizaciones", "/flujo-caja", "/resultados", "/mano-de-obra", "/almacen", "/almacen/movimientos",
  "/almacen/equipos", "/asistencia", "/configuracion", "/presupuesto/importar"];
const COMPANY_SUBS = ["", "/alertas", "/proveedores", "/materiales", "/auditoria", "/usuarios", "/obras/nueva"];

// Botones que modifican datos o cierran sesión: no se pulsan en el recorrido
const DANGER = /eliminar|borrar|anular|aprobar|rechazar|observar|pagar|registrar|guardar|confirmar|enviar|declarar|depositar|rendir|cerrar sesi|salir|cerrar periodo|cerrar mes|reabrir|importar|crear|desactivar|activar|resolver|subir|sincronizar|marcar|solicitar|asignar|quitar|restablecer|cobrar|facturar|valorizar|descartar|reintentar/i;
const BAD_TEXT = /\bNaN\b|\bundefined\b|\bInfinity\b|\[object Object\]|Invalid Date|S\/ -0\.00|\bnull\b/;

const norm = (p) => p
  .replace(/\/obra\/[^/]+/, "/obra/:p")
  .replace(/\/(gastos|ordenes)\/(?!nuevo|nueva)[^/]+/, "/$1/:id")
  .replace(/\/presupuesto\/(?!importar)[^/]+/, "/presupuesto/:wbs")
  .replace(/\?.*$/, "");

const findings = [];
const add = (f) => { findings.push(f); console.log(`  ✗ [${f.kind}] ${f.user} ${f.path} :: ${String(f.detail).slice(0, 220)}`); };

async function runUser(browser, user, company) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  await page.addInitScript(() => sessionStorage.setItem("gc-preloaded", "1"));
  let current = "";
  const tag = `${user.email.split("@")[0]}@${company}`;
  page.on("pageerror", (e) => add({ kind: "pageerror", user: tag, path: current, detail: e.message }));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/favicon|Failed to load resource: the server responded with a status of 40[13]/.test(t)) return;
    add({ kind: "console", user: tag, path: current, detail: t });
  });
  page.on("response", (r) => {
    const u = r.url();
    if (r.status() >= 500 && u.startsWith(BASE)) add({ kind: "http5xx", user: tag, path: current, detail: `${r.status()} ${u}` });
  });
  page.on("dialog", (d) => d.dismiss().catch(() => {}));

  await page.goto(`${BASE}/login?empresa=${company}`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 });

  const root = `/empresa/${company}`;
  const visited = new Set();
  const perPattern = new Map();
  const queue = [root, "/empresas", "/campo"];
  if (user.role === "gerente_general") queue.push("/holding");
  const navSeen = new Set();
  const projects = new Set();
  const limitFor = (p) => (user.deep ? (/:id|:wbs/.test(norm(p)) ? 3 : 99) : (/:id|:wbs/.test(norm(p)) ? 1 : 2));

  async function visit(path, opts = {}) {
    current = path;
    const t0 = Date.now();
    let resp;
    try {
      resp = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 60000 });
    } catch (e) {
      add({ kind: "timeout", user: tag, path, detail: e.message.split("\n")[0] });
      return null;
    }
    await page.waitForTimeout(400);
    const ms = Date.now() - t0;
    const finalPath = new URL(page.url()).pathname + new URL(page.url()).search;
    const status = resp?.status() ?? 0;
    const info = await page.evaluate(() => {
      const main = document.querySelector("main") ?? document.body;
      const text = main.innerText;
      const links = [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")).filter((h) => h && h.startsWith("/"));
      const nav = [...document.querySelectorAll("aside a[href], nav a[href]")].map((a) => a.getAttribute("href"));
      const over = document.documentElement.scrollWidth > window.innerWidth + 2;
      return { text, links, nav, over, title: document.title };
    });
    if (status >= 400) add({ kind: `http${status}`, user: tag, path, detail: `${finalPath} ${info.title}` });
    if (/Application error|Unhandled Runtime Error|This page could not be found|Something went wrong/i.test(info.text)) add({ kind: "errorpage", user: tag, path, detail: info.text.slice(0, 200) });
    const m = info.text.match(BAD_TEXT);
    if (m) {
      const i = info.text.indexOf(m[0]);
      add({ kind: "badtext", user: tag, path, detail: `"${m[0]}" en: …${info.text.slice(Math.max(0, i - 80), i + 60).replace(/\s+/g, " ")}…` });
    }
    if (info.text.trim().length < 40 && status < 400) add({ kind: "blank", user: tag, path, detail: info.text.trim() });
    if (info.over) add({ kind: "overflow", user: tag, path, detail: "desborde horizontal a 1440px" });
    if (ms > 12000) add({ kind: "slow", user: tag, path, detail: `${ms} ms` });
    info.nav.forEach((n) => navSeen.add(n));
    return { ...info, status, finalPath, ms };
  }

  async function clickButtons(path) {
    const labels = await page.$$eval("main button, main [role=tab]", (els) => els
      .filter((e) => e.offsetParent !== null && !e.disabled && e.getAttribute("type") !== "submit")
      .map((e) => (e.innerText || e.getAttribute("aria-label") || e.getAttribute("title") || "").trim().replace(/\s+/g, " "))
      .filter(Boolean));
    const uniq = [...new Set(labels)].filter((l) => !DANGER.test(l)).slice(0, 25);
    for (const label of uniq) {
      current = `${path} [btn:${label.slice(0, 40)}]`;
      try {
        const loc = page.locator("main button, main [role=tab]").filter({ hasText: label }).first();
        const target = (await loc.count()) ? loc : page.locator(`main button[aria-label="${label}"], main button[title="${label}"]`).first();
        if (!(await target.count())) continue;
        await target.click({ timeout: 4000 });
        // El menú Exportar ofrece Excel y PDF: se prueban ambos (en el recorrido profundo)
        if (/exportar/i.test(label)) {
          const kinds = user.deep ? ["Excel (.xlsx)", "PDF ejecutivo"] : ["Excel (.xlsx)"];
          for (const [i, k] of kinds.entries()) {
            if (i > 0) await target.click({ timeout: 4000 });
            const item = page.getByRole("menuitem").filter({ hasText: k }).first();
            if (!(await item.count())) { add({ kind: "export", user: tag, path, detail: `menú "${label}" sin opción ${k}` }); continue; }
            const dl = page.waitForEvent("download", { timeout: 30000 }).catch(() => null);
            await item.click();
            const d = await dl;
            if (!d) add({ kind: "export", user: tag, path, detail: `${k} no descargó archivo` });
            else if (await d.failure()) add({ kind: "export", user: tag, path, detail: `descarga fallida ${k}: ${await d.failure()}` });
            await page.waitForTimeout(300);
          }
        }
        await page.waitForTimeout(500);
        const t = await page.evaluate(() => document.body.innerText);
        const m = t.match(BAD_TEXT);
        if (m) {
          const i = t.indexOf(m[0]);
          add({ kind: "badtext", user: tag, path: current, detail: `"${m[0]}" en: …${t.slice(Math.max(0, i - 80), i + 60).replace(/\s+/g, " ")}…` });
        }
        await page.keyboard.press("Escape");
        await page.waitForTimeout(200);
        if (new URL(page.url()).pathname !== path.split("?")[0]) await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      } catch (e) {
        if (!/Timeout|not visible|detached|intercepts pointer/.test(e.message)) add({ kind: "click", user: tag, path: current, detail: e.message.split("\n")[0] });
        await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" }).catch(() => {});
      }
    }
  }

  while (queue.length) {
    const path = queue.shift();
    const key = path.split("#")[0];
    if (visited.has(key)) continue;
    const pat = norm(key);
    const n = perPattern.get(pat) ?? 0;
    if (n >= limitFor(key)) continue;
    perPattern.set(pat, n + 1);
    visited.add(key);
    const r = await visit(key);
    if (!r) continue;
    const pm = key.match(/^\/empresa\/[^/]+\/obra\/([^/?]+)/);
    if (pm) projects.add(pm[1]);
    if (user.deep || n === 0) await clickButtons(key);
    for (const l of r.links) {
      const clean = l.split("#")[0];
      if (!clean.startsWith(root) && !["/holding", "/campo", "/empresas"].some((p) => clean.startsWith(p))) continue;
      if (/\/api\//.test(clean)) continue;
      if (!visited.has(clean)) queue.push(clean);
    }
  }

  // Acceso directo por URL a pantallas que el menú oculta para este rol
  const access = [];
  const proj = [...projects][0];
  if (proj) {
    for (const s of PROJECT_SUBS) {
      const path = `${root}/obra/${proj}${s}`;
      const inNav = navSeen.has(path);
      if (inNav) continue;
      current = path;
      const resp = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 60000 }).catch(() => null);
      const fin = new URL(page.url()).pathname;
      const text = await page.evaluate(() => (document.querySelector("main") ?? document.body).innerText.slice(0, 160).replace(/\s+/g, " "));
      access.push({ path, status: resp?.status(), final: fin, text });
    }
  }
  for (const s of COMPANY_SUBS) {
    const path = `${root}${s}`;
    if (navSeen.has(path)) continue;
    current = path;
    const resp = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 60000 }).catch(() => null);
    const fin = new URL(page.url()).pathname;
    const text = await page.evaluate(() => (document.querySelector("main") ?? document.body).innerText.slice(0, 160).replace(/\s+/g, " "));
    access.push({ path, status: resp?.status(), final: fin, text });
  }
  await ctx.close();
  console.log(`✓ ${tag}: ${visited.size} pantallas, obras ${[...projects].join(" ")}`);
  return { user: tag, role: user.role, visited: [...visited], access };
}

const browser = await chromium.launch({ channel: "chrome" });
const jobs = USERS.flatMap((u) => u.companies.map((c) => [u, c]));
const results = [];
const CONC = 4;
let idx = 0;
await Promise.all(Array.from({ length: CONC }, async () => {
  while (idx < jobs.length) {
    const [u, c] = jobs[idx++];
    try { results.push(await runUser(browser, u, c)); } catch (e) { add({ kind: "fatal", user: `${u.email}@${c}`, path: "", detail: e.message }); }
  }
}));
await browser.close();
writeFileSync(OUT, JSON.stringify({ findings, results }, null, 2));
console.log(`\n${findings.length} hallazgos · ${results.reduce((a, r) => a + r.visited.length, 0)} pantallas · ${OUT}`);
