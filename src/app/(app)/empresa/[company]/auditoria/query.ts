import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export const PAGE_SIZE = 30;

/** Consulta de audit_log con los filtros de la URL (tabla, acción, usuario, obra, fechas, búsqueda). */
export function buildAuditQuery(sb: SupabaseClient<Database>, companyId: string, sp: Record<string, string | undefined>, opts: { count?: boolean } = {}) {
  let q = sb.from("audit_log")
    .select("id, table_name, record_id, action, old_data, new_data, changed_by, changed_at, project_id", opts.count ? { count: "exact" } : undefined)
    .eq("company_id", companyId)
    .order("changed_at", { ascending: false })
    .order("id", { ascending: false });
  if (sp.tabla) q = q.eq("table_name", sp.tabla);
  if (sp.accion) q = q.eq("action", sp.accion);
  if (sp.usuario) q = q.eq("changed_by", sp.usuario);
  if (sp.obra) q = q.eq("project_id", sp.obra);
  if (sp.desde) q = q.gte("changed_at", `${sp.desde}T00:00:00-05:00`);
  if (sp.hasta) q = q.lte("changed_at", `${sp.hasta}T23:59:59-05:00`);
  const term = sp.q?.trim().replace(/[%,()*]/g, " ");
  if (term) {
    const like = `%${term}%`;
    q = q.or([
      `record_id.ilike.${like}`, `new_data->>doc_number.ilike.${like}`, `new_data->>description.ilike.${like}`, `new_data->>number.ilike.${like}`,
      `new_data->>code.ilike.${like}`, `new_data->>title.ilike.${like}`, `new_data->>operation_number.ilike.${like}`, `new_data->>reason.ilike.${like}`,
    ].join(","));
  }
  return q;
}
