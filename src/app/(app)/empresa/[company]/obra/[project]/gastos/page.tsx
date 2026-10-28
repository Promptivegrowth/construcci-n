import type { Metadata } from "next";
import { AlertTriangle, CircleDollarSign, FileCheck2, Plus, ReceiptText, Send } from "lucide-react";
import { KpiCard } from "@/components/ui/adm-kpi";
import { DateRangeFilter, FilterBar, UrlSegment, UrlSelect } from "@/components/ui/filters";
import { Stagger, StaggerItem } from "@/components/ui/motion";
import { ButtonLink, Card, PageHeader } from "@/components/ui/primitives";
import { EXPENSE_STATUS } from "@/lib/calc";
import { DOC_TYPE_LABEL, toNum } from "@/lib/format";
import { can, canView } from "@/lib/permissions";
import { getProjectContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { ExpensesTable, type ExpenseRow } from "./_components/expenses-table";
import { NoAccess } from "@/components/ui/no-access";

export const metadata: Metadata = { title: "Gastos y comprobantes" };

type SP = Record<string, string | undefined>;

export default async function GastosPage({ params, searchParams }: { params: Promise<{ company: string; project: string }>; searchParams: Promise<SP> }) {
  const { company, project } = await params;
  const sp = await searchParams;
  const ctx = await getProjectContext(company, project);
  if (!canView(ctx.role, "finance")) return <NoAccess role={ctx.role} area="finance" back={`/empresa/${company}/obra/${project}`} backLabel="Volver a la obra" />;
  const sb = await supabaseServer();
  const pid = ctx.project.id;

  let q = sb.from("expenses")
    .select("id, seq, issue_date, due_date, doc_type, series, doc_number, description, category, total, currency, total_pen, cost_pen, payable_pen, status, origin, exceeds_budget, wbs_id, phase_id, order_id, created_at, supplier:suppliers(name, ruc), wbs:wbs_nodes(code, name), phase:phases(code), files:expense_files(count)")
    .eq("project_id", pid)
    .order("issue_date", { ascending: false })
    .order("seq", { ascending: false })
    .limit(3000);
  if (sp.fase) q = q.eq("phase_id", sp.fase);
  if (sp.wbs) q = q.eq("wbs_id", sp.wbs);
  if (sp.tipo) q = q.eq("doc_type", sp.tipo as "FT");
  if (sp.origen) q = q.eq("origin", sp.origen);
  if (sp.desde) q = q.gte("issue_date", sp.desde);
  if (sp.hasta) q = q.lte("issue_date", sp.hasta);

  const [{ data: expenses }, { data: paid }, { data: phases }, { data: leaves }] = await Promise.all([
    q,
    sb.from("v_expense_paid").select("expense_id, paid_pen").eq("project_id", pid).limit(5000),
    sb.from("phases").select("id, code, name").eq("project_id", pid).order("sort"),
    sb.from("wbs_nodes").select("id, code, name").eq("project_id", pid).eq("is_leaf", true).order("sort"),
  ]);
  const paidMap = new Map((paid ?? []).map((p) => [p.expense_id, toNum(p.paid_pen)]));

  const all: ExpenseRow[] = (expenses ?? []).map((e) => {
    const s = e.supplier as unknown as { name: string; ruc: string } | null;
    const w = e.wbs as unknown as { code: string; name: string } | null;
    const ph = e.phase as unknown as { code: string } | null;
    const paidPen = paidMap.get(e.id) ?? 0;
    return {
      id: e.id, seq: e.seq ?? 0, issue_date: e.issue_date, due_date: e.due_date, doc_type: e.doc_type, series: e.series, doc_number: e.doc_number,
      description: e.description, category: e.category, currency: e.currency, total: toNum(e.total), total_pen: toNum(e.total_pen), cost_pen: toNum(e.cost_pen),
      payable_pen: toNum(e.payable_pen), paid_pen: paidPen, balance: Math.max(0, toNum(e.payable_pen) - paidPen), status: e.status, origin: e.origin,
      exceeds_budget: e.exceeds_budget, supplier: s?.name ?? "—", ruc: s?.ruc ?? "", wbs_code: w?.code ?? "", wbs_name: w?.name ?? "", phase: ph?.code ?? "",
      files: (e.files as unknown as { count: number }[])?.[0]?.count ?? 0, has_order: !!e.order_id,
    };
  });

  const live = all.filter((e) => e.status !== "anulado" && e.status !== "borrador");
  const counts = Object.fromEntries(Object.keys(EXPENSE_STATUS).map((k) => [k, all.filter((e) => e.status === k).length]));
  const sum = (l: ExpenseRow[], k: "cost_pen" | "balance" | "paid_pen") => l.reduce((s, e) => s + e[k], 0);
  const kpi = {
    registered: sum(live, "cost_pen"),
    declared: sum(all.filter((e) => e.status === "declarado"), "cost_pen"),
    toPay: sum(all.filter((e) => e.status === "aprobado" || e.status === "pagado_parcial"), "balance"),
    paid: live.reduce((s, e) => s + (e.payable_pen > 0 ? e.cost_pen * Math.min(1, e.paid_pen / e.payable_pen) : 0), 0),
    observed: counts.observado ?? 0,
  };

  const estado = sp.estado ?? "todos";
  const rows = estado === "todos" ? all : estado === "por_pagar" ? all.filter((e) => e.status === "aprobado" || e.status === "pagado_parcial") : all.filter((e) => e.status === estado);
  const base = `/empresa/${company}/obra/${project}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${ctx.project.code} · Administración`}
        title="Gastos y comprobantes"
        description="Cada gasto se registra una sola vez, con su sustento, y se carga a la fase y WBS correspondientes. Contabilidad lo paga y la barra del WBS se actualiza sola."
        actions={can(ctx.role, "registerExpense") && ctx.project.status !== "cerrada" ? <ButtonLink href={`${base}/gastos/nuevo`}><Plus className="h-4 w-4" />Registrar gasto</ButtonLink> : null}
      />

      <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StaggerItem><KpiCard label="Registrado (costo)" value={kpi.registered} format="moneyShort" icon={<ReceiptText className="h-4 w-4" />} tone="navy" sub={`${live.length} comprobantes vigentes`} /></StaggerItem>
        <StaggerItem><KpiCard label="Declarado · por aprobar" value={kpi.declared} format="moneyShort" icon={<Send className="h-4 w-4" />} tone="violet" sub={`${counts.declarado ?? 0} en bandeja de Gerencia`} /></StaggerItem>
        <StaggerItem><KpiCard label="Aprobado · por pagar" value={kpi.toPay} format="moneyShort" icon={<FileCheck2 className="h-4 w-4" />} tone="blue" sub={`Saldo con IGV · ${(counts.aprobado ?? 0) + (counts.pagado_parcial ?? 0)} en Contabilidad`} /></StaggerItem>
        <StaggerItem><KpiCard label="Pagado por Contabilidad" value={kpi.paid} format="moneyShort" icon={<CircleDollarSign className="h-4 w-4" />} tone="green" sub="Costo cubierto por pagos (sin IGV)" /></StaggerItem>
        <StaggerItem className="col-span-2 lg:col-span-1"><KpiCard label="Observados" value={kpi.observed} format="int" icon={<AlertTriangle className="h-4 w-4" />} tone="amber" sub="Requieren corrección de la obra" /></StaggerItem>
      </Stagger>

      <FilterBar>
        <UrlSegment name="estado" options={[
          { value: "todos", label: "Todos", count: all.length },
          { value: "declarado", label: "Declarados", count: counts.declarado },
          { value: "observado", label: "Observados", count: counts.observado },
          { value: "por_pagar", label: "Por pagar", count: (counts.aprobado ?? 0) + (counts.pagado_parcial ?? 0) },
          { value: "pagado", label: "Pagados", count: counts.pagado },
          { value: "borrador", label: "Borradores", count: counts.borrador },
          { value: "anulado", label: "Anulados", count: counts.anulado },
        ]} />
        <div className="flex flex-wrap items-center gap-2">
          <UrlSelect name="fase" placeholder="Todas las fases" options={(phases ?? []).map((p) => ({ value: p.id, label: `${p.code} · ${p.name.split("·")[1]?.trim() ?? p.name}` }))} />
          <UrlSelect name="wbs" placeholder="Todos los WBS" className="max-w-[220px]" options={(leaves ?? []).map((w) => ({ value: w.id, label: `${w.code} ${w.name}` }))} />
          <UrlSelect name="tipo" placeholder="Tipo de doc." options={Object.entries(DOC_TYPE_LABEL).map(([v, l]) => ({ value: v, label: l }))} />
          <UrlSelect name="origen" placeholder="Origen" options={[{ value: "obra", label: "Obra" }, { value: "campo", label: "App de campo" }, { value: "lima", label: "Lima (central)" }]} />
        </div>
        <DateRangeFilter />
      </FilterBar>

      <Card className="overflow-hidden">
        <ExpensesTable rows={rows} base={base} meta={{ company: ctx.company.name, project: `${ctx.project.code} · ${ctx.project.name}`, user: ctx.profile.full_name }} />
      </Card>
    </div>
  );
}
