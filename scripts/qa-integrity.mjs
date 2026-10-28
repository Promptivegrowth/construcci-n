// QA de integridad: intenta, con la sesión de cada rol y llamando directo a la API (sin pasar por los botones),
// lo que la base debe impedir. También verifica la caja que salda comprobantes, el cierre de periodo y la
// importación de presupuesto. Todo lo creado lleva la marca [QA-E2E] y se elimina al final.
// Uso: node scripts/qa-integrity.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const TAG = "[QA-E2E]";
const RUN = Date.now().toString().slice(-6);
let fails = 0;
const ok = (label, cond, extra = "") => { if (!cond) fails++; console.log(`${cond ? "✓" : "✗ FALLA"} ${label}${extra ? ` · ${extra}` : ""}`); };
const blocked = (label, res) => ok(`bloqueado: ${label}`, !!res.error || (Array.isArray(res.data) && res.data.length === 0), res.error?.message?.slice(0, 140) ?? (res.data?.length === 0 ? "0 filas" : "¡PERMITIDO!"));
const allowed = (label, res) => ok(`permitido: ${label}`, !res.error, res.error?.message?.slice(0, 160) ?? "");

async function as(email) {
  const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: "GrupoCruz2026!" });
  if (error) throw error;
  return c;
}
const one = async (q) => { const { data, error } = await q; if (error) throw error; return data; };

const proj = await one(admin.from("projects").select("id, company_id, code").eq("code", "011-RLAL").single());
const leaves = await one(admin.from("wbs_nodes").select("id, code, phase_id, parent_id").eq("project_id", proj.id).eq("is_leaf", true).order("sort").limit(5));
const leaf = leaves[0];
const phase = leaf.phase_id ?? (await one(admin.from("phases").select("id").eq("project_id", proj.id).limit(1).single())).id;
const supplier = (await one(admin.from("suppliers").select("id").eq("company_id", proj.company_id).limit(1).single())).id;
const box = (await one(admin.from("cash_boxes").select("id").eq("project_id", proj.id).limit(1).single())).id;
const users = Object.fromEntries((await one(admin.from("profiles").select("id, email"))).map((p) => [p.email.split("@")[0], p.id]));

let n = 0;
const newExpense = async (status, extra = {}) => one(admin.from("expenses").insert({
  company_id: proj.company_id, project_id: proj.id, supplier_id: supplier, doc_type: "BV", series: "B0QA", doc_number: `${RUN}${n++}`,
  issue_date: extra.issue_date ?? "2026-10-20", total: extra.total ?? 118, currency: "PEN", tax_condition: "no_gravado", phase_id: phase, wbs_id: leaf.id,
  description: `${TAG} integridad ${RUN}`, status, origin: "obra", created_by: users.rquispe, ...(status === "aprobado" ? { approved_by: users.jcastillo, approved_at: new Date().toISOString() } : {}),
}).select("id, payable_pen").single());

try {
  const res = await as("rquispe@grupocruz.pe");
  const alm = await as("almacen@grupocruz.pe");
  const gp = await as("jcastillo@grupocruz.pe");
  const conta = await as("contabilidad@grupocruz.pe");

  console.log("\n— Aprobaciones solo por Gerencia");
  const e1 = await newExpense("declarado");
  blocked("residente se aprueba su propio gasto", await res.from("expenses").update({ status: "aprobado" }).eq("id", e1.id).select("id"));
  blocked("residente inserta un gasto ya aprobado", await res.from("expenses").insert({ company_id: proj.company_id, project_id: proj.id, supplier_id: supplier, doc_type: "TK", issue_date: "2026-10-20", total: 10, phase_id: phase, wbs_id: leaf.id, description: `${TAG} x`, status: "aprobado" }).select("id"));
  blocked("residente marca un gasto como pagado", await res.from("expenses").update({ status: "pagado" }).eq("id", e1.id).select("id"));
  blocked("almacén inserta una orden ya aprobada", await alm.from("orders").insert({ company_id: proj.company_id, project_id: proj.id, order_type: "OC", supplier_id: supplier, wbs_id: leaf.id, title: `${TAG} orden`, total: 100, status: "aprobada" }).select("id"));
  const o1 = await one(admin.from("orders").insert({ company_id: proj.company_id, project_id: proj.id, order_type: "OC", supplier_id: supplier, wbs_id: leaf.id, title: `${TAG} orden ${RUN}`, total: 100, status: "solicitada", requested_by: users.almacen }).select("id").single());
  blocked("almacén se aprueba su propia orden", await alm.from("orders").update({ status: "aprobada" }).eq("id", o1.id).select("id"));
  allowed("Gerencia aprueba la orden", await gp.from("orders").update({ status: "aprobada" }).eq("id", o1.id).select("id"));
  blocked("Gerencia cambia el monto de una orden aprobada", await gp.from("orders").update({ total: 999 }).eq("id", o1.id).select("id"));
  allowed("Gerencia aprueba el gasto declarado", await gp.from("expenses").update({ status: "aprobado" }).eq("id", e1.id).select("id"));
  blocked("Gerencia cambia el monto de un gasto aprobado", await gp.from("expenses").update({ total: 5000 }).eq("id", e1.id).select("id"));
  blocked("residente devuelve a declarado un gasto aprobado", await res.from("expenses").update({ status: "declarado" }).eq("id", e1.id).select("id"));
  blocked("residente anula un gasto aprobado", await res.from("expenses").update({ status: "anulado", void_reason: "x" }).eq("id", e1.id).select("id"));
  blocked("residente cambia la partida de un gasto aprobado", await res.from("expense_allocations").update({ wbs_id: leaves[1].id }).eq("expense_id", e1.id).select("expense_id"));

  console.log("\n— Pagos");
  allowed("Contabilidad paga 50%", await conta.from("payments").insert({ expense_id: e1.id, amount_pen: 59, paid_at: "2026-10-25", method: "transferencia", registered_by: users.contabilidad }).select("id"));
  const pay = await one(admin.from("payments").select("id").eq("expense_id", e1.id).single());
  blocked("Contabilidad cambia el monto de un pago", await conta.from("payments").update({ amount_pen: 1 }).eq("id", pay.id).select("id"));
  blocked("Contabilidad borra un pago", await conta.from("payments").delete().eq("id", pay.id).select("id"));
  allowed("Contabilidad anula el pago", await conta.from("payments").update({ voided: true, void_reason: `${TAG} prueba` }).eq("id", pay.id).select("id"));
  blocked("Contabilidad reactiva un pago anulado", await conta.from("payments").update({ voided: false }).eq("id", pay.id).select("id"));

  console.log("\n— Caja de obra");
  const fr = await one(admin.from("fund_requests").insert({ company_id: proj.company_id, project_id: proj.id, box_id: box, requested_by: users.rquispe, amount: 500, reason: `${TAG} fondos ${RUN}`, status: "pendiente" }).select("id, seq").single());
  blocked("residente marca su solicitud como depositada", await res.from("fund_requests").update({ status: "depositada" }).eq("id", fr.id).select("id"));
  blocked("residente se aprueba su solicitud", await res.from("fund_requests").update({ status: "aprobada" }).eq("id", fr.id).select("id"));
  blocked("residente inventa un ingreso de caja", await res.from("cash_movements").insert({ box_id: box, project_id: proj.id, movement_type: "ingreso", amount: 500, moved_at: "2026-10-27", concept: `${TAG} ingreso`, fund_request_id: fr.id }).select("id"));
  allowed("Gerencia aprueba la solicitud", await gp.from("fund_requests").update({ status: "aprobada" }).eq("id", fr.id).select("id"));
  blocked("Contabilidad deposita por fuera del flujo (ingreso sin depósito)", await conta.from("cash_movements").insert({ box_id: box, project_id: proj.id, movement_type: "ingreso", amount: 500, moved_at: "2026-10-27", concept: `${TAG} ingreso`, fund_request_id: fr.id }).select("id"));
  allowed("Contabilidad registra el depósito", await conta.rpc("deposit_fund_request", { p_request: fr.id, p_operation: `OP${RUN}`, p_date: "2026-10-26" }));
  blocked("doble depósito de la misma solicitud", await conta.rpc("deposit_fund_request", { p_request: fr.id, p_operation: `OP${RUN}`, p_date: "2026-10-26" }));
  const ingresos = await one(admin.from("cash_movements").select("id").eq("fund_request_id", fr.id).eq("movement_type", "ingreso"));
  ok("un solo ingreso en caja", ingresos.length === 1, `${ingresos.length}`);
  const ePaid = await newExpense("aprobado", { total: 50 });
  await one(admin.from("payments").insert({ expense_id: ePaid.id, amount_pen: 50, paid_at: "2026-10-26", method: "transferencia", registered_by: users.contabilidad }).select("id"));
  const eCash = await newExpense("aprobado", { total: 120 });
  const eDecl = await newExpense("declarado", { total: 80 });
  blocked("rendir un comprobante que Contabilidad ya pagó", await res.rpc("render_fund_request", { p_request: fr.id, p_expenses: [ePaid.id], p_extras: [] }));
  blocked("rendir con un egreso sin concepto", await res.rpc("render_fund_request", { p_request: fr.id, p_expenses: [], p_extras: [{ concept: "", amount: 50 }] }));
  allowed("residente rinde 2 comprobantes + 1 egreso", await res.rpc("render_fund_request", { p_request: fr.id, p_expenses: [eCash.id, eDecl.id], p_extras: [{ concept: `${TAG} pasajes`, amount: 30, date: "2026-10-26" }] }));
  const [c1] = await one(admin.from("expenses").select("status").eq("id", eCash.id));
  const cp = await one(admin.from("payments").select("amount_pen, method").eq("expense_id", eCash.id));
  ok("el comprobante aprobado rendido queda pagado con caja", c1.status === "pagado" && cp[0]?.method === "caja", `${c1.status} · ${JSON.stringify(cp)}`);
  blocked("Contabilidad paga por transferencia un comprobante ya pagado con caja", await conta.from("payments").insert({ expense_id: eCash.id, amount_pen: 10, method: "transferencia" }).select("id"));
  blocked("Contabilidad anula el pago con caja desde Pagos", await conta.from("payments").update({ voided: true, void_reason: "x" }).eq("expense_id", eCash.id).select("id"));
  allowed("Gerencia aprueba el comprobante declarado que ya se rindió", await gp.from("expenses").update({ status: "aprobado" }).eq("id", eDecl.id).select("id"));
  const [c2] = await one(admin.from("expenses").select("status").eq("id", eDecl.id));
  ok("al aprobarlo queda pagado con caja (no llega a Pagos)", c2.status === "pagado", c2.status);
  blocked("anular un comprobante rendido en caja", await gp.from("expenses").update({ status: "anulado", void_reason: "x" }).eq("id", eDecl.id).select("id"));
  blocked("residente borra un movimiento de caja", await res.from("cash_movements").delete().eq("fund_request_id", fr.id).select("id"));
  blocked("rendir dos veces la misma solicitud", await res.rpc("render_fund_request", { p_request: fr.id, p_expenses: [], p_extras: [{ concept: "otra", amount: 5 }] }));

  console.log("\n— Cierre de periodo");
  const eOld = await newExpense("declarado", { issue_date: "2026-08-10", total: 59 });
  const eOld2 = await newExpense("aprobado", { issue_date: "2026-08-12", total: 70 });
  const cl = await one(admin.from("period_closures").insert({ project_id: proj.id, period_start: "2026-08-01", period_end: "2026-08-31", label: `${TAG} agosto`, closed_by: users.gerencia }).select("id").single());
  blocked("redistribuir un gasto de un mes cerrado", await res.from("expense_allocations").update({ wbs_id: leaves[1].id }).eq("expense_id", eOld.id).select("expense_id"));
  blocked("cambiar el IGV/condición de un gasto de un mes cerrado", await res.from("expenses").update({ doc_type: "FT", tax_condition: "gravado" }).eq("id", eOld.id).select("id"));
  blocked("anular un gasto de un mes cerrado", await gp.from("expenses").update({ status: "anulado", void_reason: "x" }).eq("id", eOld2.id).select("id"));
  blocked("pago con fecha en un mes cerrado", await conta.from("payments").insert({ expense_id: eOld2.id, amount_pen: 10, paid_at: "2026-08-20", method: "transferencia" }).select("id"));
  allowed("pago con fecha de hoy de un gasto de un mes cerrado", await conta.from("payments").insert({ expense_id: eOld2.id, amount_pen: 10, paid_at: "2026-10-27", method: "transferencia" }).select("id"));
  const mat = await one(admin.from("materials").select("id").eq("company_id", proj.company_id).limit(1).single());
  blocked("ingreso de almacén con fecha en un mes cerrado", await alm.from("stock_movements").insert({ project_id: proj.id, material_id: mat.id, movement_type: "ingreso", quantity: 1, unit_cost: 5, moved_at: "2026-08-15", responsible_name: "QA", notes: `${TAG} almacen` }).select("id"));
  blocked("Gerente de Proyectos reabre el periodo (solo Gerencia General)", await gp.from("period_closures").delete().eq("id", cl.id).select("id"));
  await admin.from("period_closures").delete().eq("id", cl.id);

  console.log("\n— Importación de presupuesto");
  const before = (await one(admin.from("wbs_nodes").select("id").eq("project_id", proj.id))).length;
  const r = await gp.rpc("import_budget", { p_project: proj.id, p_rows: [
    { code: `QA${RUN}`, name: `${TAG} nueva`, parent: null, level: 1, phase: null, costCenter: null, costType: null, budget: 0, margin: 0 },
    { code: `${leaf.code}.99`, name: `${TAG} subdivide`, parent: leaf.code, level: 3, phase: null, costCenter: null, costType: null, budget: 100, margin: 0 },
  ] });
  blocked("subdividir una partida con gastos", r);
  ok("mensaje claro de la partida bloqueada", /no se pueden subdividir/.test(r.error?.message ?? ""), r.error?.message?.slice(0, 120));
  const after = (await one(admin.from("wbs_nodes").select("id").eq("project_id", proj.id))).length;
  ok("la importación fallida no deja partidas a medias", after === before, `${before} → ${after}`);
  blocked("residente importa un presupuesto", await res.rpc("import_budget", { p_project: proj.id, p_rows: [] }));

  console.log("\n— Valorizaciones");
  const v = await one(admin.from("valuations").select("id, status").eq("project_id", proj.id).eq("status", "cobrada").limit(1).single());
  blocked("volver a aprobar una valorización cobrada", await gp.from("valuations").update({ status: "aprobada", approved_amount: 1 }).eq("id", v.id).select("id"));

  console.log("\n— Funciones internas");
  blocked("residente inyecta una alerta (upsert_alert)", await res.rpc("upsert_alert", { p_company: proj.company_id, p_project: proj.id, p_type: "x", p_severity: "danger", p_title: "x", p_message: "x", p_entity_type: "x", p_entity: proj.id }));
} catch (e) {
  fails++;
  console.log("✗ ERROR", e.message);
} finally {
  // Limpieza (rol de servicio)
  const exps = (await admin.from("expenses").select("id").like("description", `${TAG}%`)).data ?? [];
  const ids = exps.map((e) => e.id);
  const frs = ((await admin.from("fund_requests").select("id").like("reason", `${TAG}%`)).data ?? []).map((f) => f.id);
  if (frs.length) await admin.from("cash_movements").delete().in("fund_request_id", frs);
  if (ids.length) {
    await admin.from("cash_movements").delete().in("expense_id", ids);
    await admin.from("payments").delete().in("expense_id", ids);
    await admin.from("expense_allocations").delete().in("expense_id", ids);
    await admin.from("expense_files").delete().in("expense_id", ids);
    await admin.from("expenses").delete().in("id", ids);
  }
  if (frs.length) await admin.from("fund_requests").delete().in("id", frs);
  await admin.from("orders").delete().like("title", `${TAG}%`);
  await admin.from("stock_movements").delete().like("notes", `${TAG}%`);
  await admin.from("period_closures").delete().like("label", `${TAG}%`);
  await admin.from("wbs_nodes").delete().like("name", `${TAG}%`);
  await admin.rpc("refresh_project_alerts", { p_project: proj.id });
  console.log(`\nlimpieza: ${ids.length} gastos y ${frs.length} solicitudes de prueba eliminados`);
  console.log(fails ? `${fails} fallas` : "Todas las reglas de integridad OK");
}
