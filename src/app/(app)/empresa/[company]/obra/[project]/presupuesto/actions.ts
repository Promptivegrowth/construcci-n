"use server";
import { revalidatePath } from "next/cache";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { getProjectContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

/** Adicional, deductivo o reasignación versionada sobre un WBS de último nivel. */
export async function applyBudgetChange(companyCode: string, projectCode: string, input: { wbsId: string; type: string; amount: number; reason: string }): Promise<ActionResult> {
  const ctx = await getProjectContext(companyCode, projectCode);
  if (!can(ctx.role, "editBudget")) return { ok: false, error: "Solo Gerencia puede modificar el presupuesto." };
  if (ctx.project.status === "cerrada") return { ok: false, error: "La obra está cerrada (solo lectura)." };
  if (!input.reason.trim()) return { ok: false, error: "Indica el motivo del cambio." };
  if (!input.amount) return { ok: false, error: "El monto no puede ser cero." };
  const signed = input.type === "deductivo" ? -Math.abs(input.amount) : input.type === "adicional" ? Math.abs(input.amount) : input.amount;
  const sb = await supabaseServer();
  const { error } = await sb.rpc("apply_budget_change", { p_wbs: input.wbsId, p_type: input.type, p_amount: signed, p_reason: input.reason.trim() });
  if (error) return { ok: false, error: friendlyError(error) };
  await sb.rpc("refresh_project_alerts", { p_project: ctx.project.id });
  revalidatePath(`/empresa/${companyCode}/obra/${projectCode}`, "layout");
  return { ok: true, message: "Presupuesto actualizado y versionado" };
}

/** Margen objetivo del WBS (monto meta = presupuesto − margen). */
export async function updateMargin(companyCode: string, projectCode: string, wbsId: string, margin: number): Promise<ActionResult> {
  const ctx = await getProjectContext(companyCode, projectCode);
  if (!can(ctx.role, "editBudget")) return { ok: false, error: "Sin permiso." };
  const sb = await supabaseServer();
  const { error } = await sb.from("wbs_nodes").update({ margin }).eq("id", wbsId).eq("project_id", ctx.project.id);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath(`/empresa/${companyCode}/obra/${projectCode}/presupuesto`, "layout");
  return { ok: true, message: "Margen actualizado" };
}

export type ImportRow = { code: string; name: string; parent: string | null; level: number; phase: string | null; costCenter: string | null; costType: string | null; budget: number; margin: number };

/**
 * Importación del presupuesto aprobado. Si la obra no tiene comprobantes se reemplaza la estructura;
 * si ya tiene movimientos, se agregan partidas nuevas y se versionan los cambios de monto.
 */
export async function importBudget(companyCode: string, projectCode: string, rows: ImportRow[]): Promise<ActionResult<{ created: number; updated: number; replaced: boolean }>> {
  const ctx = await getProjectContext(companyCode, projectCode);
  if (!can(ctx.role, "importBudget")) return { ok: false, error: "Solo Gerencia puede importar presupuestos." };
  if (ctx.project.status === "cerrada") return { ok: false, error: "La obra está cerrada (solo lectura)." };
  const sb = await supabaseServer();
  const pid = ctx.project.id;
  const [{ data: phases }, { data: existing }, { count }] = await Promise.all([
    sb.from("phases").select("id, code").eq("project_id", pid),
    sb.from("wbs_nodes").select("id, code, budget, is_leaf").eq("project_id", pid),
    sb.from("expenses").select("id", { count: "exact", head: true }).eq("project_id", pid),
  ]);
  const { count: orders } = await sb.from("orders").select("id", { count: "exact", head: true }).eq("project_id", pid);
  const phaseId = new Map((phases ?? []).map((f) => [f.code.toUpperCase(), f.id]));
  // Fases nuevas que vienen en el Excel
  const missing = [...new Set(rows.map((r) => r.phase?.toUpperCase()).filter((c): c is string => !!c && !phaseId.has(c)))];
  if (missing.length) {
    const { data: created, error } = await sb.from("phases").insert(missing.map((c, i) => ({ project_id: pid, code: c, name: `Fase ${c.replace(/\D/g, "") || c}`, sort: (phases?.length ?? 0) + i + 1 }))).select("id, code");
    if (error) return { ok: false, error: friendlyError(error) };
    created?.forEach((f) => phaseId.set(f.code.toUpperCase(), f.id));
  }

  const replace = !count && !orders;
  const ids = new Map<string, string>();
  let created = 0, updated = 0;
  if (replace && existing?.length) {
    const { error } = await sb.from("wbs_nodes").delete().eq("project_id", pid);
    if (error) return { ok: false, error: friendlyError(error) };
  } else existing?.forEach((e) => ids.set(e.code, e.id));

  const ordered = [...rows].sort((a, b) => a.level - b.level);
  let sort = replace ? 0 : existing?.length ?? 0;
  for (const level of [1, 2, 3]) {
    const batch = ordered.filter((r) => r.level === level && (replace || !ids.has(r.code)));
    if (!batch.length) continue;
    const payload = batch.map((r) => ({
      project_id: pid, code: r.code, name: r.name, level: r.level, parent_id: r.parent ? ids.get(r.parent) ?? null : null,
      phase_id: r.phase ? phaseId.get(r.phase.toUpperCase()) ?? null : null, cost_center: r.costCenter, cost_type: r.costType,
      budget: rows.some((x) => x.parent === r.code) ? 0 : r.budget, margin: r.margin, sort: ++sort,
    }));
    const { data, error } = await sb.from("wbs_nodes").insert(payload).select("id, code, budget, is_leaf");
    if (error) return { ok: false, error: friendlyError(error) };
    data?.forEach((d) => ids.set(d.code, d.id));
    created += data?.length ?? 0;
    const logs = (data ?? []).filter((d) => Number(d.budget) > 0).map((d) => ({ project_id: pid, wbs_id: d.id, change_type: "importacion", amount: d.budget, previous_budget: 0, new_budget: d.budget, reason: "Importación del presupuesto aprobado (Excel)", created_by: ctx.user.id }));
    if (logs.length) await sb.from("budget_changes").insert(logs);
  }
  if (!replace) {
    for (const r of rows) {
      const ex = existing?.find((e) => e.code === r.code);
      if (!ex || !ex.is_leaf) continue;
      const diff = Math.round((r.budget - Number(ex.budget)) * 100) / 100;
      if (Math.abs(diff) < 0.01) continue;
      const { error } = await sb.rpc("apply_budget_change", { p_wbs: ex.id, p_type: diff > 0 ? "adicional" : "deductivo", p_amount: diff, p_reason: "Actualización por importación de presupuesto (Excel)" });
      if (error) return { ok: false, error: `${r.code}: ${friendlyError(error)}` };
      updated++;
    }
  }
  await sb.rpc("refresh_project_alerts", { p_project: pid });
  revalidatePath(`/empresa/${companyCode}/obra/${projectCode}`, "layout");
  return { ok: true, data: { created, updated, replaced: replace }, message: replace ? "Presupuesto importado" : "Presupuesto actualizado" };
}
