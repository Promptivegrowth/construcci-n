// Siembra completa de la plataforma Grupo Cruz.
// Uso: node scripts/seed.mjs   (borra la data existente y vuelve a sembrar; es determinista)
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { sql } from "./db-migrate.mjs";
import { COMPANIES, USERS, SUPPLIERS, MATERIALS, EQUIPMENT, WORKERS, TODAY, PASSWORD } from "./seed-data.mjs";
import { PROJECTS } from "./seed-projects.mjs";

config({ path: ".env.local", override: true, quiet: true });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------- utilidades
let _s = 20260127;
const rnd = () => {
  _s |= 0; _s = (_s + 0x6d2b79f5) | 0;
  let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const between = (a, b) => a + rnd() * (b - a);
const int = (a, b) => Math.floor(between(a, b + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const chance = (p) => rnd() < p;
const r2 = (n) => Math.round(n * 100) / 100;
const d2n = (s) => Math.floor(Date.parse(`${s}T12:00:00Z`) / 86400000);
const n2d = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
const addDays = (s, n) => n2d(d2n(s) + n);
const minD = (a, b) => (a < b ? a : b);
const maxD = (a, b) => (a > b ? a : b);
const ts = (date, h = int(8, 18), m = int(0, 59)) => `${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00-05:00`;
const dow = (s) => new Date(`${s}T12:00:00Z`).getUTCDay();

function split(total, n, shape = "flat") {
  if (n <= 1) return [r2(total)];
  const w = Array.from({ length: n }, (_, i) => {
    const base = shape === "bell" ? 0.45 + Math.sin(((i + 0.5) / n) * Math.PI) : 1;
    return base * between(0.75, 1.25);
  });
  const sum = w.reduce((a, b) => a + b, 0);
  const parts = w.map((x) => r2((total * x) / sum));
  parts[n - 1] = r2(total - parts.slice(0, -1).reduce((a, b) => a + b, 0));
  return parts;
}

async function insert(table, rows, chunk = 400) {
  for (let i = 0; i < rows.length; i += chunk) {
    const { error } = await sb.from(table).insert(rows.slice(i, i + chunk), { defaultToNull: false });
    if (error) throw new Error(`${table}: ${error.message} ${error.details ?? ""}`);
  }
  return rows;
}
const log = (...a) => console.log("•", ...a);

// ---------------------------------------------------------------- reinicio
async function reset() {
  log("Limpiando data previa…");
  await sql("truncate public.companies, public.audit_log, public.alerts restart identity cascade;");
  const { data: list } = await sb.auth.admin.listUsers({ perPage: 200 });
  for (const u of list?.users ?? []) if (u.email?.endsWith("@grupocruz.pe")) await sb.auth.admin.deleteUser(u.id);
  for (const c of (await sb.storage.from("evidencias").list("", { limit: 100 })).data ?? []) {
    await removeFolder(c.name);
  }
}
async function removeFolder(prefix) {
  const { data } = await sb.storage.from("evidencias").list(prefix, { limit: 1000 });
  for (const item of data ?? []) {
    const path = `${prefix}/${item.name}`;
    if (item.id) await sb.storage.from("evidencias").remove([path]);
    else await removeFolder(path);
  }
}

// ---------------------------------------------------------------- seed
const ids = { users: {}, companies: {}, suppliers: {}, materials: {}, projects: {} };
const expenses = [];
const payments = [];
const payrolls = [];
const payrollLines = [];
const docCounters = {};

function nextDoc(companyId, supplierKey, docType) {
  const k = `${companyId}|${supplierKey}|${docType}`;
  if (!docCounters[k]) {
    const series = docType === "BV" ? pick(["B001", "B002", "EB01"]) : docType === "RH" ? "E001" : docType === "TK" ? pick(["T001", "0001"]) : pick(["F001", "F002", "E001", "FF01"]);
    docCounters[k] = { series, n: int(120, 9000) };
  }
  const c = docCounters[k];
  c.n += int(1, 37);
  return { series: c.series, number: String(c.n).padStart(docType === "TK" ? 6 : 7, "0") };
}

const OBSERVATIONS = [
  "Adjuntar guía de remisión firmada por almacén.",
  "La foto del comprobante no es legible; volver a subir.",
  "El monto no coincide con la orden de compra; sustentar diferencia.",
  "Falta el visto bueno del residente en el comprobante.",
];
const CATEGORY = {
  mano_obra: "PLANILLA OBREROS", alquileres: "ALQUILER EQUIPOS", transporte: "SERVICIO TRANSPORTE",
  materiales: "COMPRAS PROVEEDORES", seguridad: "SEGURIDAD", servicios: "SERVICIOS",
  gastos_generales: "GASTOS GENERALES", contingencias: "CONTINGENCIAS",
};

function docTypeFor(pool, forced) {
  if (forced) return forced;
  if (pool === "planilla") return "PL";
  if (pool === "transporte_rh" || pool === "honorarios") return "RH";
  if (pool === "campo") return chance(0.55) ? "BV" : chance(0.5) ? "TK" : "FT";
  if (pool === "combustible") return chance(0.7) ? "FT" : "TK";
  return "FT";
}

function decideStatus(date, ctx) {
  const age = d2n(TODAY) - d2n(date);
  if (ctx.allPaid || ctx.closed) return "pagado";
  if (age > 32) return chance(0.06) ? "pagado_parcial" : "pagado";
  if (age > 16) return pick(["pagado", "pagado", "pagado", "pagado_parcial", "aprobado"]);
  if (age > 6) return pick(["pagado", "pagado_parcial", "aprobado", "aprobado", "declarado"]);
  return pick(["aprobado", "declarado", "declarado", "observado"]);
}

function makeExpense(p, leaf, o) {
  const doc_type = o.doc_type;
  const tax = doc_type === "FT" ? "gravado" : "no_gravado";
  const total = doc_type === "FT" ? r2(o.cost * 1.18) : r2(o.cost);
  const retention_pct = o.retention ?? 0;
  const payable = r2(total - r2((total * retention_pct) / 100));
  const doc = doc_type === "PL" ? { series: null, number: o.docNumber ?? null } : o.series ? { series: o.series, number: o.docNumber } : nextDoc(p.company_id, o.supplier, doc_type);
  const reception = doc_type === "PL" || doc_type === "BV" || doc_type === "TK" ? o.date : minD(addDays(o.date, int(0, 3)), TODAY);
  const credit = ["alquileres", "materiales", "contingencias"].includes(leaf.type) && doc_type === "FT" ? 30 : doc_type === "FT" ? 15 : 0;
  const status = o.status;
  const approvedAt = ["aprobado", "pagado_parcial", "pagado"].includes(status) ? minD(addDays(reception, int(1, 3)), TODAY) : null;
  const creator = o.origin === "lima" ? ids.users.contabilidad : o.creator;
  const e = {
    id: randomUUID(),
    company_id: p.company_id,
    project_id: p.id,
    seq: ++p._seq,
    wbs_id: leaf.id,
    phase_id: leaf.phase_id ?? p.phaseByDate(o.date),
    supplier_id: ids.suppliers[p.companyCode][o.supplier],
    category: o.category ?? (o.origin === "campo" ? "CAJA CHICA" : CATEGORY[leaf.type] ?? "COMPRAS PROVEEDORES"),
    description: o.description,
    doc_type,
    series: doc.series,
    doc_number: doc.number,
    issue_date: o.date,
    reception_date: reception,
    due_date: credit ? addDays(reception, credit) : reception,
    currency: "PEN",
    exchange_rate: 1,
    tax_condition: tax,
    total,
    retention_pct,
    order_id: null,
    origin: o.origin ?? "obra",
    status: ["pagado", "pagado_parcial"].includes(status) ? "aprobado" : status,
    created_by: creator,
    declared_at: status === "borrador" ? null : ts(reception),
    approved_by: approvedAt ? (chance(0.85) ? ids.users.jcastillo : ids.users.gerencia) : null,
    approved_at: approvedAt ? ts(approvedAt, int(9, 19)) : null,
    observation: status === "observado" ? pick(OBSERVATIONS) : null,
    lat: o.origin === "campo" ? p.lat + between(-0.004, 0.004) : null,
    lng: o.origin === "campo" ? p.lng + between(-0.004, 0.004) : null,
    created_at: ts(reception),
    _cost: r2(o.cost),
    _payable: payable,
    _final: status,
    _leaf: leaf,
    _project: p,
    _supplierKey: o.supplier,
  };
  expenses.push(e);
  return e;
}

function planPayments(e, forcedPaid) {
  const status = e._final;
  if (!["pagado", "pagado_parcial"].includes(status)) return;
  const base = e.approved_at.slice(0, 10);
  let first = minD(addDays(base, int(2, e.doc_type === "PL" ? 3 : 20)), TODAY);
  const bank = pick(["BCP", "BCP", "BBVA", "Interbank", "Scotiabank"]);
  const add = (date, amount) => payments.push({
    id: randomUUID(), expense_id: e.id, paid_at: date, amount_pen: r2(amount),
    method: e.doc_type === "PL" ? "transferencia" : pick(["transferencia", "transferencia", "transferencia", "cheque"]),
    bank, operation_number: String(int(10000000, 99999999)), registered_by: ids.users.contabilidad,
    notes: e.doc_type === "PL" ? "Pago de haberes" : null, created_at: ts(date, int(9, 18)),
  });
  if (forcedPaid !== undefined) {
    if (forcedPaid > 0.004) add(first, forcedPaid);
    return;
  }
  if (status === "pagado_parcial") {
    add(first, e._payable * pick([0.5, 0.4, 0.6]));
  } else if (chance(0.18) && e._payable > 3000) {
    const second = minD(addDays(first, int(10, 25)), TODAY);
    add(first, r2(e._payable / 2));
    add(second, r2(e._payable - r2(e._payable / 2)));
  } else add(first, e._payable);
}

// Ajusta pagos para que la hoja cumpla el monto pagado exacto (historias de conciliación)
function enforcePaidTarget(list, paidTarget) {
  const total = list.reduce((a, e) => a + e._cost, 0);
  let unpaid = r2(total - paidTarget);
  const sorted = [...list].sort((a, b) => (a.issue_date < b.issue_date ? 1 : -1));
  const forced = new Map();
  for (const e of sorted) {
    if (unpaid <= 0.004) { e._final = "pagado"; continue; }
    if (e._cost <= unpaid + 0.004) {
      e._final = chance(0.5) ? "aprobado" : "declarado";
      unpaid = r2(unpaid - e._cost);
    } else {
      e._final = "pagado_parcial";
      const paidCost = r2(e._cost - unpaid);
      forced.set(e.id, r2((paidCost / e._cost) * e._payable));
      unpaid = 0;
    }
  }
  for (const e of list) {
    e.status = ["pagado", "pagado_parcial"].includes(e._final) ? "aprobado" : e._final;
    if (["pagado", "pagado_parcial", "aprobado"].includes(e._final) && !e.approved_at) {
      const d = minD(addDays(e.reception_date, 2), TODAY);
      e.approved_at = ts(d, 10); e.approved_by = ids.users.jcastillo;
    }
    if (e._final === "declarado") { e.approved_at = null; e.approved_by = null; }
  }
  return forced;
}

// ------------------------------------------------------- generadores por hoja
const CAT_RATIO = { capataz: 0.05, operario: 0.5, oficial: 0.29, peon: 0.16 };
const CAT_RATE = { capataz: 2150, operario: 820, oficial: 690, peon: 600 };

function payrollLinesFor(amount, opts = {}) {
  let parts;
  if (opts.exact) parts = opts.exact;
  else {
    const capataz = opts.capataz ? Math.min(opts.capataz * between(0.97, 1.03), amount * 0.2) : amount * CAT_RATIO.capataz * between(0.85, 1.15);
    const rest = amount - capataz;
    const w = { operario: 0.5 * between(0.93, 1.07), oficial: 0.29 * between(0.9, 1.1), peon: 0.16 * between(0.9, 1.1) };
    const ws = w.operario + w.oficial + w.peon;
    const op = r2((rest * w.operario) / ws), of = r2((rest * w.oficial) / ws);
    parts = { capataz: r2(capataz), operario: op, oficial: of, peon: r2(amount - r2(capataz) - op - of) };
  }
  return Object.entries(parts).filter(([, v]) => v > 0).map(([category, amt]) => ({
    category, amount: amt, workers: Math.max(1, Math.round(amt / CAT_RATE[category])), days: 6,
  }));
}

function genPayroll(p, leaf, g) {
  const weeks = [];
  if (g.fixedWeeks) for (const [w, a] of Object.entries(g.fixedWeeks)) weeks.push({ week: +w, amount: a });
  else {
    const [a, b] = g.weeks;
    const amounts = split(g.target, b - a + 1, "bell");
    for (let w = a; w <= b; w++) weeks.push({ week: w, amount: amounts[w - a] });
  }
  for (const [w, a, st] of g.extraWeeks ?? []) weeks.push({ week: w, amount: a, status: st });
  const list = [];
  const valid = weeks.filter((w) => addDays(p.start, 7 * w.week - 1) <= TODAY);
  valid.forEach((w, i) => {
    const date = addDays(p.start, 7 * w.week - 1);
    const fromEnd = valid.length - i;
    let status = w.status ?? (p.closed ? "pagado" : "pagado");
    if (!w.status && g.declaredWeeks && fromEnd <= g.declaredWeeks) status = "declarado";
    else if (!w.status && g.unpaidWeeks && fromEnd <= (g.declaredWeeks ?? 0) + g.unpaidWeeks) status = "aprobado";
    const e = makeExpense(p, leaf, {
      date, cost: w.amount, doc_type: "PL", supplier: "pl_obreros", status, creator: p.adminUser ?? p.residentUser,
      description: `Planilla de obreros — Semana N° ${w.week}`, docNumber: `S${String(w.week).padStart(2, "0")}-2026`, category: "PLANILLA OBREROS",
    });
    e.reception_date = date; e.due_date = date;
    list.push(e);
    const exact = w.week === 21 && g.fixedWeeks ? { capataz: 1629, operario: 21666, oficial: 13357, peon: r2(w.amount - 1629 - 21666 - 13357) } : null;
    const pr = {
      id: randomUUID(), company_id: p.company_id, project_id: p.id, payroll_type: "obreros", week: w.week,
      period_label: `Semana N° ${w.week}`, period_start: addDays(date, -6), period_end: date,
      phase_id: e.phase_id, wbs_id: leaf.id, total: w.amount, expense_id: e.id, created_by: ids.users.contabilidad, created_at: ts(date, 17),
    };
    payrolls.push(pr);
    for (const l of payrollLinesFor(w.amount, { exact, capataz: g.capataz })) payrollLines.push({ id: randomUUID(), payroll_id: pr.id, ...l });
  });
  return list;
}

function genStaff(p, leaf, g) {
  const months = g.months ?? [];
  if (!g.months) {
    let d = g.from;
    const until = g.until ?? TODAY;
    while (d <= until) {
      const label = new Date(`${d}T12:00:00Z`).toLocaleDateString("es-PE", { month: "long", timeZone: "UTC" });
      months.push([d, r2(g.monthly * between(0.98, 1.02)), `${g.label ?? "Planilla staff"} — ${label[0].toUpperCase()}${label.slice(1)}`]);
      const next = new Date(`${d}T12:00:00Z`);
      next.setUTCDate(1); next.setUTCMonth(next.getUTCMonth() + 2); next.setUTCDate(0);
      d = next.toISOString().slice(0, 10);
    }
  }
  return months.map(([date, amount, desc]) => {
    const e = makeExpense(p, leaf, {
      date, cost: amount, doc_type: "PL", supplier: "pl_staff", status: date > addDays(TODAY, -3) && !p.closed ? "aprobado" : "pagado",
      creator: ids.users.contabilidad, description: desc, docNumber: `ST-${date.slice(0, 7)}`, category: "PLANILLA STAFF",
    });
    const pr = {
      id: randomUUID(), company_id: p.company_id, project_id: p.id, payroll_type: /CTS/.test(desc) ? "cts" : /Gratific/.test(desc) ? "gratificacion" : "staff",
      week: null, period_label: desc.replace(/^Planilla (staff|de técnicos) — /, ""), period_start: date.slice(0, 8) + "01", period_end: date,
      phase_id: e.phase_id, wbs_id: leaf.id, total: amount, expense_id: e.id, created_by: ids.users.contabilidad, created_at: ts(date, 16),
    };
    payrolls.push(pr);
    payrollLines.push({ id: randomUUID(), payroll_id: pr.id, category: "staff", workers: Math.max(2, Math.round(amount / 4200)), days: 30, amount });
    return e;
  });
}

function genList(p, leaf, g) {
  return g.items.map(([date, supplier, description, cost, doc, series, number]) =>
    makeExpense(p, leaf, {
      date, supplier, description, cost, doc_type: doc ?? "FT", series, docNumber: number,
      status: p.closed ? "pagado" : decideStatus(date, { allPaid: date < addDays(TODAY, -6) }),
      creator: pick([p.adminUser, p.residentUser].filter(Boolean)),
    }));
}

function genGeneric(p, leaf, g) {
  const from = maxD(leaf._from, p.start);
  const to = minD(g.until ?? leaf._to, TODAY);
  const n = g.n;
  const amounts = split(g.target, n);
  const span = Math.max(1, d2n(to) - d2n(from));
  const dates = Array.from({ length: n }, (_, i) => addDays(from, Math.round(((i + between(0.1, 0.9)) / n) * span))).map((d) => minD(d, to)).sort();
  const list = dates.map((date, i) => {
    const supplier = pick(g.pool);
    const sup = SUPPLIERS.find((s) => s.key === supplier);
    let doc_type = docTypeFor(sup.pool);
    const origin = g.campo ? "campo" : "obra";
    let cost = amounts[i];
    return makeExpense(p, leaf, {
      date, supplier, cost, doc_type, origin, retention: g.retention,
      description: pick(g.desc), status: p.closed ? "pagado" : decideStatus(date, { allPaid: g.allPaid }),
      creator: origin === "campo" ? (p.residentUser ?? p.adminUser) : pick([p.adminUser, p.residentUser].filter(Boolean)),
    });
  });
  for (const [date, supplier, description, cost] of g.extra ?? []) {
    list.push(makeExpense(p, leaf, { date, supplier, description, cost, doc_type: "FT", status: decideStatus(date, {}), creator: p.adminUser }));
  }
  for (const [date, supplier, description, cost] of g.lima ?? []) {
    const e = makeExpense(p, leaf, { date, supplier, description, cost, doc_type: "FT", status: "pagado", origin: "lima" });
    e._lima = true;
  }
  return list;
}

// ---------------------------------------------------------------- recibos (foto)
function esc(s) { return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function receiptSvg(e, supplier, company) {
  const title = { FT: "FACTURA ELECTRÓNICA", BV: "BOLETA DE VENTA ELECTRÓNICA", RH: "RECIBO POR HONORARIOS ELECTRÓNICO", TK: "TICKET DE VENTA", OT: "COMPROBANTE" }[e.doc_type] ?? "COMPROBANTE";
  const rot = between(-3.2, 3.2).toFixed(2);
  const sub = e.doc_type === "FT" ? r2(e.total / 1.18) : e.total;
  const igv = e.doc_type === "FT" ? r2(e.total - sub) : 0;
  const money = (n) => n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const lines = (e.description.match(/.{1,46}(\s|$)/g) ?? [e.description]).slice(0, 3);
  let qr = "";
  for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) if (chance(0.48) || (x < 7 && y < 7 && (x % 6 === 0 || y % 6 === 0 || (x > 1 && x < 5 && y > 1 && y < 5))))
    qr += `<rect x="${620 + x * 7}" y="${958 + y * 7}" width="7" height="7"/>`;
  const bg = pick([["#8a6f53", "#6d553f"], ["#9aa3ad", "#7b8590"], ["#b59b7c", "#8c7559"], ["#5f6b74", "#465159"]]);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200">
  <defs><linearGradient id="t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient>
  <filter id="s"><feDropShadow dx="6" dy="10" stdDeviation="12" flood-opacity="0.45"/></filter></defs>
  <rect width="900" height="1200" fill="url(#t)"/>
  <g transform="rotate(${rot} 450 600)" filter="url(#s)" font-family="Arial, Helvetica, sans-serif" fill="#1f2328">
    <rect x="80" y="70" width="740" height="1060" rx="4" fill="#fbfaf6"/>
    <text x="110" y="135" font-size="25" font-weight="700">${esc(supplier.name.slice(0, 40))}</text>
    <text x="110" y="168" font-size="17" fill="#555">RUC ${esc(supplier.ruc)} · Av. Principal ${int(100, 999)} — ${esc(e._project.region)}</text>
    <rect x="520" y="200" width="270" height="120" fill="none" stroke="#1f2328" stroke-width="2"/>
    <text x="655" y="238" font-size="16" font-weight="700" text-anchor="middle">${title}</text>
    <text x="655" y="268" font-size="15" text-anchor="middle">RUC ${esc(supplier.ruc)}</text>
    <text x="655" y="300" font-size="22" font-weight="700" text-anchor="middle">${esc(e.series)}-${esc(e.doc_number)}</text>
    <text x="110" y="240" font-size="16">Fecha de emisión: ${e.issue_date.split("-").reverse().join("/")}</text>
    <text x="110" y="270" font-size="16">Señor(es): ${esc(company.legal_name.slice(0, 30))}</text>
    <text x="110" y="300" font-size="16">RUC: ${esc(company.ruc)}   Moneda: SOLES</text>
    <text x="110" y="330" font-size="16">Obra: ${esc(e._project.code)} — ${esc(e._project.short_name)}</text>
    <line x1="110" y1="370" x2="790" y2="370" stroke="#1f2328" stroke-width="2"/>
    <text x="110" y="398" font-size="15" font-weight="700">CANT.</text><text x="190" y="398" font-size="15" font-weight="700">DESCRIPCIÓN</text>
    <text x="790" y="398" font-size="15" font-weight="700" text-anchor="end">IMPORTE</text>
    <line x1="110" y1="412" x2="790" y2="412" stroke="#999"/>
    <text x="110" y="448" font-size="17">1.00</text>
    ${lines.map((l, i) => `<text x="190" y="${448 + i * 28}" font-size="17">${esc(l.trim())}</text>`).join("")}
    <text x="790" y="448" font-size="17" text-anchor="end">${money(sub)}</text>
    <line x1="110" y1="820" x2="790" y2="820" stroke="#999"/>
    ${e.doc_type === "FT" ? `<text x="560" y="858" font-size="17">OP. GRAVADA</text><text x="790" y="858" font-size="17" text-anchor="end">S/ ${money(sub)}</text>
    <text x="560" y="888" font-size="17">IGV 18%</text><text x="790" y="888" font-size="17" text-anchor="end">S/ ${money(igv)}</text>` : ""}
    <text x="560" y="922" font-size="20" font-weight="700">TOTAL</text><text x="790" y="922" font-size="20" font-weight="700" text-anchor="end">S/ ${money(e.total)}</text>
    <g fill="#1f2328">${qr}</g>
    <text x="110" y="960" font-size="14" fill="#666">Representación impresa del comprobante electrónico.</text>
    <text x="110" y="985" font-size="14" fill="#666">Condición: ${e.due_date > e.issue_date ? "Crédito" : "Contado"} · Vence ${e.due_date.split("-").reverse().join("/")}</text>
    <text x="110" y="1090" font-size="13" fill="#888">Hash: ${randomUUID().replace(/-/g, "").slice(0, 28)}</text>
  </g></svg>`;
}

async function uploadReceipts(list) {
  let done = 0;
  const queue = [...list];
  const worker = async () => {
    while (queue.length) {
      const e = queue.shift();
      const supplier = SUPPLIERS.find((s) => s.key === e._supplierKey);
      const company = COMPANIES.find((c) => c.code === e._project.companyCode);
      const buf = await sharp(Buffer.from(receiptSvg(e, supplier, company))).resize(720).jpeg({ quality: 68, mozjpeg: true }).toBuffer();
      const path = `${e.company_id}/${e.project_id}/comprobantes/${e.id}.jpg`;
      const { error } = await sb.storage.from("evidencias").upload(path, buf, { contentType: "image/jpeg", upsert: true });
      if (error) throw new Error(`upload: ${error.message}`);
      files.push({ id: randomUUID(), expense_id: e.id, file_path: path, file_name: `${e.series}-${e.doc_number}.jpg`, mime: "image/jpeg",
        size_bytes: buf.length, lat: e.lat, lng: e.lng, captured_at: e.created_at, uploaded_by: e.created_by, created_at: e.created_at });
      if (++done % 100 === 0) log(`  ${done}/${list.length} comprobantes fotografiados`);
    }
  };
  const files = [];
  await Promise.all(Array.from({ length: 8 }, worker));
  await insert("expense_files", files);
}

function signatureSvg() {
  let d = `M ${int(10, 30)} ${int(40, 60)}`;
  let x = 30;
  for (let i = 0; i < 7; i++) { x += int(25, 45); d += ` C ${x - 30} ${int(5, 80)}, ${x - 10} ${int(5, 80)}, ${x} ${int(30, 60)}`; }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="90"><path d="${d}" fill="none" stroke="#0b2545" stroke-width="2.4" stroke-linecap="round"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function haversine(a, b, c, d) {
  const R = 6371000, toR = (x) => (x * Math.PI) / 180;
  const dLat = toR(c - a), dLng = toR(d - b);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a)) * Math.cos(toR(c)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ======================================================================
async function main() {
  await reset();

  log("Usuarios y empresas…");
  for (const u of USERS) {
    const { data, error } = await sb.auth.admin.createUser({
      email: u.email, password: PASSWORD, email_confirm: true,
      user_metadata: { full_name: u.full_name, position: u.position, phone: u.phone, dni: u.dni, avatar_color: u.avatar_color, is_holding_admin: u.is_holding_admin ?? false },
    });
    if (error) throw new Error(`user ${u.email}: ${error.message}`);
    ids.users[u.key] = data.user.id;
  }
  await sql(`update public.profiles set last_seen_at = now() - (random() * interval '3 days')`);
  const companyRows = COMPANIES.map((c) => ({ id: randomUUID(), ...c }));
  await insert("companies", companyRows);
  for (const c of companyRows) ids.companies[c.code] = c.id;

  log("Proveedores, materiales y equipos…");
  const supplierRows = [];
  for (const code of ["01", "02"]) {
    ids.suppliers[code] = {};
    for (const s of SUPPLIERS) {
      const id = randomUUID();
      ids.suppliers[code][s.key] = id;
      supplierRows.push({ id, company_id: ids.companies[code], ruc: s.ruc, name: s.name, kind: s.kind, bank: s.bank,
        account_number: s.pool === "planilla" ? null : `${int(100, 999)}-${int(1000000, 9999999)}-0-${int(10, 99)}`,
        phone: s.pool === "planilla" ? null : `9${int(10000000, 99999999)}`, email: s.pool === "planilla" ? null : `facturacion@${s.key}.com.pe` });
    }
  }
  await insert("suppliers", supplierRows);
  const materialRows = [];
  for (const code of ["01", "02"]) {
    ids.materials[code] = {};
    for (const m of MATERIALS) {
      const id = randomUUID();
      ids.materials[code][m.code] = id;
      materialRows.push({ id, company_id: ids.companies[code], code: m.code, name: m.name, unit: m.unit, category: m.category, min_stock: m.min_stock });
    }
  }
  await insert("materials", materialRows);

  log("Obras, fases y WBS…");
  const projectRows = [], phaseRows = [], wbsRows = [], budgetChanges = [], laborRows = [];
  for (const spec of PROJECTS) {
    const id = randomUUID();
    const p = {
      ...spec, id, company_id: ids.companies[spec.company], companyCode: spec.company, _seq: 0,
      adminUser: spec.admin ? ids.users[spec.admin] : null, residentUser: spec.resident ? ids.users[spec.resident] : null,
      closed: spec.status === "cancelada" || spec.status === "cerrada", phaseIds: {}, leaves: [], wbsByCode: {},
    };
    ids.projects[spec.code] = p;
    projectRows.push({
      id, company_id: p.company_id, code: spec.code, name: spec.name, short_name: spec.short_name, client_name: spec.client_name, client_ruc: spec.client_ruc,
      project_type: spec.project_type, location: spec.location, address: spec.address, region: spec.region,
      manager_id: ids.users[spec.manager], admin_id: p.adminUser, resident_id: p.residentUser,
      start_date: spec.start, end_date: spec.end, extended_end_date: spec.extended ?? null, exchange_rate: spec.tc, contract_amount: spec.contract,
      lat: spec.lat, lng: spec.lng, geofence_radius: spec.project_type === "edificacion" ? 150 : 400, status: spec.status,
      closed_at: spec.cancelledAt ? ts(spec.cancelledAt, 11) : null, created_by: ids.users.jcastillo, created_at: ts(addDays(spec.start, -14), 10),
    });
    for (const [i, ph] of spec.phases.entries()) {
      const pid = randomUUID();
      p.phaseIds[ph.code] = pid;
      phaseRows.push({ id: pid, project_id: id, code: ph.code, name: ph.name, sort: i + 1, start_date: ph.start, end_date: ph.end, color: ph.color, sale_amount: ph.sale });
    }
    p.phaseByDate = (date) => {
      let found = spec.phases[0];
      for (const ph of spec.phases) if (date >= ph.start) found = ph;
      return p.phaseIds[found.code];
    };
    let sort = 0;
    const walk = (nodes, parent, level, inheritedPhase) => {
      for (const n of nodes) {
        const wid = randomUUID();
        const phaseCode = n.phase ?? inheritedPhase;
        const leaf = !n.children;
        const finalBudget = leaf ? r2((n.change ? n.importBudget ?? n.budget : n.budget) + (n.change?.amount ?? 0)) : 0;
        const row = { id: wid, project_id: id, parent_id: parent, code: n.code, name: n.name, level, phase_id: phaseCode ? p.phaseIds[phaseCode] : null,
          cost_type: n.type ?? null, budget: finalBudget, margin: n.margin ?? 0, is_leaf: leaf, sort: ++sort, cost_center: n.cc ?? null };
        wbsRows.push(row);
        p.wbsByCode[n.code] = { ...row, ...n, id: wid };
        if (leaf) {
          const ph = spec.phases.find((x) => x.code === phaseCode);
          const leafObj = { ...row, type: n.type, gen: n.gen, _from: ph?.start ?? spec.start, _to: ph?.end ?? spec.extended ?? spec.end };
          p.leaves.push(leafObj);
          p.wbsByCode[n.code] = leafObj;
          const importAmount = n.change ? n.importBudget ?? n.budget : finalBudget;
          budgetChanges.push({ id: randomUUID(), project_id: id, wbs_id: wid, change_type: "importacion", amount: importAmount, previous_budget: 0, new_budget: importAmount,
            reason: "Importación del presupuesto aprobado con el cliente (Excel)", created_by: ids.users.jcastillo, created_at: ts(addDays(spec.start, -10), 11) });
          if (n.change) budgetChanges.push({ id: randomUUID(), project_id: id, wbs_id: wid, change_type: n.change.type, amount: n.change.amount,
            previous_budget: importAmount, new_budget: finalBudget, reason: n.change.reason, created_by: ids.users.jcastillo, created_at: ts(n.change.date, 15) });
        } else walk(n.children, wid, level + 1, phaseCode);
      }
    };
    walk(spec.wbs, null, 1, null);
    for (const [phase, cats] of Object.entries(spec.labor ?? {}))
      for (const [category, amount] of Object.entries(cats))
        if (amount > 0) laborRows.push({ id: randomUUID(), project_id: id, phase_id: p.phaseIds[phase], category, amount, workers: Math.max(1, Math.round(amount / (CAT_RATE[category] * 20))) });
  }
  await insert("projects", projectRows);
  await insert("phases", phaseRows);
  for (let lvl = 1; lvl <= 3; lvl++) await insert("wbs_nodes", wbsRows.filter((w) => w.level === lvl));
  await insert("budget_changes", budgetChanges);
  await insert("labor_projections", laborRows);

  log("Miembros por empresa y obra…");
  const members = [], projectMembers = [];
  for (const u of USERS) for (const m of u.memberships) {
    members.push({ company_id: ids.companies[m.company], user_id: ids.users[u.key], role: m.role, all_projects: !m.projects });
    for (const code of m.projects ?? []) projectMembers.push({ project_id: ids.projects[code].id, user_id: ids.users[u.key] });
  }
  await insert("company_members", members);
  await insert("project_members", projectMembers);

  log("Comprobantes, planillas y órdenes…");
  for (const p of Object.values(ids.projects)) {
    for (const leaf of p.leaves) {
      const g = leaf.gen;
      let list = [];
      if (g.kind === "payroll") list = genPayroll(p, leaf, g);
      else if (g.kind === "staff") list = genStaff(p, leaf, g);
      else if (g.kind === "list") list = genList(p, leaf, g);
      else if (g.kind === "generic") list = genGeneric(p, leaf, g);
      leaf._expenses = list;
      const forced = g.paidTarget ? enforcePaidTarget(list.filter((e) => !e._lima), g.paidTarget) : new Map();
      leaf._forced = forced;
    }
  }

  // Órdenes de servicio y compra, vinculadas a sus comprobantes
  const orderRows = [], orderItems = [];
  for (const p of Object.values(ids.projects)) {
    const seqs = { OS: 0, OC: 0 };
    for (const o of p.orders ?? []) {
      const leaf = p.wbsByCode[o.wbs];
      const id = randomUUID();
      const seq = ++seqs[o.type];
      const status = o.status ?? "aprobada";
      orderRows.push({
        id, company_id: p.company_id, project_id: p.id, order_type: o.type, seq, number: `${o.type}-${String(seq).padStart(4, "0")}`,
        supplier_id: ids.suppliers[p.companyCode][o.supplier], wbs_id: leaf.id, phase_id: leaf.phase_id, title: o.title,
        description: `${o.title}. Monto global proyectado para la duración de la obra; facturación ${o.freq}.`, includes_igv: true,
        total: r2(o.base * 1.18), billing_frequency: o.freq, start_date: o.date, end_date: p.extended ?? p.end, status,
        requested_by: p.adminUser ?? p.residentUser ?? ids.users.jcastillo,
        approved_by: status === "solicitada" ? null : ids.users.jcastillo, approved_at: status === "solicitada" ? null : ts(addDays(o.date, 1), 11),
        created_at: ts(o.date, 10),
      });
      orderItems.push({ id: randomUUID(), order_id: id, description: o.title, unit: o.type === "OS" ? "glb" : "lote", quantity: 1, unit_price: o.base });
      if (o.noInvoices || status === "solicitada") continue;
      let used = 0;
      for (const e of (leaf._expenses ?? []).filter((x) => x._supplierKey === o.supplier).sort((a, b) => (a.issue_date < b.issue_date ? -1 : 1))) {
        if (used + e._cost <= o.base + 0.01) { e.order_id = id; used += e._cost; }
        else if (o.allowOverride) { e.order_id = id; e.order_override = true; used += e._cost; }
      }
    }
  }
  await insert("orders", orderRows);
  await insert("order_items", orderItems);

  // Inserción de comprobantes (los triggers calculan IGV, montos y asignaciones)
  const clean = (e) => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith("_")));
  await insert("expenses", expenses.map(clean), 300);
  for (const p of Object.values(ids.projects))
    for (const leaf of p.leaves)
      for (const e of [...(leaf._expenses ?? []), ...expenses.filter((x) => x._lima && x._leaf === leaf)])
        planPayments(e, leaf._forced?.get(e.id));
  await insert("payments", payments, 300);
  await insert("payrolls", payrolls);
  await insert("payroll_lines", payrollLines);
  log(`  ${expenses.length} comprobantes · ${payments.length} pagos · ${payrolls.length} planillas`);

  // Verificación de la obra 010-HCVC contra la plantilla Excel
  const hcvc = ids.projects["010-HCVC"];
  const f3 = hcvc.phaseIds.F3;
  const [{ budget, paid }] = await sql(`select sum(s.budget) budget, sum(s.paid) paid from public.v_wbs_stats s join public.wbs_nodes w on w.id = s.wbs_id
    where s.project_id = '${hcvc.id}' and s.is_leaf and w.phase_id = '${f3}'`);
  log(`  010-HCVC Fase 3 → asignado S/ ${budget} · pagado S/ ${paid} (Excel: 1,768,159.05 / 1,728,205.31)`);

  log("Almacén (kardex)…");
  const stockRows = [];
  for (const p of Object.values(ids.projects).filter((x) => x.stock)) {
    const isMine = ["mineria", "infraestructura"].includes(p.project_type);
    const codes = ["ALA-016", "ALA-008", "CLA-030", "CLA-040", "CLA-025", "MAD-T01", "MAD-P23", "AGU-CAJ", "DIS-C07", "DIS-D04", "EPP-GUA", "EPP-CAS",
      "EPP-LEN", "CEM-T1", "ACE-012", "ACE-038", "DES-GLN", "CIN-SEN", ...(isMine ? ["GEO-TEX", "TUB-PVC", "PIE-CHA", "ARE-GRU", "EPP-CHA"] : ["YES-BOL", "EPP-ARN", "ADI-GLN"])];
    const stock = Object.fromEntries(codes.map((c) => [c, 0]));
    const targets = p.leaves.filter((l) => ["materiales", "mano_obra"].includes(l.type) && l.gen.kind !== "none");
    const fronts = p.project_type === "edificacion" ? ["Sótano 2", "Sótano 1", "Torre A — piso 5", "Torre B — piso 3", "Cisterna", "Escaleras"]
      : p.code === "010-HCVC" ? ["Sector 3 — Bloque B", "Sector 3 — Bloque C", "Emergencia", "Consultorios externos", "Casa de fuerza"]
      : ["Km 14+200", "Km 18+600", "Km 22+100", "Frente norte", "Frente sur", "Plataforma A"];
    const receiver = p.companyCode === "01" ? "Pedro Ccori Salas" : "Miguel Paredes Villanueva";
    const creator = p.companyCode === "01" ? ids.users.almacen : ids.users.mparedes;
    let d = maxD(p.start, addDays(TODAY, -7 * 24));
    let week = 0;
    while (d <= TODAY) {
      week++;
      const day = (k) => minD(addDays(d, k), TODAY);
      const ingreso = (code, qty, k = int(0, 2)) => {
        const m = MATERIALS.find((x) => x.code === code);
        const supplier = m.category === "madera" ? "maderera" : m.category === "acero" ? "ferreandina" : m.category === "agregados" ? "agregados" : m.category === "epp" ? "acr" : "constructor";
        stock[code] += qty;
        stockRows.push({ id: randomUUID(), company_id: p.company_id, project_id: p.id, material_id: ids.materials[p.companyCode][code], movement_type: "ingreso", moved_at: day(k),
          quantity: qty, unit_cost: r2(m.cost * between(0.94, 1.1) * (1 + week * 0.002)), supplier_id: ids.suppliers[p.companyCode][supplier],
          document_ref: `GR EG0${int(1, 4)}-${String(int(100, 99999)).padStart(6, "0")}`, responsible_name: receiver, created_by: creator, created_at: ts(day(k)) });
      };
      ingreso("ALA-016", int(40, 120));
      ingreso("CLA-030", int(20, 60));
      ingreso("AGU-CAJ", int(10, 30));
      if (week % 2 === 0) { ingreso("CLA-040", int(15, 45)); ingreso("MAD-T01", int(20, 60)); ingreso("ALA-008", int(50, 150)); }
      if (week % 3 === 0) { ingreso("MAD-P23", int(30, 90)); ingreso("DIS-C07", int(20, 50)); ingreso("EPP-GUA", int(24, 60)); ingreso("CLA-025", int(10, 30)); }
      if (week % 4 === 1) { ingreso("CEM-T1", int(80, 220)); ingreso("ACE-012", int(60, 160)); ingreso("ACE-038", int(60, 160)); ingreso("DES-GLN", int(4, 12)); }
      for (const c of codes) if (stock[c] === 0 && chance(0.25)) ingreso(c, MATERIALS.find((x) => x.code === c).unit === "m3" ? int(6, 20) : int(8, 40));
      for (const c of codes) {
        if (stock[c] <= 0) continue;
        const outs = int(1, 2);
        for (let k = 0; k < outs; k++) {
          const qty = Math.floor(stock[c] * between(0.3, 0.55));
          if (qty <= 0) continue;
          stock[c] -= qty;
          const when = day(int(3, 6));
          const active = targets.filter((l) => { const ph = p.phases.find((f) => p.phaseIds[f.code] === l.phase_id); return !ph || (ph.start <= when && when <= ph.end); });
          const leaf = pick(active.length ? active : targets.slice(-2));
          stockRows.push({ id: randomUUID(), company_id: p.company_id, project_id: p.id, material_id: ids.materials[p.companyCode][c], movement_type: "salida",
            moved_at: when, quantity: qty, wbs_id: leaf?.id ?? null, phase_id: leaf?.phase_id ?? p.phaseByDate(when), front: pick(fronts),
            responsible_name: pick(WORKERS), document_ref: `VS-${String(int(1000, 9999))}`, created_by: creator, created_at: ts(when) });
        }
      }
      d = addDays(d, 7);
    }
    stockRows.sort((a, b) => (a.moved_at === b.moved_at ? (a.movement_type === "ingreso" ? -1 : 1) : a.moved_at < b.moved_at ? -1 : 1));
  }
  for (const r of stockRows) delete r.created_at;
  for (const p of Object.values(ids.projects).filter((x) => x.stock)) await insert("stock_movements", stockRows.filter((r) => r.project_id === p.id), 500);

  log("Equipos menores con cargos firmados…");
  const eqRows = [], assignRows = [];
  for (const code of ["01", "02"]) {
    const projs = Object.values(ids.projects).filter((p) => p.companyCode === code && p.status === "ejecucion");
    const ordersCo = orderRows.filter((o) => o.company_id === ids.companies[code]);
    for (const [i, eq] of EQUIPMENT.entries()) {
      const id = randomUUID();
      const proj = projs[i % projs.length];
      const status = i === 8 ? "mantenimiento" : i % 5 === 4 ? "disponible" : "asignado";
      const linkOrder = eq.ownership === "alquilado"
        ? ordersCo.find((o) => o.project_id === proj.id && (eq.equipment_type === "estacion_total" ? /estación total/i.test(o.title) : /equipos menores/i.test(o.title)))?.id ?? null : null;
      eqRows.push({ id, company_id: ids.companies[code], ...eq, serial: `SN-${int(100000, 999999)}`, order_id: linkOrder,
        project_id: status === "asignado" ? proj.id : null, status, notes: status === "mantenimiento" ? "Cambio de carbones y mantenimiento preventivo." : null });
      const hist = int(1, 3);
      let start = addDays(TODAY, -int(80, 140));
      for (let h = 0; h < hist; h++) {
        const last = h === hist - 1;
        const open = last && status === "asignado";
        const ret = open ? null : minD(addDays(start, int(10, 40)), TODAY);
        assignRows.push({ id: randomUUID(), equipment_id: id, project_id: proj.id, assigned_to: pick(WORKERS), assigned_to_dni: String(int(40000000, 79999999)),
          delivered_at: ts(start, int(7, 10)), delivered_by: code === "01" ? ids.users.almacen : ids.users.mparedes, condition_out: pick(["Operativo, con accesorios completos", "Operativo, con estuche y manual", "Operativo"]),
          signature_out: signatureSvg(), returned_at: ret ? ts(ret, int(15, 18)) : null, condition_in: ret ? pick(["Devuelto operativo", "Devuelto con desgaste normal", "Devuelto, requiere limpieza"]) : null,
          signature_in: ret ? signatureSvg() : null });
        start = addDays(ret ?? start, int(1, 6));
      }
    }
  }
  await insert("equipment", eqRows);
  await insert("equipment_assignments", assignRows);

  log("Caja por obra y solicitudes de fondos…");
  const boxes = [], requests = [], movements = [];
  const REASONS = ["Compra de materiales menores en zona", "Pasajes para personal obrero", "Alimentación semanal del personal técnico", "Compra de agua y víveres",
    "Reparación de mezcladora en taller local", "Fletes locales de agregados", "Compra de combustible para grupo electrógeno", "Trámites municipales y copias"];
  for (const p of Object.values(ids.projects).filter((x) => x.status !== "preparacion")) {
    const box = { id: randomUUID(), company_id: p.company_id, project_id: p.id, name: "Caja chica de obra", responsible_id: p.adminUser ?? p.residentUser, active: !p.closed };
    boxes.push(box);
    const campo = expenses.filter((e) => e.project_id === p.id && e.origin === "campo").sort((a, b) => (a.issue_date < b.issue_date ? -1 : 1));
    const statuses = p.closed ? ["rendida", "rendida", "rendida", "rendida"] : ["rendida", "rendida", "rendida", "rendida", "rendida", "depositada", "depositada", "aprobada", "pendiente", "pendiente", "rechazada"];
    let date = addDays(maxD(p.start, addDays(TODAY, -150)), 3);
    const step = Math.max(6, Math.floor((d2n(p.closed ? p.cancelledAt : TODAY) - d2n(date)) / statuses.length));
    let ci = 0, pendingRender = 0;
    statuses.forEach((st, i) => {
      // Fondos aún por rendir: uno reciente y otro de ~3 semanas (genera la alerta de fondos por rendir)
      const date0 = date;
      if (st === "depositada") date = addDays(TODAY, pendingRender++ === 0 ? -22 : -6);
      const amount = r2(int(15, 80) * 100);
      const requester = pick([p.adminUser, p.residentUser].filter(Boolean));
      const req = { id: randomUUID(), company_id: p.company_id, project_id: p.id, box_id: box.id, seq: i + 1, requested_by: requester, amount, reason: pick(REASONS),
        needed_by: addDays(date, 3), status: st, created_at: ts(date, 9) };
      if (st !== "pendiente") { req.approved_by = ids.users.jcastillo; req.approved_at = ts(minD(addDays(date, 1), TODAY), 11); }
      if (st === "rechazada") req.approval_note = "Reprogramar para la siguiente quincena; usar O/C vigente.";
      if (["depositada", "rendida"].includes(st)) {
        const dep = minD(addDays(date, 2), TODAY);
        req.deposited_by = ids.users.contabilidad; req.deposited_at = ts(dep, 15); req.deposit_operation = String(int(10000000, 99999999));
        movements.push({ id: randomUUID(), box_id: box.id, project_id: p.id, movement_type: "ingreso", amount, moved_at: dep, concept: `Depósito solicitud N° ${i + 1} — ${req.reason}`, fund_request_id: req.id, created_by: ids.users.contabilidad });
        if (st === "rendida") {
          let spent = 0;
          const limit = amount * between(0.9, 1);
          while (ci < campo.length && spent + campo[ci].total <= limit) {
            const e = campo[ci++];
            spent += e.total;
            movements.push({ id: randomUUID(), box_id: box.id, project_id: p.id, movement_type: "egreso", amount: e.total, moved_at: maxD(e.issue_date, dep), concept: e.description, expense_id: e.id, fund_request_id: req.id, created_by: requester });
          }
          if (spent < limit * 0.6) {
            const extra = r2(limit - spent);
            movements.push({ id: randomUUID(), box_id: box.id, project_id: p.id, movement_type: "egreso", amount: extra, moved_at: minD(addDays(dep, 4), TODAY), concept: req.reason, fund_request_id: req.id, created_by: requester });
            spent += extra;
          }
          req.rendered_amount = r2(spent); req.rendered_at = ts(minD(addDays(dep, 8), TODAY), 17);
        }
      }
      requests.push(req);
      date = minD(addDays(st === "depositada" ? date0 : date, step), TODAY);
    });
  }
  await insert("cash_boxes", boxes);
  await insert("fund_requests", requests);
  await insert("cash_movements", movements);

  log("Valorizaciones y cobros…");
  const valRows = [], collRows = [];
  for (const p of Object.values(ids.projects)) {
    const v = p.valuations;
    if (!v) continue;
    const amounts = {};
    for (const [ph, [a, b]] of Object.entries(v.phases)) {
      const sale = p.phases.find((x) => x.code === ph).sale;
      const target = ph === "F3" && v.f3Target ? sale * v.f3Target : sale * (v.pct?.[ph] ?? 1);
      const fixed = Object.entries(v.fixed ?? {}).filter(([n]) => +n >= a && +n <= b);
      const free = [];
      for (let n = a; n <= b; n++) if (!v.fixed?.[n]) free.push(n);
      const rest = target - fixed.reduce((s, [, [amt]]) => s + amt, 0);
      split(rest, free.length).forEach((amt, i) => (amounts[free[i]] = { amt, ph }));
      for (const [n, [amt]] of fixed) amounts[n] = { amt, ph };
    }
    for (const [nStr, { amt, ph }] of Object.entries(amounts)) {
      const n = +nStr;
      const [ps, pe] = v.periods[n - 1];
      const invoiceDate = minD(addDays(pe, 5), TODAY);
      const pending = n >= v.pendingFrom;
      const isLast = n === Object.keys(amounts).length;
      const status = !pending ? "cobrada" : isLast && n > v.pendingFrom ? "aprobada" : "facturada";
      const id = randomUUID();
      valRows.push({ id, company_id: p.company_id, project_id: p.id, number: n, period_start: ps, period_end: pe, presented_amount: r2(amt * between(1, 1.03)), approved_amount: r2(amt),
        invoice_number: status === "aprobada" ? null : `E001-${String(100 + n).padStart(6, "0")}`, invoice_date: status === "aprobada" ? null : invoiceDate,
        status, phase_id: p.phaseIds[ph], created_by: ids.users.contabilidad, created_at: ts(minD(addDays(pe, 2), TODAY), 10) });
      if (status === "cobrada") {
        const fixedDate = v.fixed?.[n]?.[1];
        collRows.push({ id: randomUUID(), valuation_id: id, project_id: p.id, amount: r2(amt * 1.18), collected_at: fixedDate ?? minD(addDays(invoiceDate, int(20, 35)), TODAY),
          operation_number: String(int(10000000, 99999999)), registered_by: ids.users.contabilidad, notes: `Abono valorización N° ${n}` });
      }
    }
  }
  await insert("valuations", valRows);
  await insert("collections", collRows);

  log("Documentos de obra, asistencia y cierres…");
  const docRows = [];
  for (const p of Object.values(ids.projects)) {
    const sign = addDays(p.start, -12);
    docRows.push(
      { id: randomUUID(), project_id: p.id, doc_kind: "contrato", title: "Contrato de obra", number: `CTO-${p.code}-2026`, amount: r2(p.contract * 1.18), issue_date: sign, created_by: ids.users.jcastillo },
      { id: randomUUID(), project_id: p.id, doc_kind: "orden_servicio_cliente", title: "Orden de servicio del cliente", number: `OS-${int(1000, 9999)}-2026`, amount: r2(p.contract * 1.18), issue_date: addDays(sign, 2), created_by: ids.users.jcastillo },
      { id: randomUUID(), project_id: p.id, doc_kind: "carta_fianza", title: "Carta fianza de fiel cumplimiento", number: `CF-${int(100000, 999999)}`, amount: r2(p.contract * 0.1), issue_date: sign, expiry_date: p.fianzaExpiry, notes: "Emitida por BCP. Renovar 15 días antes del vencimiento.", created_by: ids.users.jcastillo },
      { id: randomUUID(), project_id: p.id, doc_kind: "poliza", title: "Póliza CAR — Todo riesgo construcción", number: `POL-${int(100000, 999999)}`, amount: r2(p.contract * 1.18), issue_date: sign, expiry_date: addDays(p.extended ?? p.end, 90), created_by: ids.users.jcastillo },
    );
  }
  await insert("project_documents", docRows);

  const attendance = [];
  const fieldUsers = [
    ["rquispe", ["010-HCVC", "011-RLAL"]], ["jrojas", ["010-HCVC", "011-RLAL"]], ["almacen", ["010-HCVC"]],
    ["mparedes", ["020-MTTN", "021-VAKM", "022-CM120"]], ["lfernandez", ["020-MTTN", "022-CM120"]],
  ];
  for (const [key, codes] of fieldUsers) {
    for (let i = 34; i >= 0; i--) {
      const date = addDays(TODAY, -i);
      if (dow(date) === 0 || chance(0.06)) continue;
      const p = ids.projects[codes[(i >> 2) % codes.length]];
      for (const kind of ["entrada", "salida"]) {
        if (kind === "salida" && i === 0) continue;
        const outside = chance(0.05);
        const dist = outside ? between(450, 950) : between(8, p.project_type === "edificacion" ? 120 : 350);
        const ang = between(0, Math.PI * 2);
        const lat = p.lat + (dist * Math.cos(ang)) / 111320, lng = p.lng + (dist * Math.sin(ang)) / (111320 * Math.cos((p.lat * Math.PI) / 180));
        const radius = p.project_type === "edificacion" ? 150 : 400;
        const real = haversine(p.lat, p.lng, lat, lng);
        attendance.push({ id: randomUUID(), company_id: p.company_id, project_id: p.id, user_id: ids.users[key], kind,
          marked_at: kind === "entrada" ? ts(date, 6 + (chance(0.7) ? 1 : 0), int(0, 40)) : ts(date, int(17, 18), int(0, 45)),
          lat, lng, accuracy: between(4, 18), distance_m: r2(real), within_geofence: real <= radius, notes: real > radius ? "Marcación fuera de la geocerca" : null });
      }
    }
  }
  await insert("attendance", attendance);

  const closures = [];
  for (const p of Object.values(ids.projects)) for (const [s, e, label] of p.closures ?? [])
    closures.push({ id: randomUUID(), project_id: p.id, period_start: s, period_end: e, label, closed_by: ids.users.jcastillo, closed_at: ts(addDays(e, 6), 18) });
  await insert("period_closures", closures);

  log("Sustentos fotografiados…");
  await uploadReceipts(expenses.filter((e) => e.doc_type !== "PL"));

  log("Alertas y trazabilidad…");
  for (const p of Object.values(ids.projects)) {
    const { error } = await sb.rpc("refresh_project_alerts", { p_project: p.id });
    if (error) throw new Error(`alerts: ${error.message}`);
  }
  await sql(`update public.alerts a set created_at = coalesce(
      (select max(paid_at)::timestamptz + interval '10 hours' from public.payments p join public.expense_allocations x on x.expense_id = p.expense_id where x.wbs_id = a.entity_id),
      now() - interval '2 days') where a.entity_type = 'wbs';
    update public.alerts set created_at = now() - (random() * interval '4 days') where entity_type <> 'wbs';
    update public.audit_log set changed_at = coalesce(nullif(new_data->>'created_at','')::timestamptz, changed_at) where action = 'INSERT';
    update public.audit_log set changed_at = coalesce(nullif(new_data->>'approved_at','')::timestamptz, changed_at) where action = 'UPDATE' and table_name = 'expenses';
    update public.stock_movements set created_at = moved_at::timestamptz + interval '13 hours';`);

  const [counts] = await sql(`select (select count(*) from expenses) expenses, (select count(*) from payments) payments, (select count(*) from stock_movements) stock,
    (select count(*) from alerts where not resolved) alerts, (select count(*) from audit_log) audit, (select count(*) from expense_files) files`);
  log("Listo:", counts);
  log(`Usuarios: ${USERS.map((u) => u.email).join(", ")} · contraseña ${PASSWORD}`);
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
