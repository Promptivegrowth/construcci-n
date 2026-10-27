import type { Metadata } from "next";
import { FileCheck2, HandCoins, Landmark, PieChart, Receipt } from "lucide-react";
import { KpiCard } from "@/components/ui/cont-kit";
import { PageHeader } from "@/components/ui/primitives";
import { VALUED_STATUS } from "@/lib/calc";
import { pct, toNum } from "@/lib/format";
import { can } from "@/lib/permissions";
import { getPaymentsSeries, getPhases } from "@/lib/queries";
import { getProjectContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { ValuationsView, type PhaseRow, type ValRow } from "./_components/valuations-view";

export const metadata: Metadata = { title: "Valorizaciones y cobros" };

const VALUED = VALUED_STATUS;
const INVOICED = ["facturada", "cobrada_parcial", "cobrada"];

export default async function ValorizacionesPage({ params }: { params: Promise<{ company: string; project: string }> }) {
  const { company, project } = await params;
  const ctx = await getProjectContext(company, project);
  const sb = await supabaseServer();
  const pid = ctx.project.id;
  const [{ data: vals }, { data: colls }, phases, payments] = await Promise.all([
    sb.from("valuations").select("*").eq("project_id", pid).order("number"),
    sb.from("collections").select("id, valuation_id, amount, collected_at, operation_number, notes").eq("project_id", pid).order("collected_at"),
    getPhases(pid),
    getPaymentsSeries(pid),
  ]);

  const collBy = new Map<string, { amount: number; collected_at: string; operation_number: string | null }[]>();
  (colls ?? []).forEach((c) => collBy.set(c.valuation_id, [...(collBy.get(c.valuation_id) ?? []), { amount: toNum(c.amount), collected_at: c.collected_at, operation_number: c.operation_number }]));
  const phaseName = new Map(phases.map((p) => [p.id, p]));

  const rows: ValRow[] = (vals ?? []).map((v) => {
    const c = collBy.get(v.id) ?? [];
    const approved = toNum(v.approved_amount);
    const invoicedWithIgv = INVOICED.includes(v.status) ? Math.round(approved * 118) / 100 : 0;
    const collected = c.reduce((s, x) => s + x.amount, 0);
    return {
      id: v.id, number: v.number, period_start: v.period_start ?? "", period_end: v.period_end ?? "", phase_id: v.phase_id, phase: v.phase_id ? phaseName.get(v.phase_id)?.code ?? "" : "",
      presented: toNum(v.presented_amount), approved, invoice_number: v.invoice_number, invoice_date: v.invoice_date, status: v.status, notes: v.notes,
      invoicedWithIgv, collected, receivable: Math.max(0, invoicedWithIgv - collected), collections: c, last_collection: c.length ? c[c.length - 1].collected_at : null,
    };
  });

  const paidByPhase = new Map<string, number>();
  payments.forEach((p) => p.phase_id && paidByPhase.set(p.phase_id, (paidByPhase.get(p.phase_id) ?? 0) + p.cost));
  const phaseRows: PhaseRow[] = phases.map((ph) => {
    const vs = rows.filter((r) => r.phase_id === ph.id);
    const valued = vs.filter((r) => VALUED.includes(r.status)).reduce((s, r) => s + r.approved, 0);
    const invoiced = vs.filter((r) => INVOICED.includes(r.status)).reduce((s, r) => s + r.approved, 0);
    const spent = paidByPhase.get(ph.id) ?? 0;
    return {
      id: ph.id, code: ph.code, name: ph.name, color: ph.color ?? "#035AA6", sale: ph.sale_amount, saleIgv: ph.sale_amount * 1.18, invoiced, invoicedIgv: invoiced * 1.18,
      pctInvoiced: ph.sale_amount ? invoiced / ph.sale_amount : 0, pending: ph.sale_amount - invoiced, pendingIgv: (ph.sale_amount - invoiced) * 1.18,
      pctPending: ph.sale_amount ? (ph.sale_amount - invoiced) / ph.sale_amount : 0, valued, spent, cpi: spent > 0 ? valued / spent : 0,
    };
  });

  const contract = toNum(ctx.project.contract_amount);
  const valued = rows.filter((r) => VALUED.includes(r.status)).reduce((s, r) => s + r.approved, 0);
  const collected = rows.reduce((s, r) => s + r.collected, 0);
  const receivable = rows.reduce((s, r) => s + r.receivable, 0);
  const toInvoice = rows.filter((r) => r.status === "aprobada").reduce((s, r) => s + r.approved, 0);
  const spentTotal = payments.reduce((s, p) => s + p.cost, 0);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`${ctx.project.code} · Contabilidad`} title="Valorizaciones y cobros"
        description="Cada valorización presentada al cliente, su aprobación, la factura emitida y los abonos recibidos. Montos de valorización sin IGV; cobros con IGV." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Monto del contrato" value={contract} tone="navy" icon={<Landmark className="h-4 w-4" />} sub="Sin IGV" />
        <KpiCard label="Valorizado aprobado" value={valued} tone="blue" icon={<FileCheck2 className="h-4 w-4" />} sub={`${rows.filter((r) => VALUED.includes(r.status)).length} valorizaciones`} />
        <KpiCard label="Avance económico" value={contract ? valued / contract : 0} format="pct" tone="violet" icon={<PieChart className="h-4 w-4" />} sub={`Saldo por valorizar ${pct(contract ? 1 - valued / contract : 0)}`} />
        <KpiCard label="Cobrado (con IGV)" value={collected} tone="green" icon={<HandCoins className="h-4 w-4" />} sub={`CPI global ${spentTotal ? (valued / spentTotal).toFixed(2) : "—"}`} />
        <KpiCard label="Por cobrar (con IGV)" value={receivable} tone="amber" icon={<Receipt className="h-4 w-4" />} sub={`Por facturar: S/ ${toInvoice.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`} />
      </div>
      <ValuationsView rows={rows} phases={phaseRows} refx={{ company, project }}
        canManage={can(ctx.role, "registerValuation") && ctx.project.status !== "cerrada"} canCollect={can(ctx.role, "registerCollection") && ctx.project.status !== "cerrada"}
        meta={{ filename: `valorizaciones-${ctx.project.code}`, company: ctx.company.legal_name ?? ctx.company.name, project: `${ctx.project.code} · ${ctx.project.name}`, user: ctx.profile.full_name }} />
    </div>
  );
}
