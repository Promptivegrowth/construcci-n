"use server";
import { buildTree, conciliation, CONCILIATION_LABEL, flatten, LABOR_LABEL } from "@/lib/calc";
import type { ExportSheet } from "@/lib/export/types";
import { DOC_TYPE_LABEL, money, toNum } from "@/lib/format";
import { getWbsStats } from "@/lib/queries";
import { getProjectContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

type Range = { from?: string; to?: string };
type Result = { ok: true; sheets: ExportSheet[]; attachments?: { url: string; label: string }[] } | { ok: false; error: string };

const fmtRange = (r: Range) => (r.from || r.to ? `${r.from ?? "inicio"} al ${r.to ?? "hoy"}` : "Todo el periodo de la obra");

async function base(companyCode: string, projectCode: string) {
  const ctx = await getProjectContext(companyCode, projectCode);
  const sb = await supabaseServer();
  return { ctx, sb, pid: ctx.project.id };
}

/** Comprobantes (con proveedor, WBS, fase y pagado) dentro de un rango. */
async function loadExpenses(sb: Awaited<ReturnType<typeof supabaseServer>>, pid: string, r: Range, wbsIds?: string[]) {
  let q = sb.from("expenses")
    .select("id, seq, issue_date, due_date, doc_type, series, doc_number, description, category, origin, status, total_pen, igv, cost_pen, payable_pen, retention_pen, supplier:suppliers(name, ruc), wbs:wbs_nodes(code, name), phase:phases(code), order:orders(number), files:expense_files(file_path)")
    .eq("project_id", pid).not("status", "in", "(borrador,anulado)").order("issue_date").limit(5000);
  if (r.from) q = q.gte("issue_date", r.from);
  if (r.to) q = q.lte("issue_date", r.to);
  if (wbsIds) q = q.in("wbs_id", wbsIds);
  const { data } = await q;
  const ids = (data ?? []).map((e) => e.id);
  const paid = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 300) {
    const { data: vp } = await sb.from("v_expense_paid").select("expense_id, paid_pen").in("expense_id", ids.slice(i, i + 300));
    vp?.forEach((x) => paid.set(x.expense_id!, toNum(x.paid_pen)));
  }
  return (data ?? []).map((e) => {
    const s = e.supplier as unknown as { name: string; ruc: string } | null;
    const w = e.wbs as unknown as { code: string; name: string } | null;
    const p = paid.get(e.id) ?? 0;
    return {
      id: e.id, date: e.issue_date, due: e.due_date, doc: `${DOC_TYPE_LABEL[e.doc_type]} ${[e.series, e.doc_number].filter(Boolean).join("-")}`, supplier: s?.name ?? "", ruc: s?.ruc ?? "",
      description: e.description, wbs: w?.code ?? "", wbsName: w?.name ?? "", phase: (e.phase as unknown as { code: string } | null)?.code ?? "", order: (e.order as unknown as { number: string } | null)?.number ?? "",
      total: toNum(e.total_pen), igv: toNum(e.igv), cost: toNum(e.cost_pen), retention: toNum(e.retention_pen), paid: p, saldo: toNum(e.payable_pen) - p, origin: e.origin, status: e.status,
      files: ((e.files as unknown as { file_path: string }[]) ?? []).map((f) => f.file_path),
    };
  });
}

const EXP_COLUMNS: ExportSheet["columns"] = [
  { key: "date", header: "Fecha", type: "date" }, { key: "doc", header: "Comprobante", width: 22 }, { key: "supplier", header: "Proveedor", width: 30 }, { key: "ruc", header: "RUC/DNI", width: 13 },
  { key: "description", header: "Descripción", width: 34 }, { key: "wbs", header: "WBS", width: 14 }, { key: "phase", header: "Fase", width: 6 }, { key: "order", header: "O/S-O/C", width: 10 },
  { key: "total", header: "Total c/IGV", type: "money" }, { key: "cost", header: "Costo", type: "money" }, { key: "paid", header: "Pagado", type: "money" }, { key: "saldo", header: "Saldo por pagar", type: "money" },
];
const sumBy = <T,>(list: T[], f: (x: T) => number) => list.reduce((s, x) => s + f(x), 0);

/** Reporte quincenal / mensual / por rango: gasto del periodo por WBS + comprobantes + pagos. */
export async function periodReport(companyCode: string, projectCode: string, r: Range): Promise<Result> {
  const { ctx, sb, pid } = await base(companyCode, projectCode);
  const exps = await loadExpenses(sb, pid, r);
  let pq = sb.from("payments").select("paid_at, amount_pen, method, bank, operation_number, expense:expenses(series, doc_number, doc_type, description, supplier:suppliers(name), wbs:wbs_nodes(code))").eq("project_id", pid).eq("voided", false).order("paid_at");
  if (r.from) pq = pq.gte("paid_at", r.from);
  if (r.to) pq = pq.lte("paid_at", r.to);
  const { data: pays } = await pq;
  const byWbs = new Map<string, { wbs: string; name: string; declared: number; docs: number }>();
  exps.forEach((e) => {
    const cur = byWbs.get(e.wbs) ?? { wbs: e.wbs, name: e.wbsName, declared: 0, docs: 0 };
    cur.declared += e.cost; cur.docs++;
    byWbs.set(e.wbs, cur);
  });
  const payRows = (pays ?? []).map((p) => {
    const e = p.expense as unknown as { series: string; doc_number: string; doc_type: string; description: string; supplier: { name: string } | null; wbs: { code: string } | null };
    return { date: p.paid_at, doc: `${DOC_TYPE_LABEL[e.doc_type]} ${[e.series, e.doc_number].filter(Boolean).join("-")}`, supplier: e.supplier?.name ?? "", wbs: e.wbs?.code ?? "", method: p.method, bank: p.bank ?? "", op: p.operation_number ?? "", amount: toNum(p.amount_pen) };
  });
  const totalPaid = sumBy(payRows, (x) => x.amount);
  return {
    ok: true,
    sheets: [
      { name: "Resumen", title: "Reporte de gasto del periodo", subtitle: fmtRange(r),
        summary: [
          { label: "Comprobantes", value: String(exps.length), tone: "navy" }, { label: "Costo declarado", value: money(sumBy(exps, (e) => e.cost)), tone: "blue" },
          { label: "Pagado en el periodo", value: money(totalPaid), tone: "green" }, { label: "Pendiente de pago", value: money(sumBy(exps, (e) => Math.max(e.saldo, 0))), tone: "amber" },
        ],
        columns: [{ key: "wbs", header: "WBS", width: 16 }, { key: "name", header: "Centro de costo", width: 42 }, { key: "docs", header: "Comprobantes", type: "int" }, { key: "declared", header: "Costo del periodo", type: "money" }],
        rows: [...byWbs.values()].sort((a, b) => a.wbs.localeCompare(b.wbs)), totals: { docs: exps.length, declared: sumBy(exps, (e) => e.cost) } },
      { name: "Comprobantes", title: "Comprobantes del periodo", subtitle: fmtRange(r), columns: EXP_COLUMNS, rows: exps,
        totals: { total: sumBy(exps, (e) => e.total), cost: sumBy(exps, (e) => e.cost), paid: sumBy(exps, (e) => e.paid), saldo: sumBy(exps, (e) => e.saldo) } },
      { name: "Pagos", title: "Pagos registrados en el periodo", subtitle: fmtRange(r),
        columns: [{ key: "date", header: "Fecha", type: "date" }, { key: "doc", header: "Comprobante", width: 22 }, { key: "supplier", header: "Proveedor", width: 30 }, { key: "wbs", header: "WBS", width: 14 },
          { key: "method", header: "Medio", width: 13 }, { key: "bank", header: "Banco", width: 11 }, { key: "op", header: "N° operación", width: 13 }, { key: "amount", header: "Monto", type: "money" }],
        rows: payRows, totals: { amount: totalPaid } },
    ],
  };
}

/** Reporte de un WBS con todos sus comprobantes y pagos. */
export async function wbsReport(companyCode: string, projectCode: string, wbsId: string, r: Range): Promise<Result> {
  const { sb, pid } = await base(companyCode, projectCode);
  const stats = await getWbsStats(pid);
  const all = flatten(buildTree(stats));
  const node = all.find((n) => n.wbs_id === wbsId);
  if (!node) return { ok: false, error: "WBS no encontrado" };
  const leaves = node.children.length ? flatten(node.children).filter((c) => !c.children.length).map((c) => c.wbs_id) : [node.wbs_id];
  const exps = await loadExpenses(sb, pid, r, leaves);
  const st = conciliation(node.declared, node.paid);
  return {
    ok: true,
    sheets: [{ name: node.code, title: `Reporte por WBS · ${node.code}`, subtitle: `${node.name} · ${fmtRange(r)}`,
      summary: [
        { label: "Proyectado", value: money(node.budget), tone: "blue" }, { label: "Declarado", value: money(node.declared), tone: "navy" },
        { label: "Pagado", value: money(node.paid), tone: "green" }, { label: "Saldo", value: money(node.budget - node.paid), tone: node.budget - node.paid < 0 ? "red" : "navy" },
        { label: "Conciliación", value: CONCILIATION_LABEL[st], tone: "amber" },
      ],
      columns: EXP_COLUMNS, rows: exps, totals: { total: sumBy(exps, (e) => e.total), cost: sumBy(exps, (e) => e.cost), paid: sumBy(exps, (e) => e.paid), saldo: sumBy(exps, (e) => e.saldo) } }],
  };
}

/** Mano de obra por categoría, fase y semana. */
export async function laborReport(companyCode: string, projectCode: string, r: Range): Promise<Result> {
  const { sb, pid } = await base(companyCode, projectCode);
  let q = sb.from("payrolls").select("week, period_label, period_end, payroll_type, total, phase:phases(code), lines:payroll_lines(category, amount, workers)").eq("project_id", pid).order("period_end");
  if (r.from) q = q.gte("period_end", r.from);
  if (r.to) q = q.lte("period_end", r.to);
  const [{ data }, { data: proj }] = await Promise.all([q, sb.from("labor_projections").select("category, amount, phase:phases(code)").eq("project_id", pid)]);
  const rows = (data ?? []).map((p) => {
    const lines = (p.lines as unknown as { category: string; amount: number; workers: number }[]) ?? [];
    const amt = (c: string) => toNum(lines.find((l) => l.category === c)?.amount);
    const wk = (c: string) => toNum(lines.find((l) => l.category === c)?.workers);
    return { period: p.period_label, end: p.period_end, type: p.payroll_type, phase: (p.phase as unknown as { code: string } | null)?.code ?? "",
      capataz: amt("capataz"), operario: amt("operario"), oficial: amt("oficial"), peon: amt("peon"), staff: amt("staff"), total: toNum(p.total),
      workers: wk("capataz") + wk("operario") + wk("oficial") + wk("peon") + wk("staff") };
  });
  const cats = ["capataz", "operario", "oficial", "peon"];
  const phases = [...new Set([...(proj ?? []).map((x) => (x.phase as unknown as { code: string } | null)?.code ?? ""), ...rows.map((x) => x.phase)])].filter(Boolean).sort();
  const matrix = cats.map((c) => {
    const row: Record<string, unknown> = { category: LABOR_LABEL[c] };
    let tp = 0, tr = 0;
    phases.forEach((ph) => {
      const projected = sumBy((proj ?? []).filter((x) => x.category === c && (x.phase as unknown as { code: string } | null)?.code === ph), (x) => toNum(x.amount));
      const real = sumBy(rows.filter((x) => x.phase === ph), (x) => Number(x[c as "capataz"]));
      row[`${ph}_p`] = projected; row[`${ph}_r`] = real; tp += projected; tr += real;
    });
    row.tp = tp; row.tr = tr; row.saldo = tp - tr;
    return row;
  });
  return {
    ok: true,
    sheets: [
      { name: "Matriz M.O.", title: "Matriz de distribución de costo de mano de obra", subtitle: `Proyectado vs. real por categoría y fase · ${fmtRange(r)}`,
        columns: [{ key: "category", header: "Categoría", width: 14 }, ...phases.flatMap((ph) => [{ key: `${ph}_p`, header: `${ph} proyectado`, type: "money" as const }, { key: `${ph}_r`, header: `${ph} real`, type: "money" as const }]),
          { key: "tp", header: "Total proyectado", type: "money" }, { key: "tr", header: "Total real", type: "money" }, { key: "saldo", header: "Saldo / déficit", type: "money" }],
        rows: matrix },
      { name: "Planillas", title: "Planillas registradas por semana", subtitle: fmtRange(r),
        columns: [{ key: "end", header: "Cierre", type: "date" }, { key: "period", header: "Periodo", width: 22 }, { key: "phase", header: "Fase", width: 7 }, { key: "workers", header: "Trab.", type: "int" },
          { key: "capataz", header: "Capataz", type: "money" }, { key: "operario", header: "Operarios", type: "money" }, { key: "oficial", header: "Oficiales", type: "money" }, { key: "peon", header: "Peones", type: "money" },
          { key: "staff", header: "Staff", type: "money" }, { key: "total", header: "Total", type: "money" }],
        rows, totals: Object.fromEntries(["capataz", "operario", "oficial", "peon", "staff", "total"].map((k) => [k, sumBy(rows, (x) => Number(x[k as "total"]))])) },
    ],
  };
}

/** Kardex y materiales por periodo, proveedor y WBS. */
export async function kardexReport(companyCode: string, projectCode: string, r: Range): Promise<Result> {
  const { sb, pid } = await base(companyCode, projectCode);
  const rows: { date: string; type: string; code: string; material: string; unit: string; qty: number; unitCost: number; total: number; supplier: string; wbs: string; front: string; responsible: string; doc: string }[] = [];
  for (let from = 0; ; from += 1000) {
    let q = sb.from("stock_movements").select("moved_at, movement_type, quantity, unit_cost, total_cost, front, responsible_name, document_ref, material:materials(code, name, unit), supplier:suppliers(name), wbs:wbs_nodes(code)")
      .eq("project_id", pid).order("moved_at").range(from, from + 999);
    if (r.from) q = q.gte("moved_at", r.from);
    if (r.to) q = q.lte("moved_at", r.to);
    const { data } = await q;
    (data ?? []).forEach((m) => {
      const mat = m.material as unknown as { code: string; name: string; unit: string };
      rows.push({ date: m.moved_at, type: m.movement_type, code: mat.code, material: mat.name, unit: mat.unit, qty: toNum(m.quantity), unitCost: toNum(m.unit_cost), total: toNum(m.total_cost),
        supplier: (m.supplier as unknown as { name: string } | null)?.name ?? "", wbs: (m.wbs as unknown as { code: string } | null)?.code ?? "", front: m.front ?? "", responsible: m.responsible_name ?? "", doc: m.document_ref ?? "" });
    });
    if (!data || data.length < 1000) break;
  }
  const mats = new Map<string, { code: string; material: string; unit: string; qin: number; cin: number; qout: number; cout: number }>();
  rows.forEach((m) => {
    const cur = mats.get(m.code) ?? { code: m.code, material: m.material, unit: m.unit, qin: 0, cin: 0, qout: 0, cout: 0 };
    if (m.type === "salida") { cur.qout += m.qty; cur.cout += m.total; } else { cur.qin += m.qty; cur.cin += m.total; }
    mats.set(m.code, cur);
  });
  const summary = [...mats.values()].map((m) => ({ ...m, avg: m.qin ? m.cin / m.qin : 0, stock: m.qin - m.qout })).sort((a, b) => b.cin - a.cin);
  return {
    ok: true,
    sheets: [
      { name: "Resumen materiales", title: "Materiales: ingresos, consumos y precio promedio", subtitle: fmtRange(r),
        columns: [{ key: "code", header: "Código", width: 10 }, { key: "material", header: "Material", width: 36 }, { key: "unit", header: "Und.", width: 7 }, { key: "qin", header: "Ingresó", type: "number" },
          { key: "cin", header: "Costo ingresos", type: "money" }, { key: "avg", header: "Precio prom.", type: "money" }, { key: "qout", header: "Consumido", type: "number" }, { key: "cout", header: "Costo consumo", type: "money" }, { key: "stock", header: "Saldo periodo", type: "number" }],
        rows: summary, totals: { cin: sumBy(summary, (x) => x.cin), cout: sumBy(summary, (x) => x.cout) } },
      { name: "Kardex", title: "Kardex de movimientos", subtitle: fmtRange(r),
        columns: [{ key: "date", header: "Fecha", type: "date" }, { key: "type", header: "Tipo", width: 9 }, { key: "material", header: "Material", width: 30 }, { key: "qty", header: "Cantidad", type: "number" }, { key: "unit", header: "Und.", width: 7 },
          { key: "unitCost", header: "C. unitario", type: "money" }, { key: "total", header: "Total", type: "money" }, { key: "supplier", header: "Proveedor", width: 26 }, { key: "wbs", header: "WBS destino", width: 14 }, { key: "front", header: "Frente", width: 16 }, { key: "responsible", header: "Responsable", width: 20 }],
        rows },
    ],
  };
}

/**
 * Liquidación de gastos a una fecha de corte (para sustentar ante el cliente si la obra se paraliza o cancela):
 * todo lo gastado agrupado por WBS + detalle de comprobantes + enlaces a sus sustentos para anexarlos al PDF.
 */
export async function liquidationReport(companyCode: string, projectCode: string, cutoff: string): Promise<Result> {
  const { ctx, sb, pid } = await base(companyCode, projectCode);
  const exps = await loadExpenses(sb, pid, { to: cutoff });
  const stats = await getWbsStats(pid);
  const leaves = stats.filter((s) => s.is_leaf);
  const byWbs = leaves.map((l) => {
    const list = exps.filter((e) => e.wbs === l.code);
    return { code: l.code, name: l.name, budget: l.budget, docs: list.length, cost: sumBy(list, (e) => e.cost), igv: sumBy(list, (e) => e.igv), total: sumBy(list, (e) => e.total), paid: sumBy(list, (e) => e.paid) };
  }).filter((x) => x.docs > 0);
  const paths = exps.flatMap((e) => e.files.map((f) => ({ path: f, label: `${e.doc} · ${e.supplier} · ${money(e.total)} · ${e.wbs}` })));
  const signed = new Map<string, string>();
  for (let i = 0; i < paths.length; i += 100) {
    const { data } = await sb.storage.from("evidencias").createSignedUrls(paths.slice(i, i + 100).map((p) => p.path), 3600);
    data?.forEach((d) => d.signedUrl && signed.set(d.path!, d.signedUrl));
  }
  const totalCost = sumBy(exps, (e) => e.cost);
  return {
    ok: true,
    sheets: [
      { name: "Liquidación", title: "Liquidación de gastos de obra", subtitle: `Gastos al ${cutoff.split("-").reverse().join("/")} · ${ctx.project.client_name ?? ""}`,
        summary: [
          { label: "Comprobantes", value: String(exps.length), tone: "navy" }, { label: "Costo (sin IGV)", value: money(totalCost), tone: "blue" },
          { label: "IGV", value: money(sumBy(exps, (e) => e.igv)), tone: "navy" }, { label: "Total con IGV", value: money(sumBy(exps, (e) => e.total)), tone: "green" },
          { label: "Sustentos adjuntos", value: String(signed.size), tone: "amber" },
        ],
        columns: [{ key: "code", header: "WBS", width: 15 }, { key: "name", header: "Centro de costo", width: 40 }, { key: "docs", header: "Docs.", type: "int" }, { key: "budget", header: "Presupuesto", type: "money" },
          { key: "cost", header: "Costo", type: "money" }, { key: "igv", header: "IGV", type: "money" }, { key: "total", header: "Total c/IGV", type: "money" }, { key: "paid", header: "Pagado", type: "money" }],
        rows: byWbs, totals: { docs: exps.length, budget: sumBy(byWbs, (x) => x.budget), cost: totalCost, igv: sumBy(byWbs, (x) => x.igv), total: sumBy(byWbs, (x) => x.total), paid: sumBy(byWbs, (x) => x.paid) } },
      { name: "Detalle", title: "Detalle de comprobantes liquidados", subtitle: `Al ${cutoff.split("-").reverse().join("/")}`, columns: EXP_COLUMNS, rows: exps,
        totals: { total: sumBy(exps, (e) => e.total), cost: totalCost, paid: sumBy(exps, (e) => e.paid), saldo: sumBy(exps, (e) => e.saldo) } },
    ],
    attachments: paths.filter((p) => signed.has(p.path)).map((p) => ({ url: signed.get(p.path)!, label: p.label })),
  };
}

export async function wbsOptions(companyCode: string, projectCode: string) {
  const { pid } = await base(companyCode, projectCode);
  const stats = await getWbsStats(pid);
  return flatten(buildTree(stats)).map((n) => ({ id: n.wbs_id, label: `${"  ".repeat(n.level - 1)}${n.code} · ${n.name}` }));
}
