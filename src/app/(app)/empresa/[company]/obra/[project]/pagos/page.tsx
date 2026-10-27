import type { Metadata } from "next";
import { AlarmClock, Banknote, CalendarCheck2, CircleDollarSign } from "lucide-react";
import { KpiCard } from "@/components/ui/cont-kit";
import { DateRangeFilter, FilterBar, UrlSegment, UrlSelect } from "@/components/ui/filters";
import { PageHeader } from "@/components/ui/primitives";
import { addDaysISO, money, toNum, todayISO } from "@/lib/format";
import { can } from "@/lib/permissions";
import { getProjectContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { LimaExpenseButton } from "./_components/lima-expense";
import { PaymentsHistory, PendingPayments, type PayRow, type PendingRow } from "./_components/payments-view";

export const metadata: Metadata = { title: "Pagos" };

type SP = { desde?: string; hasta?: string; proveedor?: string; wbs?: string; tab?: string; gasto?: string };

export default async function PagosPage({ params, searchParams }: { params: Promise<{ company: string; project: string }>; searchParams: Promise<SP> }) {
  const { company, project } = await params;
  const sp = await searchParams;
  const ctx = await getProjectContext(company, project);
  const sb = await supabaseServer();
  const pid = ctx.project.id;
  const tab = sp.tab === "historial" ? "historial" : "pendientes";

  const [{ data: pend }, { data: paidRows }, { data: pays }, { data: suppliers }, { data: phases }, { data: leaves }] = await Promise.all([
    sb.from("expenses")
      .select("id, seq, doc_type, series, doc_number, description, issue_date, reception_date, due_date, payable_pen, total_pen, cost_pen, retention_pen, origin, status, category, supplier_id, wbs_id, supplier:suppliers(name, ruc, bank, account_number), wbs:wbs_nodes(code, name), phase:phases(code)")
      .eq("project_id", pid).in("status", ["aprobado", "pagado_parcial"]).order("due_date").limit(2000),
    sb.from("v_expense_paid").select("expense_id, paid_pen, payments_count, last_paid_at").eq("project_id", pid).limit(5000),
    sb.from("payments")
      .select("id, paid_at, amount_pen, percentage, method, bank, operation_number, notes, voided, void_reason, expense_id, registrar:profiles(full_name), expense:expenses(seq, doc_type, series, doc_number, description, supplier_id, wbs_id, supplier:suppliers(name, ruc), wbs:wbs_nodes(code, name))")
      .eq("project_id", pid).order("paid_at", { ascending: false }).order("created_at", { ascending: false }).limit(3000),
    sb.from("suppliers").select("id, name, ruc, kind").eq("company_id", ctx.company.id).order("name"),
    sb.from("phases").select("id, code, name").eq("project_id", pid).order("sort"),
    sb.from("wbs_nodes").select("id, code, name, phase_id").eq("project_id", pid).eq("is_leaf", true).order("sort"),
  ]);

  const paid = new Map((paidRows ?? []).map((r) => [r.expense_id, r]));
  const today = todayISO();
  const in7 = addDaysISO(today, 7);
  const month = today.slice(0, 7);

  const pending: PendingRow[] = (pend ?? []).map((e) => {
    const s = e.supplier as unknown as { name: string; ruc: string; bank: string | null; account_number: string | null } | null;
    const w = e.wbs as unknown as { code: string; name: string } | null;
    const p = paid.get(e.id);
    const payable = toNum(e.payable_pen);
    const paidPen = toNum(p?.paid_pen);
    return {
      id: e.id, seq: e.seq ?? 0, doc_type: e.doc_type, series: e.series, doc_number: e.doc_number, description: e.description,
      issue_date: e.issue_date, due_date: e.due_date ?? e.issue_date, payable, paid: paidPen, balance: Math.max(0, Math.round((payable - paidPen) * 100) / 100),
      retention: toNum(e.retention_pen), origin: e.origin, status: e.status, supplier_id: e.supplier_id, supplier: s?.name ?? "—", ruc: s?.ruc ?? "",
      bank: s?.bank ?? null, account: s?.account_number ?? null, wbs_id: e.wbs_id, wbs_code: w?.code ?? "", wbs_name: w?.name ?? "",
      phase: (e.phase as unknown as { code: string } | null)?.code ?? "", payments: p?.payments_count ?? 0,
    };
  });

  const inRange = (d: string | null) => (!sp.desde || (d ?? "") >= sp.desde) && (!sp.hasta || (d ?? "") <= sp.hasta);
  const filteredPending = pending.filter((r) => inRange(r.due_date) && (!sp.proveedor || r.supplier_id === sp.proveedor) && (!sp.wbs || r.wbs_id === sp.wbs));

  const history: PayRow[] = (pays ?? []).map((p) => {
    const e = p.expense as unknown as { seq: number; doc_type: string; series: string | null; doc_number: string | null; description: string; supplier_id: string; wbs_id: string; supplier: { name: string; ruc: string } | null; wbs: { code: string; name: string } | null } | null;
    return {
      id: p.id, paid_at: p.paid_at, amount: toNum(p.amount_pen), percentage: toNum(p.percentage), method: p.method, bank: p.bank, operation_number: p.operation_number,
      notes: p.notes, voided: p.voided, void_reason: p.void_reason, registrar: (p.registrar as unknown as { full_name: string } | null)?.full_name ?? "—",
      doc_type: e?.doc_type ?? "", series: e?.series ?? null, doc_number: e?.doc_number ?? null, description: e?.description ?? "", supplier: e?.supplier?.name ?? "—",
      ruc: e?.supplier?.ruc ?? "", supplier_id: e?.supplier_id ?? "", wbs_id: e?.wbs_id ?? "", wbs_code: e?.wbs?.code ?? "",
    };
  });
  const filteredHistory = history.filter((r) => inRange(r.paid_at) && (!sp.proveedor || r.supplier_id === sp.proveedor) && (!sp.wbs || r.wbs_id === sp.wbs));

  const porPagar = pending.reduce((s, r) => s + r.balance, 0);
  const vencido = pending.filter((r) => r.due_date < today).reduce((s, r) => s + r.balance, 0);
  const proximo = pending.filter((r) => r.due_date >= today && r.due_date <= in7).reduce((s, r) => s + r.balance, 0);
  const pagadoMes = history.filter((r) => !r.voided && r.paid_at.startsWith(month)).reduce((s, r) => s + r.amount, 0);
  const pagadoMesN = history.filter((r) => !r.voided && r.paid_at.startsWith(month)).length;

  const canPay = can(ctx.role, "registerPayment") && ctx.project.status !== "cerrada";
  const ref = { company, project };
  const supplierOpts = (suppliers ?? []).map((s) => ({ value: s.id, label: s.name }));
  const usedSuppliers = new Set([...pending.map((r) => r.supplier_id), ...history.map((r) => r.supplier_id)]);
  const meta = { company: ctx.company.legal_name ?? ctx.company.name, project: `${ctx.project.code} · ${ctx.project.name}`, user: ctx.profile.full_name };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${ctx.project.code} · Contabilidad`}
        title="Pagos a proveedores"
        description="Bandeja de comprobantes aprobados por Gerencia y pendientes de pago. Cada pago descuenta automáticamente el saldo del WBS y actualiza su barra de consumo."
        actions={canPay ? <LimaExpenseButton refx={ref} ids={{ companyId: ctx.company.id, projectId: pid }} suppliers={suppliers ?? []} phases={phases ?? []} leaves={leaves ?? []} exchangeRate={Number(ctx.project.exchange_rate)} /> : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Saldo por pagar" value={porPagar} tone="blue" icon={<CircleDollarSign className="h-4 w-4" />} sub={`${pending.length} comprobantes aprobados`} />
        <KpiCard label="Vencido" value={vencido} tone="red" icon={<AlarmClock className="h-4 w-4" />} sub={`${pending.filter((r) => r.due_date < today).length} comprobantes fuera de plazo`} />
        <KpiCard label="Vence en 7 días" value={proximo} tone="amber" icon={<CalendarCheck2 className="h-4 w-4" />} sub="Programar en la próxima transferencia" />
        <KpiCard label="Pagado este mes" value={pagadoMes} tone="green" icon={<Banknote className="h-4 w-4" />} sub={`${pagadoMesN} amortizaciones registradas`} />
      </div>

      <FilterBar>
        <UrlSegment name="tab" options={[{ value: "pendientes", label: "Por pagar", count: filteredPending.length }, { value: "historial", label: "Pagos registrados", count: filteredHistory.length }]} />
        <DateRangeFilter />
        <UrlSelect name="proveedor" placeholder="Todos los proveedores" options={supplierOpts.filter((o) => usedSuppliers.has(o.value))} className="max-w-[220px]" />
        <UrlSelect name="wbs" placeholder="Todos los WBS" options={(leaves ?? []).map((l) => ({ value: l.id, label: `${l.code} · ${l.name}` }))} className="max-w-[220px]" />
      </FilterBar>

      {!canPay && (
        <p className="rounded-xl bg-brand-blue-50 px-4 py-3 text-xs text-brand-blue">
          Vista de consulta. El registro de pagos y amortizaciones corresponde al área de Contabilidad. Saldo total por pagar: <b className="num">{money(porPagar)}</b>.
        </p>
      )}

      {tab === "pendientes" ? (
        <PendingPayments initialId={sp.gasto} rows={filteredPending} canPay={canPay} refx={ref} today={today} meta={meta} />
      ) : (
        <PaymentsHistory rows={filteredHistory} canVoid={canPay} refx={ref} meta={meta} />
      )}
    </div>
  );
}
