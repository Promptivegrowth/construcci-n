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
 * Importación del presupuesto aprobado, en una sola transacción de la base (import_budget): si algo falla
 * no queda nada a medias. Si la obra no tiene movimientos se reemplaza la estructura; si ya los tiene, se agregan
 * partidas nuevas y se versionan los cambios de monto. No se subdivide una partida que ya tiene gastos u órdenes.
 */
export async function importBudget(companyCode: string, projectCode: string, rows: ImportRow[]): Promise<ActionResult<{ created: number; updated: number; replaced: boolean }>> {
  try {
    const ctx = await getProjectContext(companyCode, projectCode);
    if (!can(ctx.role, "importBudget")) return { ok: false, error: "Solo Gerencia puede importar presupuestos." };
    if (ctx.project.status === "cerrada") return { ok: false, error: "La obra está cerrada (solo lectura)." };
    const sb = await supabaseServer();
    const { data, error } = await sb.rpc("import_budget", { p_project: ctx.project.id, p_rows: rows });
    if (error) return { ok: false, error: friendlyError(error) };
    const r = data as { created: number; updated: number; replaced: boolean };
    revalidatePath(`/empresa/${companyCode}/obra/${projectCode}`, "layout");
    return { ok: true, data: r, message: r.replaced ? "Presupuesto importado" : "Presupuesto actualizado" };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}
