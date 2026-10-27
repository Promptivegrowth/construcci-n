import "server-only";
import { cache } from "react";
import { supabaseServer } from "@/lib/supabase/server";
import { normalizeStats, totals, type WbsStatRow } from "@/lib/calc";
import { toNum } from "@/lib/format";

export type ProjectStat = WbsStatRow & { cost_center: string | null };

/** Estadísticas por WBS (vista v_wbs_stats) con el centro de costo. */
export const getWbsStats = cache(async (projectId: string): Promise<ProjectStat[]> => {
  const sb = await supabaseServer();
  const [{ data: stats }, { data: nodes }] = await Promise.all([
    sb.from("v_wbs_stats").select("*").eq("project_id", projectId).order("sort"),
    sb.from("wbs_nodes").select("id, cost_center").eq("project_id", projectId),
  ]);
  const cc = new Map((nodes ?? []).map((n) => [n.id, n.cost_center]));
  return normalizeStats((stats ?? []) as Record<string, unknown>[]).map((s) => ({ ...s, cost_center: cc.get(s.wbs_id) ?? null }));
});

export const getPhases = cache(async (projectId: string) => {
  const sb = await supabaseServer();
  const { data } = await sb.from("phases").select("*").eq("project_id", projectId).order("sort");
  return (data ?? []).map((p) => ({ ...p, sale_amount: toNum(p.sale_amount) }));
});

/** Resumen por obra para tableros de empresa y holding. */
export async function getProjectsSummary(projectIds: string[]) {
  if (!projectIds.length) return new Map<string, ReturnType<typeof totals>>();
  const sb = await supabaseServer();
  const { data } = await sb.from("v_wbs_stats").select("*").in("project_id", projectIds).eq("is_leaf", true).limit(5000);
  const rows = normalizeStats((data ?? []) as Record<string, unknown>[]);
  const by = new Map<string, WbsStatRow[]>();
  rows.forEach((r) => {
    const pid = (r as unknown as { project_id: string }).project_id;
    by.set(pid, [...(by.get(pid) ?? []), r]);
  });
  return new Map(projectIds.map((id) => [id, totals(by.get(id) ?? [])]));
}

/** Pagos (egresos) por fecha para curvas y flujos, prorrateados al costo cargado. */
export const getPaymentsSeries = cache(async (projectId: string) => {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("payments")
    .select("paid_at, amount_pen, expense:expenses(cost_pen, payable_pen, phase_id, wbs_id)")
    .eq("project_id", projectId)
    .eq("voided", false)
    .order("paid_at")
    .limit(5000);
  return (data ?? []).map((p) => {
    const e = p.expense as unknown as { cost_pen: number; payable_pen: number; phase_id: string | null; wbs_id: string | null } | null;
    const factor = e && toNum(e.payable_pen) > 0 ? toNum(e.cost_pen) / toNum(e.payable_pen) : 1;
    return { date: p.paid_at, amount: toNum(p.amount_pen), cost: toNum(p.amount_pen) * factor, phase_id: e?.phase_id ?? null, wbs_id: e?.wbs_id ?? null };
  });
});

/** Comprobantes declarados (no borrador ni anulados) para series de “Declarado por obra”. */
export const getDeclaredSeries = cache(async (projectId: string) => {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("expenses")
    .select("issue_date, cost_pen, origin, phase_id, wbs_id, category")
    .eq("project_id", projectId)
    .not("status", "in", "(borrador,anulado)")
    .order("issue_date")
    .limit(5000);
  return (data ?? []).map((e) => ({ date: e.issue_date, cost: toNum(e.cost_pen), origin: e.origin, phase_id: e.phase_id, wbs_id: e.wbs_id, category: e.category }));
});
