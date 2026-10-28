import type { Metadata } from "next";
import { AlarmClock, Hourglass, ShieldHalf, Wallet } from "lucide-react";
import { KpiCard } from "@/components/ui/cont-kit";
import { PageHeader } from "@/components/ui/primitives";
import { toNum, todayISO } from "@/lib/format";
import { getProjectContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { CxpView, type CxpRow, type RetentionRow } from "./_components/cxp-view";
import { canView } from "@/lib/permissions";
import { NoAccess } from "@/components/ui/no-access";

export const metadata: Metadata = { title: "Cuentas por pagar" };

const BUCKETS = ["Por vencer", "1–15 días", "16–30 días", "31–60 días", "> 60 días"] as const;

function bucketOf(due: string, today: string) {
  const d = Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${due}T12:00:00`).getTime()) / 86400000);
  if (d <= 0) return 0;
  if (d <= 15) return 1;
  if (d <= 30) return 2;
  if (d <= 60) return 3;
  return 4;
}

export default async function CxpPage({ params }: { params: Promise<{ company: string; project: string }> }) {
  const { company, project } = await params;
  const ctx = await getProjectContext(company, project);
  if (!canView(ctx.role, "accounting")) return <NoAccess role={ctx.role} area="accounting" back={`/empresa/${company}/obra/${project}`} backLabel="Volver a la obra" />;
  const sb = await supabaseServer();
  const pid = ctx.project.id;
  const today = todayISO();

  const [{ data: exps }, { data: paidRows }] = await Promise.all([
    sb.from("expenses")
      .select("id, seq, doc_type, series, doc_number, description, issue_date, due_date, payable_pen, total_pen, retention_pen, retention_pct, status, origin, supplier_id, supplier:suppliers(name, ruc), wbs:wbs_nodes(code, name)")
      .eq("project_id", pid).in("status", ["declarado", "observado", "aprobado", "pagado_parcial", "pagado"]).limit(5000),
    sb.from("v_expense_paid").select("expense_id, paid_pen, last_paid_at").eq("project_id", pid).limit(5000),
  ]);
  const paid = new Map((paidRows ?? []).map((r) => [r.expense_id, r]));

  const rows: CxpRow[] = [];
  const retention: RetentionRow[] = [];
  let pendingApproval = 0;
  for (const e of exps ?? []) {
    const s = e.supplier as unknown as { name: string; ruc: string } | null;
    const w = e.wbs as unknown as { code: string; name: string } | null;
    const payable = toNum(e.payable_pen);
    const p = toNum(paid.get(e.id)?.paid_pen);
    if (e.status === "declarado" || e.status === "observado") pendingApproval += payable;
    if (toNum(e.retention_pen) > 0) {
      retention.push({ id: e.id, supplier: s?.name ?? "—", ruc: s?.ruc ?? "", doc: [e.series, e.doc_number].filter(Boolean).join("-"), issue_date: e.issue_date,
        description: e.description, pct: toNum(e.retention_pct), amount: toNum(e.retention_pen), status: e.status === "pagado" ? "Por devolver" : "Retenido (factura en curso)",
        releasable: e.status === "pagado" });
    }
    if (!["aprobado", "pagado_parcial"].includes(e.status)) continue;
    const balance = Math.max(0, Math.round((payable - p) * 100) / 100);
    if (balance <= 0) continue;
    const due = e.due_date ?? e.issue_date;
    rows.push({
      id: e.id, seq: e.seq ?? 0, doc_type: e.doc_type, series: e.series, doc_number: e.doc_number, description: e.description, issue_date: e.issue_date, due_date: due,
      supplier_id: e.supplier_id ?? "", supplier: s?.name ?? "—", ruc: s?.ruc ?? "", wbs: w ? `${w.code} · ${w.name}` : "", payable, paid: p, balance,
      bucket: bucketOf(due, today), origin: e.origin,
    });
  }

  const total = rows.reduce((s, r) => s + r.balance, 0);
  const overdue = rows.filter((r) => r.bucket > 0).reduce((s, r) => s + r.balance, 0);
  const retained = retention.reduce((s, r) => s + r.amount, 0);
  const releasable = retention.filter((r) => r.releasable).reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`${ctx.project.code} · Contabilidad`} title="Cuentas por pagar"
        description="Saldos de comprobantes aprobados por proveedor y por antigüedad de vencimiento, más el fondo de garantía retenido a subcontratistas." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total por pagar" value={total} tone="blue" icon={<Wallet className="h-4 w-4" />} sub={`${rows.length} comprobantes · ${new Set(rows.map((r) => r.supplier_id)).size} proveedores`} />
        <KpiCard label="Vencido" value={overdue} tone="red" icon={<AlarmClock className="h-4 w-4" />} sub={`${total ? Math.round((overdue / total) * 100) : 0}% de la deuda`} />
        <KpiCard label="Por aprobar (aún no exigible)" value={pendingApproval} tone="violet" icon={<Hourglass className="h-4 w-4" />} sub="Declarado u observado por la obra" />
        <KpiCard label="Fondo de garantía retenido" value={retained} tone="amber" icon={<ShieldHalf className="h-4 w-4" />} sub={`Por devolver: S/ ${releasable.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`} />
      </div>
      <CxpView rows={rows} retention={retention} buckets={[...BUCKETS]}
        meta={{ filename: `cuentas-por-pagar-${ctx.project.code}`, company: ctx.company.legal_name ?? ctx.company.name, project: `${ctx.project.code} · ${ctx.project.name}`, user: ctx.profile.full_name }}
        base={`/empresa/${company}/obra/${project}`} />
    </div>
  );
}
