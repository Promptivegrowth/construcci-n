// QA end to end: recorre los ciclos completos pulsando los botones como cada rol y verifica el resultado en la base.
// Gasto (residente → Gerencia → Contabilidad), orden (almacén → Gerencia) y fondos (residente → Gerencia → Contabilidad → rendición).
// Uso: node scripts/qa-flows.mjs [carpeta-capturas] [--cleanup]   · todo lo creado lleva la marca [QA-E2E]
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const OUT = process.argv.find((a, i) => i > 1 && !a.startsWith("--")) ?? (await import("node:os")).tmpdir();
const BASE = "http://localhost:3000";
const CO = "01", OBRA = "011-RLAL";
const P = `/empresa/${CO}/obra/${OBRA}`;
const TAG = "[QA-E2E]";
const RUN = Date.now().toString().slice(-6);

const db = async (path, init = {}) => {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers ?? {}) } });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${path}: ${t}`);
  return t ? JSON.parse(t) : null;
};

let fails = 0;
// Espera hasta que la base refleje el cambio (las acciones terminan después del clic)
const waitFor = async (get, cond, ms = 20000) => { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { v = await get(); if (cond(v)) return v; await new Promise((r) => setTimeout(r, 500)); } return v; };
const ok = (label, cond, extra = "") => { if (!cond) fails++; console.log(`${cond ? "✓" : "✗ FALLA"} ${label}${extra ? ` · ${extra}` : ""}`); return cond; };

if (process.argv.includes("--cleanup")) {
  await cleanup();
  process.exit(0);
}

async function cleanup() {
  const exps = await db(`expenses?select=id&description=like.*${encodeURIComponent(TAG)}*`);
  const ids = exps.map((e) => e.id);
  if (ids.length) {
    const inList = `(${ids.join(",")})`;
    for (const t of ["cash_movements", "payments", "expense_files", "expense_allocations"]) await db(`${t}?expense_id=in.${inList}`, { method: "DELETE" });
    await db(`expenses?id=in.${inList}`, { method: "DELETE" });
  }
  const frs = await db(`fund_requests?select=id&reason=like.*${encodeURIComponent(TAG)}*`);
  if (frs.length) {
    const inList = `(${frs.map((f) => f.id).join(",")})`;
    await db(`cash_movements?fund_request_id=in.${inList}`, { method: "DELETE" });
    await db(`fund_requests?id=in.${inList}`, { method: "DELETE" });
  }
  const ords = await db(`orders?select=id&title=like.*${encodeURIComponent(TAG)}*`);
  if (ords.length) {
    const inList = `(${ords.map((o) => o.id).join(",")})`;
    await db(`order_items?order_id=in.${inList}`, { method: "DELETE" });
    await db(`orders?id=in.${inList}`, { method: "DELETE" });
  }
  const vals = await db(`valuations?select=id&notes=like.*${encodeURIComponent(TAG)}*`);
  if (vals.length) {
    const inList = `(${vals.map((v) => v.id).join(",")})`;
    await db(`collections?valuation_id=in.${inList}`, { method: "DELETE" });
    await db(`valuations?id=in.${inList}`, { method: "DELETE" });
  }
  const sm = await db(`stock_movements?notes=like.*${encodeURIComponent(TAG)}*`, { method: "DELETE" });
  const [proj] = await db(`projects?select=id&code=eq.${OBRA}`);
  await db("rpc/refresh_project_alerts", { method: "POST", body: JSON.stringify({ p_project: proj.id }) }).catch((e) => console.log("refresh alerts:", e.message));
  console.log(`limpieza: ${ids.length} gastos, ${frs.length} solicitudes, ${ords.length} órdenes, ${vals.length} valorizaciones, ${sm.length} movimientos de almacén de prueba eliminados`);
}

const browser = await chromium.launch({ channel: "chrome" });
const errors = [];
async function as(email) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => sessionStorage.setItem("gc-preloaded", "1"));
  page.on("pageerror", (e) => errors.push(`${email} pageerror ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !/favicon/.test(m.text()) && errors.push(`${email} console ${m.text().slice(0, 200)}`));
  await page.goto(`${BASE}/login?empresa=${CO}`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', "GrupoCruz2026!");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 });
  return { page, close: () => ctx.close() };
}
const toastText = async (page) => {
  const t = page.locator("[data-sonner-toast]").last();
  await t.waitFor({ timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(600);
  return (await t.innerText().catch(() => "")).replace(/\s+/g, " ");
};
const shot = (page, name) => page.screenshot({ path: `${OUT}/flow-${name}.png` }).catch(() => {});

// Imagen de sustento (PNG 1×1)
const png = `${OUT}/qa-sustento.png`;
writeFileSync(png, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));

try {
  // ───────────── 1. GASTO: residente declara ─────────────
  console.log("\n— Gasto: residente → Gerencia → Contabilidad");
  const desc = `${TAG} Alambre N° 16 para encofrado ${RUN}`;
  let expenseId;
  {
    const { page, close } = await as("rquispe@grupocruz.pe");
    await page.goto(`${BASE}${P}/gastos/nuevo`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Buscar por razón social o RUC/ }).click();
    await page.getByRole("dialog").locator("button", { hasText: "RUC " }).first().click();
    await page.getByRole("button", { name: "Factura", exact: true }).click().catch(() => {});
    await page.locator('input[placeholder="F001"]').fill("F001");
    await page.locator('input[placeholder="0004521"]').fill(`9${RUN}`);
    await page.locator('input[placeholder="0.00"]').first().fill("1180");
    const fase = page.locator("select", { has: page.locator("option", { hasText: "Seleccionar…" }) }).first();
    await fase.selectOption({ index: 1 });
    const wbs = page.locator("select", { has: page.locator("option", { hasText: "Seleccionar WBS" }) });
    await wbs.selectOption({ index: 1 });
    await page.locator("textarea").first().fill(desc);
    await page.locator('input[type="file"][multiple]').setInputFiles(png);
    await page.getByText("Subiendo…").waitFor({ state: "detached", timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(800);
    ok("el formulario calcula costo sin IGV (S/ 1,000.00)", (await page.getByText("Costo cargado al WBS").locator("..").innerText()).includes("1,000.00"));
    await page.getByRole("button", { name: "Declarar" }).click();
    await page.waitForURL(/\/gastos\/[0-9a-f-]{36}$/, { timeout: 30000 }).catch(() => {});
    await shot(page, "1-declarado");
    expenseId = page.url().match(/gastos\/([0-9a-f-]{36})/)?.[1];
    ok("residente declara el gasto y llega al detalle", !!expenseId, page.url());
    const [e] = expenseId ? await db(`expenses?select=status,cost_pen,payable_pen&id=eq.${expenseId}`) : [{}];
    ok("estado en base = declarado, costo 1000, a pagar 1180", e.status === "declarado" && +e.cost_pen === 1000 && +e.payable_pen === 1180, JSON.stringify(e));
    ok("el residente no ve botón Aprobar en su propio gasto", (await page.getByRole("button", { name: "Aprobar" }).count()) === 0);
    await close();
  }

  // ───────────── 2. Gerencia aprueba ─────────────
  {
    const { page, close } = await as("jcastillo@grupocruz.pe");
    await page.goto(`${BASE}${P}/aprobaciones`, { waitUntil: "networkidle" });
    const card = page.locator("div", { hasText: desc }).filter({ has: page.getByRole("button", { name: "Aprobar" }) }).last();
    ok("el gasto aparece en la bandeja de aprobaciones", (await card.count()) > 0);
    await card.getByRole("button", { name: "Aprobar" }).first().click();
    const t = await toastText(page);
    await shot(page, "2-aprobado");
    ok("aviso de aprobación", /aprobad/i.test(t), t);
    const [e] = await db(`expenses?select=status,approved_by&id=eq.${expenseId}`);
    ok("estado en base = aprobado", e.status === "aprobado", e.status);
    await page.goto(`${BASE}${P}/gastos/${expenseId}`, { waitUntil: "networkidle" });
    ok("detalle muestra 'Por pagar'", (await page.getByText("Por pagar").count()) > 0);
    await close();
  }

  // ───────────── 3. Contabilidad paga 50% y saldo ─────────────
  {
    const { page, close } = await as("contabilidad@grupocruz.pe");
    for (const [label, status] of [["50%", "pagado_parcial"], ["Saldo", "pagado"]]) {
      await page.goto(`${BASE}${P}/pagos?gasto=${expenseId}`, { waitUntil: "networkidle" });
      const dlg = page.getByRole("dialog");
      ok(`?gasto= abre el registro de pago (${label})`, await dlg.isVisible().catch(() => false));
      await dlg.getByRole("button", { name: label, exact: true }).click();
      await dlg.locator('input[placeholder="Ej. 00458712"]').fill(`OP${RUN}${label.length}`);
      await dlg.getByRole("button", { name: /^Registrar S\// }).click();
      const t = await toastText(page);
      const [e] = await db(`expenses?select=status&id=eq.${expenseId}`);
      ok(`pago ${label} → estado ${status}`, e.status === status, `${e.status} · ${t}`);
    }
    await shot(page, "3-pagado");
    const paid = await db(`v_expense_paid?select=paid_pen&expense_id=eq.${expenseId}`);
    ok("total pagado = 1180", +paid[0]?.paid_pen === 1180, JSON.stringify(paid));
    await page.goto(`${BASE}${P}/pagos?gasto=${expenseId}`, { waitUntil: "networkidle" });
    ok("un gasto pagado ya no abre pago", !(await page.getByRole("dialog").isVisible().catch(() => false)));
    await page.goto(`${BASE}${P}/gastos/${expenseId}`, { waitUntil: "networkidle" });
    ok("detalle muestra estado Pagado", (await page.locator("main").innerText()).includes("Pagado"));
    ok("sin botón Anular cuando tiene pagos", (await page.getByRole("button", { name: "Anular" }).count()) === 0);
    await close();
  }

  // ───────────── 4. ORDEN: almacén solicita, Gerencia aprueba ─────────────
  console.log("\n— Orden de compra: almacén → Gerencia");
  let orderId;
  {
    const { page, close } = await as("almacen@grupocruz.pe");
    await page.goto(`${BASE}${P}/ordenes`, { waitUntil: "networkidle" });
    const btn = page.getByRole("link", { name: /Solicitar orden|Nueva orden/ });
    ok("almacén ve el botón para solicitar orden", (await btn.count()) > 0);
    await page.goto(`${BASE}${P}/ordenes/nueva`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Orden de compra/ }).click();
    await page.locator('input[placeholder^="Ej.: Alquiler"]').fill(`${TAG} Clavos y alambre ${RUN}`);
    const selects = page.locator("main select");
    const prov = page.locator("select", { has: page.locator("option", { hasText: /Seleccionar proveedor|Proveedor/ }) }).first();
    await prov.selectOption({ index: 1 }).catch(async () => selects.nth(0).selectOption({ index: 1 }));
    const w = page.locator("select", { has: page.locator("optgroup") }).first();
    await w.selectOption({ index: 1 });
    const desc2 = page.locator('input[placeholder="Descripción"], input[placeholder="Descripción del ítem"]').first();
    await desc2.fill("Clavo 3\" x kg");
    const nums = page.locator('main input[type="number"]');
    const n = await nums.count();
    await nums.nth(n - 2).fill("10");
    await nums.nth(n - 1).fill("8.5");
    await page.getByRole("button", { name: "Enviar solicitud a Gerencia" }).click();
    await page.waitForURL(/\/ordenes\/[0-9a-f-]{36}$/, { timeout: 30000 }).catch(() => {});
    const t = await toastText(page);
    orderId = page.url().match(/ordenes\/([0-9a-f-]{36})/)?.[1];
    await shot(page, "4-orden");
    ok("almacén envía la solicitud de orden", !!orderId, t || page.url());
    if (orderId) {
      const [o] = await db(`orders?select=status,subtotal_pen,order_type&id=eq.${orderId}`);
      ok("orden en base = solicitada, OC, subtotal 85", o.status === "solicitada" && o.order_type === "OC" && +o.subtotal_pen === 85, JSON.stringify(o));
    }
    await close();
  }
  if (orderId) {
    const { page, close } = await as("jcastillo@grupocruz.pe");
    await page.goto(`${BASE}${P}/ordenes/${orderId}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Aprobar" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Aprobar" }).click();
    const t = await toastText(page);
    const [o] = await db(`orders?select=status&id=eq.${orderId}`);
    ok("Gerencia aprueba la orden", o.status === "aprobada", `${o.status} · ${t}`);
    await page.getByRole("button", { name: "Cerrar" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cerrar orden" }).click();
    const o2 = await waitFor(async () => (await db(`orders?select=status&id=eq.${orderId}`))[0], (o) => o.status === "cerrada");
    ok("Gerencia cierra la orden", o2.status === "cerrada", o2.status);
    await shot(page, "5-orden-cerrada");
    await close();
  }

  // ───────────── 5. FONDOS: residente → Gerencia → Contabilidad → rendición ─────────────
  console.log("\n— Fondos: residente → Gerencia → Contabilidad → rendición");
  const reason = `${TAG} Pasajes y agua semana ${RUN}`;
  const row = (page) => page.locator("div.rounded-2xl.border.p-4", { hasText: reason }).first();
  {
    const { page, close } = await as("rquispe@grupocruz.pe");
    await page.goto(`${BASE}${P}/caja`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Solicitar fondos" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.locator('input[type="number"]').fill("300");
    await dlg.locator("textarea").fill(reason);
    await dlg.getByRole("button", { name: "Enviar solicitud" }).click();
    const t = await toastText(page);
    const fr = await db(`fund_requests?select=status&reason=eq.${encodeURIComponent(reason)}`);
    ok("residente solicita fondos", fr[0]?.status === "pendiente", t);
    await close();
  }
  for (const [email, btn, fill, confirm, status] of [
    ["jcastillo@grupocruz.pe", "Aprobar", null, "Aprobar", "aprobada"],
    ["contabilidad@grupocruz.pe", "Registrar depósito", `OP-${RUN}`, "Registrar depósito", "depositada"],
  ]) {
    const { page, close } = await as(email);
    await page.goto(`${BASE}${P}/caja`, { waitUntil: "networkidle" });
    const r = row(page);
    ok(`${email.split("@")[0]} ve la solicitud con botón ${btn}`, (await r.getByRole("button", { name: btn }).count()) > 0);
    await r.getByRole("button", { name: btn }).first().click();
    const dlg = page.getByRole("dialog");
    if (fill) await dlg.locator("input").first().fill(fill);
    await dlg.getByRole("button", { name: confirm }).click();
    const t = await toastText(page);
    const fr = await db(`fund_requests?select=status&reason=eq.${encodeURIComponent(reason)}`);
    ok(`solicitud → ${status}`, fr[0]?.status === status, `${fr[0]?.status} · ${t}`);
    await close();
  }
  {
    const { page, close } = await as("rquispe@grupocruz.pe");
    await page.goto(`${BASE}${P}/caja`, { waitUntil: "networkidle" });
    await row(page).getByRole("button", { name: "Rendir" }).first().click();
    const dlg = page.getByRole("dialog");
    // Hueco detectado en la revisión: ¿ofrece rendir el gasto que Contabilidad ya pagó por transferencia?
    const offersPaid = (await dlg.getByText(desc).count()) > 0;
    ok("la rendición NO ofrece un comprobante ya pagado por transferencia", !offersPaid);
    await dlg.getByRole("button", { name: "Agregar" }).click();
    await dlg.locator('input[placeholder="Concepto"]').fill(`${TAG} Pasajes obreros`);
    await dlg.locator('input[placeholder="0.00"]').last().fill("280");
    await dlg.getByRole("button", { name: "Registrar rendición" }).click();
    const t = await toastText(page);
    await shot(page, "6-rendida");
    const fr = await db(`fund_requests?select=status,rendered_amount&reason=eq.${encodeURIComponent(reason)}`);
    ok("rendición → rendida por S/ 280", fr[0]?.status === "rendida" && +fr[0].rendered_amount === 280, `${JSON.stringify(fr[0])} · ${t}`);
    ok("mensaje indica S/ 20 que quedan en caja", /20\.00/.test(t), t);
    await close();
  }

  // ───────────── 6. VALORIZACIÓN: Gerencia registra/aprueba/factura, Contabilidad cobra ─────────────
  console.log("\n— Valorización: Gerencia → Contabilidad");
  const VAL = 4321.09, VAL_TXT = "4,321.09";
  {
    const { page, close } = await as("jcastillo@grupocruz.pe");
    await page.goto(`${BASE}${P}/valorizaciones`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Nueva valorización" }).click();
    let dlg = page.getByRole("dialog");
    const dates = dlg.locator('input[type="date"]');
    await dates.nth(0).fill("2026-09-01");
    await dates.nth(1).fill("2026-09-30");
    await dlg.locator('input[type="number"]').fill(String(VAL));
    await dlg.locator("textarea").fill(`${TAG} valorización de prueba`);
    await dlg.getByRole("button", { name: "Guardar" }).click();
    const v = await waitFor(async () => (await db(`valuations?select=id,number,status&notes=like.*${encodeURIComponent(TAG)}*`))[0], (x) => !!x);
    ok("Gerencia registra la valorización (presentada)", v?.status === "presentada", JSON.stringify(v));
    const vrow = () => page.locator("tr", { hasText: VAL_TXT }).filter({ has: page.getByRole("button") }).first();
    await page.waitForTimeout(1500);
    for (const [btn, fill, status] of [["Aprobar", null, "aprobada"], ["Facturar", `F001-QA${RUN}`, "facturada"]]) {
      const b = vrow().getByRole("button", { name: btn });
      ok(`fila muestra botón ${btn}`, (await b.count()) > 0);
      await b.click();
      dlg = page.getByRole("dialog");
      if (fill) await dlg.locator("input").first().fill(fill);
      else await dlg.locator("textarea").fill(`${TAG} aprobada por el cliente`);
      await dlg.getByRole("button", { name: "Guardar" }).click();
      const x = await waitFor(async () => (await db(`valuations?select=status&id=eq.${v.id}`))[0], (y) => y.status === status);
      ok(`valorización → ${status}`, x.status === status, x.status);
      await page.waitForTimeout(1500);
    }
    await close();
    const c = await as("contabilidad@grupocruz.pe");
    await c.page.goto(`${BASE}${P}/valorizaciones`, { waitUntil: "networkidle" });
    const total = Math.round(VAL * 1.18 * 100) / 100;
    for (const [amt, status] of [[2000, "cobrada_parcial"], [Math.round((total - 2000) * 100) / 100, "cobrada"]]) {
      await c.page.locator("tr", { hasText: VAL_TXT }).filter({ has: c.page.getByRole("button") }).first().getByRole("button", { name: "Cobro" }).click();
      const d = c.page.getByRole("dialog");
      await d.locator('input[type="number"]').fill(String(amt));
      await d.getByRole("button", { name: "Guardar" }).click();
      const x = await waitFor(async () => (await db(`valuations?select=status&id=eq.${v.id}`))[0], (y) => y.status === status);
      ok(`cobro S/ ${amt} → ${status}`, x.status === status, x.status);
      await c.page.waitForTimeout(1500);
    }
    await shot(c.page, "7-valorizacion");
    await c.close();
  }

  // ───────────── 7. ALMACÉN: ingreso y salida de material ─────────────
  console.log("\n— Almacén: ingreso y salida");
  {
    const { page, close } = await as("almacen@grupocruz.pe");
    await page.goto(`${BASE}${P}/almacen`, { waitUntil: "networkidle" });
    for (const kind of ["Ingreso", "Salida"]) {
      await page.getByRole("button", { name: kind, exact: true }).first().click();
      const d = page.getByRole("dialog");
      const matSel = d.locator("select", { has: page.locator("option", { hasText: "Selecciona un material" }) });
      if (kind === "Ingreso") await matSel.selectOption({ index: 1 });
      else {
        const opts = await matSel.locator("option").allInnerTexts();
        const i = opts.findIndex((o) => / — stock [1-9]/.test(o));
        await matSel.selectOption({ index: i });
      }
      await d.getByPlaceholder("0", { exact: true }).fill(kind === "Ingreso" ? "5" : "1");
      if (kind === "Ingreso") {
        await d.getByPlaceholder("0.00").fill("10");
      } else {
        await d.locator("select", { has: page.locator("option", { hasText: "Selecciona el WBS" }) }).selectOption({ index: 1 });
        await d.getByPlaceholder("Nombre del capataz o trabajador").fill("QA capataz");
      }
      await d.locator("textarea").last().fill(`${TAG} ${kind.toLowerCase()} ${RUN}`);
      await d.getByRole("button", { name: `Registrar ${kind.toLowerCase()}` }).click();
      const m = await waitFor(async () => db(`stock_movements?select=movement_type,quantity,unit_cost&notes=eq.${encodeURIComponent(`${TAG} ${kind.toLowerCase()} ${RUN}`)}`), (r) => r.length > 0);
      ok(`${kind.toLowerCase()} de almacén registrado`, m.length === 1, JSON.stringify(m[0]));
      await page.waitForTimeout(1500);
    }
    await shot(page, "8-almacen");
    await close();
  }
} catch (e) {
  fails++;
  console.log("✗ ERROR", e.message.split("\n")[0]);
} finally {
  await browser.close();
  if (errors.length) console.log("\nErrores de consola/página:\n" + [...new Set(errors)].join("\n"));
  console.log(`\n${fails ? `${fails} fallas` : "Todos los flujos OK"} · capturas en ${OUT}`);
}
