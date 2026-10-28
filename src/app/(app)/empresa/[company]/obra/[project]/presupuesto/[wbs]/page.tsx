import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildTree, elapsed, flatten } from "@/lib/calc";
import { toNum } from "@/lib/format";
import { getPhases, getWbsStats } from "@/lib/queries";
import { getProjectContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { WbsDetail } from "./wbs-detail";
import { canView } from "@/lib/permissions";
import { NoAccess } from "@/components/ui/no-access";

export const metadata: Metadata = { title: "Detalle de WBS" };

export default async function WbsPage({ params }: { params: Promise<{ company: string; project: string; wbs: string }> }) {
  const { company, project, wbs } = await params;
  const ctx = await getProjectContext(company, project);
  if (!canView(ctx.role, "finance")) return <NoAccess role={ctx.role} area="finance" back={`/empresa/${company}/obra/${project}`} backLabel="Volver a la obra" />;
  const p = ctx.project;
  const [stats, phases] = await Promise.all([getWbsStats(p.id), getPhases(p.id)]);
  const all = flatten(buildTree(stats));
  const node = all.find((n) => n.wbs_id === wbs);
  if (!node) notFound();
  const byId = new Map(all.map((n) => [n.wbs_id, n]));
  const ancestors: { id: string; code: string; name: string }[] = [];
  let cur = node.parent_id ? byId.get(node.parent_id) : undefined;
  while (cur) { ancestors.unshift({ id: cur.wbs_id, code: cur.code, name: cur.name }); cur = cur.parent_id ? byId.get(cur.parent_id) : undefined; }
  const leafIds = node.children.length ? flatten(node.children).filter((c) => !c.children.length).map((c) => c.wbs_id) : [node.wbs_id];

  const sb = await supabaseServer();
  const [{ data: allocs }, { data: orders }, { data: changes }] = await Promise.all([
    sb.from("expense_allocations")
      .select("amount_pen, wbs_id, expense:expenses(id, seq, issue_date, due_date, doc_type, series, doc_number, description, category, total_pen, cost_pen, payable_pen, igv, status, origin, phase_id, retention_pen, supplier:suppliers(name, ruc), order:orders(number), files:expense_files(id))")
      .in("wbs_id", leafIds).limit(3000),
    sb.from("orders").select("id, number, order_type, title, subtotal_pen, status, supplier:suppliers(name)").in("wbs_id", leafIds),
    sb.from("budget_changes").select("change_type, amount, new_budget, reason, created_at").in("wbs_id", leafIds).order("created_at", { ascending: false }),
  ]);
  const expIds = [...new Set((allocs ?? []).map((a) => (a.expense as unknown as { id: string }).id))];
  const orderIds = (orders ?? []).map((o) => o.id);
  const [paidRes, paysRes, obRes] = await Promise.all([
    sb.from("v_expense_paid").select("expense_id, paid_pen, last_paid_at").in("expense_id", expIds.length ? expIds : ["00000000-0000-0000-0000-000000000000"]),
    sb.from("payments").select("id, expense_id, paid_at, amount_pen, percentage, method, bank, operation_number, voided").in("expense_id", expIds.length ? expIds : ["00000000-0000-0000-0000-000000000000"]).eq("voided", false).order("paid_at", { ascending: false }),
    sb.from("v_order_balance").select("*").in("order_id", orderIds.length ? orderIds : ["00000000-0000-0000-0000-000000000000"]),
  ]);
  const paid = paidRes.data, pays = paysRes.data, ob = obRes.data;
  const paidMap = new Map((paid ?? []).map((x) => [x.expense_id, toNum(x.paid_pen)]));
  const phaseCode = new Map(phases.map((f) => [f.id, f.code]));
  const wbsCode = new Map(all.map((n) => [n.wbs_id, n.code]));

  type E = { id: string; seq: number; issue_date: string; due_date: string | null; doc_type: string; series: string | null; doc_number: string | null; description: string; category: string | null;
    total_pen: number; cost_pen: number; payable_pen: number; igv: number; status: string; origin: string; phase_id: string | null; retention_pen: number;
    supplier: { name: string; ruc: string } | null; order: { number: string } | null; files: { id: string }[] };
  const docs = (allocs ?? []).map((a) => {
    const e = a.expense as unknown as E;
    const share = toNum(e.cost_pen) > 0 ? toNum(a.amount_pen) / toNum(e.cost_pen) : 1;
    const paidPen = paidMap.get(e.id) ?? 0;
    const paidCost = toNum(e.payable_pen) > 0 ? Math.min(paidPen / toNum(e.payable_pen), 1) * toNum(a.amount_pen) : 0;
    return {
      id: e.id, seq: e.seq, date: e.issue_date, due: e.due_date, doc: [e.series, e.doc_number].filter(Boolean).join("-") || e.doc_number || "S/N", docType: e.doc_type,
      supplier: e.supplier?.name ?? "—", ruc: e.supplier?.ruc ?? "", description: e.description, wbs: wbsCode.get(a.wbs_id) ?? "", phase: e.phase_id ? phaseCode.get(e.phase_id) ?? "" : "",
      order: e.order?.number ?? "", total: toNum(e.total_pen) * share, igv: toNum(e.igv) * share, cost: toNum(a.amount_pen), paid: paidCost, saldo: toNum(a.amount_pen) - paidCost,
      status: e.status, origin: e.origin, files: e.files?.length ?? 0, split: share < 0.999,
    };
  }).filter((d) => d.status !== "borrador" && d.status !== "anulado").sort((a, b) => (a.date < b.date ? 1 : -1));
  const docInfo = new Map(docs.map((d) => [d.id, d]));

  return (
    <WbsDetail
      base={`/empresa/${company}/obra/${p.code}`}
      meta={{ company: ctx.company.tagline ?? ctx.company.name, project: `${p.code} · ${p.name}`, user: ctx.profile.full_name }}
      node={{ id: node.wbs_id, code: node.code, name: node.name, level: node.level, budget: node.budget, margin: node.margin, declared: node.declared, paid: node.paid,
        committed: node.committed, approved: node.approved, pending: node.pending_approval, cost_type: node.cost_type, phase: node.phase_id ? phaseCode.get(node.phase_id) ?? null : null,
        cost_center: (node as typeof node & { cost_center?: string | null }).cost_center ?? null }}
      ancestors={ancestors}
      subs={node.children.map((c) => ({ id: c.wbs_id, code: c.code, name: c.name, budget: c.budget, declared: c.declared, paid: c.paid, committed: c.committed, leaves: c.children.length }))}
      docs={docs}
      payments={(pays ?? []).map((x) => ({ id: x.id, date: x.paid_at, amount: toNum(x.amount_pen), pct: toNum(x.percentage), method: x.method, bank: x.bank, op: x.operation_number,
        doc: docInfo.get(x.expense_id)?.doc ?? "", supplier: docInfo.get(x.expense_id)?.supplier ?? "", expenseId: x.expense_id }))}
      orders={(orders ?? []).map((o) => {
        const b = (ob ?? []).find((x) => x.order_id === o.id);
        return { id: o.id, number: o.number ?? "", type: o.order_type, title: o.title, amount: toNum(o.subtotal_pen), invoiced: toNum(b?.invoiced_pen), paid: toNum(b?.paid_pen), status: o.status, supplier: (o.supplier as unknown as { name: string } | null)?.name ?? "" };
      })}
      changes={(changes ?? []).map((c) => ({ type: c.change_type, amount: toNum(c.amount), next: toNum(c.new_budget), reason: c.reason, at: c.created_at }))}
      threshold={p.alert_threshold / 100}
      elapsed={p.status === "ejecucion" ? elapsed(p) : undefined}
    />
  );
}
