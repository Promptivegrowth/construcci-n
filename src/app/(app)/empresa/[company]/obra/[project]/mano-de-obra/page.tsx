import type { Metadata } from "next";
import { can } from "@/lib/permissions";
import { getPhases } from "@/lib/queries";
import { getProjectContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { toNum } from "@/lib/format";
import { LaborView, type LaborPayroll } from "./_components/labor-view";

export const metadata: Metadata = { title: "Mano de obra" };

export default async function ManoDeObraPage({ params, searchParams }: {
  params: Promise<{ company: string; project: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { company, project } = await params;
  const sp = await searchParams;
  const ctx = await getProjectContext(company, project);
  const sb = await supabaseServer();
  const pid = ctx.project.id;

  const [{ data: payrolls }, { data: projections }, phases, { data: wbs }] = await Promise.all([
    sb.from("payrolls")
      .select("id, week, payroll_type, period_label, period_start, period_end, phase_id, wbs_id, total, expense_id, notes, created_at, payroll_lines(category, workers, days, amount), expense:expenses(status, payable_pen)")
      .eq("project_id", pid).order("period_end", { ascending: false }).limit(1000),
    sb.from("labor_projections").select("phase_id, category, amount, workers").eq("project_id", pid),
    getPhases(pid),
    sb.from("wbs_nodes").select("id, code, name, cost_type, phase_id").eq("project_id", pid).eq("is_leaf", true).order("sort"),
  ]);

  const expenseIds = (payrolls ?? []).map((p) => p.expense_id).filter(Boolean) as string[];
  const paidMap = new Map<string, number>();
  for (let i = 0; i < expenseIds.length; i += 150) {
    const { data } = await sb.from("v_expense_paid").select("expense_id, paid_pen").in("expense_id", expenseIds.slice(i, i + 150));
    (data ?? []).forEach((d) => paidMap.set(d.expense_id!, toNum(d.paid_pen)));
  }

  const wbsMap = new Map((wbs ?? []).map((w) => [w.id, w]));
  const phaseMap = new Map(phases.map((p) => [p.id, p]));
  const desde = sp.desde, hasta = sp.hasta, fase = sp.fase;

  const rows: LaborPayroll[] = (payrolls ?? [])
    .map((p) => {
      const e = p.expense as unknown as { status: string; payable_pen: number } | null;
      const payable = toNum(e?.payable_pen);
      const paid = paidMap.get(p.expense_id ?? "") ?? 0;
      return {
        id: p.id, week: p.week, type: p.payroll_type, label: p.period_label, start: p.period_start, end: p.period_end,
        phase_id: p.phase_id, phase_code: p.phase_id ? phaseMap.get(p.phase_id)?.code ?? "—" : "—",
        wbs: p.wbs_id ? `${wbsMap.get(p.wbs_id)?.code ?? ""}` : "—",
        total: toNum(p.total), status: e?.status ?? "declarado", paid, paidRatio: payable > 0 ? Math.min(paid / payable, 1) : 0,
        notes: p.notes,
        lines: ((p.payroll_lines ?? []) as { category: string; workers: number; days: number | null; amount: number }[]).map((l) => ({ ...l, amount: toNum(l.amount), workers: toNum(l.workers) })),
      };
    })
    .filter((r) => r.status !== "anulado")
    .filter((r) => (!desde || (r.end ?? "") >= desde) && (!hasta || (r.end ?? "") <= hasta) && (!fase || r.phase_id === fase));

  const laborWbs = (wbs ?? []).filter((w) => w.cost_type === "mano_obra" || w.cost_type === "gastos_generales");
  const lastWeek = Math.max(0, ...(payrolls ?? []).filter((p) => p.payroll_type === "obreros").map((p) => p.week ?? 0));

  return (
    <LaborView
      companyCode={company}
      projectCode={ctx.project.code}
      projectName={ctx.project.short_name ?? ctx.project.name}
      companyName={ctx.company.name}
      userName={ctx.profile.full_name}
      projectStart={ctx.project.start_date}
      payrolls={rows}
      projections={(projections ?? []).map((p) => ({ ...p, amount: toNum(p.amount) }))}
      phases={phases.map((p) => ({ id: p.id, code: p.code, name: p.name, start: p.start_date, end: p.end_date }))}
      wbs={laborWbs.map((w) => ({ id: w.id, code: w.code, name: w.name, phase_id: w.phase_id, cost_type: w.cost_type }))}
      nextWeek={lastWeek + 1}
      canRegister={can(ctx.role, "registerPayroll") && ctx.project.status !== "cerrada"}
      canEditProjection={can(ctx.role, "editBudget")}
      isConta={ctx.role === "contabilidad"}
      filtered={!!(desde || hasta || fase)}
    />
  );
}
