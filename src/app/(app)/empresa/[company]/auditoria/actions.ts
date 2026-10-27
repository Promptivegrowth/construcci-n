"use server";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { getCompanyContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { ACTION_LABEL, TABLE_LABEL, summarize } from "./audit-meta";
import { buildAuditQuery } from "./query";

/** Exporta hasta 3000 eventos con los filtros activos. */
export async function exportAudit(companyCode: string, sp: Record<string, string | undefined>): Promise<ActionResult<Record<string, string>[]>> {
  try {
    const ctx = await getCompanyContext(companyCode);
    if (!can(ctx.role, "viewAudit")) return { ok: false, error: "Sin permiso" };
    const sb = await supabaseServer();
    const [{ data, error }, { data: people }, { data: projects }] = await Promise.all([
      buildAuditQuery(sb, ctx.company.id, sp).range(0, 2999),
      sb.from("profiles").select("id, full_name"),
      sb.from("projects").select("id, code").eq("company_id", ctx.company.id),
    ]);
    if (error) return { ok: false, error: friendlyError(error) };
    const name = new Map((people ?? []).map((p) => [p.id, p.full_name]));
    const code = new Map((projects ?? []).map((p) => [p.id, p.code]));
    return {
      ok: true,
      data: (data ?? []).map((a) => ({
        fecha: a.changed_at.slice(0, 10),
        hora: new Date(a.changed_at).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", timeZone: "America/Lima" }),
        usuario: a.changed_by ? name.get(a.changed_by) ?? "—" : "Sistema",
        accion: ACTION_LABEL[a.action]?.label ?? a.action,
        registro: TABLE_LABEL[a.table_name] ?? a.table_name,
        obra: a.project_id ? code.get(a.project_id) ?? "" : "",
        detalle: summarize(a.table_name, (a.new_data ?? a.old_data) as Record<string, unknown> | null),
        id: a.record_id ?? "",
      })),
    };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}
