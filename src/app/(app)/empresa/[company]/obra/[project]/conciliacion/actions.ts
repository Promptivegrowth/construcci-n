"use server";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { toNum } from "@/lib/format";
import { getProjectContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export type DiffDoc = {
  id: string; doc_type: string; series: string | null; doc_number: string | null; description: string; supplier: string; issue_date: string;
  origin: string; status: string; cost: number; paidCost: number; gap: number;
};

/** Comprobantes de un WBS que explican la diferencia Declarado vs Pagado. */
export async function differenceDetailAction(ref: { company: string; project: string }, wbsIds: string[]): Promise<ActionResult<DiffDoc[]>> {
  try {
    const ctx = await getProjectContext(ref.company, ref.project);
    const sb = await supabaseServer();
    const { data, error } = await sb
      .from("expense_allocations")
      .select("amount_pen, wbs_id, expense:expenses!inner(id, project_id, doc_type, series, doc_number, description, issue_date, origin, status, payable_pen, supplier:suppliers(name))")
      .in("wbs_id", wbsIds)
      .eq("expense.project_id", ctx.project.id)
      .limit(3000);
    if (error) return { ok: false, error: friendlyError(error) };
    const exps = (data ?? []).map((a) => ({ a, e: a.expense as unknown as { id: string; doc_type: string; series: string | null; doc_number: string | null; description: string; issue_date: string; origin: string; status: string; payable_pen: number; supplier: { name: string } | null } }))
      .filter(({ e }) => e && !["borrador", "anulado"].includes(e.status));
    const ids = [...new Set(exps.map(({ e }) => e.id))];
    const { data: paid } = ids.length ? await sb.from("v_expense_paid").select("expense_id, paid_pen").in("expense_id", ids) : { data: [] };
    const paidMap = new Map((paid ?? []).map((p) => [p.expense_id, toNum(p.paid_pen)]));
    const docs: DiffDoc[] = exps.map(({ a, e }) => {
      const cost = toNum(a.amount_pen);
      const ratio = toNum(e.payable_pen) > 0 ? Math.min(1, (paidMap.get(e.id) ?? 0) / toNum(e.payable_pen)) : 0;
      const paidCost = Math.round(cost * ratio * 100) / 100;
      const declared = e.origin === "lima" ? 0 : cost;
      return { id: e.id, doc_type: e.doc_type, series: e.series, doc_number: e.doc_number, description: e.description, supplier: e.supplier?.name ?? "—",
        issue_date: e.issue_date, origin: e.origin, status: e.status, cost, paidCost, gap: Math.round((paidCost - declared) * 100) / 100 };
    });
    return { ok: true, data: docs.filter((d) => Math.abs(d.gap) >= 0.5).sort((a, b) => (a.issue_date < b.issue_date ? 1 : -1)) };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}
