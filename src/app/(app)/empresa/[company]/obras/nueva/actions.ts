"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { getCompanyContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

const schema = z.object({
  code: z.string().trim().toUpperCase().regex(/^\d{3}-[A-Z0-9]{2,6}$/, "Código con formato 013-ABCD"),
  name: z.string().trim().min(8, "Ingresa el nombre completo de la obra"),
  short_name: z.string().trim().min(3, "Ingresa un nombre corto").max(40),
  client_name: z.string().trim().min(3, "Ingresa el cliente"),
  client_ruc: z.string().trim().regex(/^(\d{11})?$/, "RUC de 11 dígitos").optional().nullable(),
  project_type: z.enum(["edificacion", "infraestructura", "mineria", "saneamiento"]),
  location: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  region: z.string().trim().optional().nullable(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de inicio requerida"),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de fin requerida"),
  contract_amount: z.coerce.number().min(0),
  exchange_rate: z.coerce.number().min(1).max(10),
  status: z.enum(["preparacion", "ejecucion"]),
  manager_id: z.string().uuid().optional().nullable().or(z.literal("")),
  admin_id: z.string().uuid().optional().nullable().or(z.literal("")),
  resident_id: z.string().uuid().optional().nullable().or(z.literal("")),
  lat: z.coerce.number().min(-90).max(90).optional().nullable(),
  lng: z.coerce.number().min(-180).max(180).optional().nullable(),
  geofence_radius: z.coerce.number().int().min(50).max(5000),
  alert_threshold: z.coerce.number().int().min(50).max(99),
  template_id: z.string().uuid().optional().nullable().or(z.literal("")),
}).refine((d) => d.end_date > d.start_date, { message: "La fecha de fin debe ser posterior al inicio", path: ["end_date"] });

export type NewProjectInput = z.input<typeof schema>;

const DEFAULT_PHASES: Record<string, { code: string; name: string; color: string }[]> = {
  edificacion: [
    { code: "F1", name: "Fase 1 · Sótanos (nivel de vereda hacia abajo)", color: "#035AA6" },
    { code: "F2", name: "Fase 2 · Casco (nivel de vereda hacia arriba)", color: "#04BF55" },
    { code: "F3", name: "Fase 3 · Acabados húmedos", color: "#F21D2F" },
    { code: "F4", name: "Fase 4 · Acabados secos", color: "#035928" },
  ],
  default: [
    { code: "F1", name: "Fase 1 · Obras preliminares y movimiento de tierras", color: "#035AA6" },
    { code: "F2", name: "Fase 2 · Obras principales", color: "#04BF55" },
    { code: "F3", name: "Fase 3 · Obras complementarias y cierre", color: "#F21D2F" },
  ],
};

export async function createProject(companyCode: string, input: NewProjectInput): Promise<ActionResult<{ code: string }>> {
  try {
    const ctx = await getCompanyContext(companyCode);
    if (!can(ctx.role, "createProject")) return { ok: false, error: "Solo Gerencia General o el Gerente de Proyectos pueden crear obras." };
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const d = parsed.data;
    const sb = await supabaseServer();
    const projectId = randomUUID();
    const { error: pe } = await sb.from("projects").insert({
      id: projectId, company_id: ctx.company.id, code: d.code, name: d.name, short_name: d.short_name, client_name: d.client_name, client_ruc: d.client_ruc || null,
      project_type: d.project_type, location: d.location || null, address: d.address || null, region: d.region || null,
      start_date: d.start_date, end_date: d.end_date, contract_amount: d.contract_amount, exchange_rate: d.exchange_rate, status: d.status,
      manager_id: d.manager_id || null, admin_id: d.admin_id || null, resident_id: d.resident_id || null,
      lat: d.lat ?? null, lng: d.lng ?? null, geofence_radius: d.geofence_radius, alert_threshold: d.alert_threshold,
      template_of: d.template_id || null, created_by: ctx.user.id,
    });
    if (pe) return { ok: false, error: pe.code === "23505" ? `Ya existe una obra con el código ${d.code} en la empresa.` : friendlyError(pe) };

    try {
      const phaseMap = new Map<string, string>();
      if (d.template_id) {
        const [{ data: tphases }, { data: tnodes }] = await Promise.all([
          sb.from("phases").select("id, code, name, sort, color, description").eq("project_id", d.template_id).order("sort"),
          sb.from("wbs_nodes").select("id, parent_id, code, name, level, phase_id, cost_type, is_leaf, sort, cost_center").eq("project_id", d.template_id).order("level").order("sort"),
        ]);
        const phases = (tphases ?? []).map((p) => {
          const id = randomUUID();
          phaseMap.set(p.id, id);
          return { id, project_id: projectId, code: p.code, name: p.name, sort: p.sort, color: p.color, description: p.description, sale_amount: 0 };
        });
        if (phases.length) {
          const { error } = await sb.from("phases").insert(phases);
          if (error) throw error;
        }
        const idMap = new Map<string, string>();
        (tnodes ?? []).forEach((n) => idMap.set(n.id, randomUUID()));
        for (const level of [1, 2, 3]) {
          const rows = (tnodes ?? []).filter((n) => n.level === level).map((n) => ({
            id: idMap.get(n.id)!, project_id: projectId, parent_id: n.parent_id ? idMap.get(n.parent_id) ?? null : null, code: n.code, name: n.name, level: n.level,
            phase_id: n.phase_id ? phaseMap.get(n.phase_id) ?? null : null, cost_type: n.cost_type, is_leaf: n.is_leaf, sort: n.sort, cost_center: n.cost_center, budget: 0, margin: 0,
          }));
          if (rows.length) {
            const { error } = await sb.from("wbs_nodes").insert(rows);
            if (error) throw error;
          }
        }
      } else {
        const list = DEFAULT_PHASES[d.project_type] ?? DEFAULT_PHASES.default;
        const { error } = await sb.from("phases").insert(list.map((p, i) => ({ project_id: projectId, code: p.code, name: p.name, color: p.color, sort: i + 1, sale_amount: 0 })));
        if (error) throw error;
      }
      await sb.from("cash_boxes").insert({ company_id: ctx.company.id, project_id: projectId, name: "Caja chica de obra", responsible_id: d.admin_id || d.resident_id || null });
    } catch (inner) {
      await sb.from("projects").delete().eq("id", projectId);
      return { ok: false, error: friendlyError(inner) };
    }

    revalidatePath(`/empresa/${companyCode}`, "layout");
    return { ok: true, data: { code: d.code }, message: `Obra ${d.code} creada` };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}
