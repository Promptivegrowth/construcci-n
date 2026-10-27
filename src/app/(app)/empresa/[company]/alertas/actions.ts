"use server";
import { revalidatePath } from "next/cache";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { getCompanyContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export async function resolveAlert(companyCode: string, alertId: string, resolved = true): Promise<ActionResult> {
  try {
    const ctx = await getCompanyContext(companyCode);
    if (!["gerente_general", "gerente_proyectos", "administrador", "contabilidad"].includes(ctx.role)) {
      return { ok: false, error: "Tu rol no puede marcar alertas como resueltas." };
    }
    const sb = await supabaseServer();
    const { error } = await sb.from("alerts")
      .update({ resolved, resolved_by: resolved ? ctx.user.id : null, resolved_at: resolved ? new Date().toISOString() : null })
      .eq("id", alertId).eq("company_id", ctx.company.id);
    if (error) return { ok: false, error: friendlyError(error) };
    revalidatePath(`/empresa/${companyCode}`, "layout");
    return { ok: true, message: resolved ? "Alerta marcada como resuelta" : "Alerta reabierta" };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function refreshAlerts(companyCode: string): Promise<ActionResult<{ count: number }>> {
  try {
    const ctx = await getCompanyContext(companyCode);
    const sb = await supabaseServer();
    const { data: projects } = await sb.from("projects").select("id").eq("company_id", ctx.company.id);
    let count = 0;
    for (const p of projects ?? []) {
      const { data, error } = await sb.rpc("refresh_project_alerts", { p_project: p.id });
      if (error) return { ok: false, error: friendlyError(error) };
      count += Number(data ?? 0);
    }
    revalidatePath(`/empresa/${companyCode}`, "layout");
    return { ok: true, data: { count }, message: `Alertas recalculadas en ${projects?.length ?? 0} obras` };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}
