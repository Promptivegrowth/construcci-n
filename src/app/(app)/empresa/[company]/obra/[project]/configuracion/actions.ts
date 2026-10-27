"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { getProjectContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

const ficha = z.object({
  name: z.string().trim().min(8, "Nombre muy corto"),
  short_name: z.string().trim().min(3).max(40),
  client_name: z.string().trim().min(3, "Ingresa el cliente"),
  client_ruc: z.string().trim().regex(/^(\d{11})?$/, "RUC de 11 dígitos").nullable().optional(),
  project_type: z.enum(["edificacion", "infraestructura", "mineria", "saneamiento"]),
  location: z.string().trim().nullable().optional(),
  address: z.string().trim().nullable().optional(),
  region: z.string().trim().nullable().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  extended_end_date: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/).nullable().optional(),
  contract_amount: z.coerce.number().min(0),
  exchange_rate: z.coerce.number().min(1).max(10),
  status: z.enum(["preparacion", "ejecucion", "paralizada", "cancelada", "cerrada"]),
  alert_threshold: z.coerce.number().int().min(50).max(99),
  geofence_radius: z.coerce.number().int().min(50).max(5000),
  lat: z.coerce.number().min(-90).max(90).nullable().optional(),
  lng: z.coerce.number().min(-180).max(180).nullable().optional(),
  manager_id: z.string().uuid().nullable().optional().or(z.literal("")),
  admin_id: z.string().uuid().nullable().optional().or(z.literal("")),
  resident_id: z.string().uuid().nullable().optional().or(z.literal("")),
});
export type FichaInput = z.input<typeof ficha>;

const path = (c: string, p: string) => `/empresa/${c}/obra/${p}`;

export async function updateProject(companyCode: string, projectCode: string, input: FichaInput): Promise<ActionResult> {
  try {
    const ctx = await getProjectContext(companyCode, projectCode);
    if (!can(ctx.role, "editBudget")) return { ok: false, error: "Solo Gerencia o el Gerente de Proyectos pueden editar la ficha de la obra." };
    const p = ficha.safeParse(input);
    if (!p.success) return { ok: false, error: p.error.issues[0].message };
    const d = p.data;
    if (d.end_date <= d.start_date) return { ok: false, error: "La fecha de fin debe ser posterior al inicio." };
    const sb = await supabaseServer();
    const closing = d.status === "cerrada" && ctx.project.status !== "cerrada";
    const { error } = await sb.from("projects").update({
      ...d, client_ruc: d.client_ruc || null, extended_end_date: d.extended_end_date || null,
      manager_id: d.manager_id || null, admin_id: d.admin_id || null, resident_id: d.resident_id || null,
      closed_at: d.status === "cerrada" || d.status === "cancelada" ? (ctx.project.closed_at ?? new Date().toISOString()) : null,
    }).eq("id", ctx.project.id);
    if (error) return { ok: false, error: friendlyError(error) };
    await sb.rpc("refresh_project_alerts", { p_project: ctx.project.id });
    revalidatePath(`/empresa/${companyCode}`, "layout");
    return { ok: true, message: closing ? "Obra cerrada: queda en solo lectura" : "Ficha de obra actualizada" };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

const doc = z.object({
  id: z.string().uuid().nullable().optional(),
  doc_kind: z.enum(["contrato", "orden_servicio_cliente", "carta_fianza", "poliza", "otro"]),
  title: z.string().trim().min(3, "Ingresa el título del documento"),
  number: z.string().trim().max(60).nullable().optional(),
  amount: z.coerce.number().min(0).nullable().optional(),
  issue_date: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/).nullable().optional(),
  expiry_date: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/).nullable().optional(),
  file_path: z.string().nullable().optional(),
  notes: z.string().trim().max(400).nullable().optional(),
});
export type DocInput = z.input<typeof doc>;

export async function saveDocument(companyCode: string, projectCode: string, input: DocInput): Promise<ActionResult> {
  try {
    const ctx = await getProjectContext(companyCode, projectCode);
    if (!can(ctx.role, "manageDocuments")) return { ok: false, error: "Tu rol no puede gestionar documentos de la obra." };
    if (ctx.project.status === "cerrada") return { ok: false, error: "La obra está cerrada (solo lectura)." };
    const p = doc.safeParse(input);
    if (!p.success) return { ok: false, error: p.error.issues[0].message };
    const { id, ...d } = p.data;
    if (d.file_path && !d.file_path.startsWith(`${ctx.company.id}/${ctx.project.id}/`)) return { ok: false, error: "Ruta de archivo inválida." };
    const row = { ...d, project_id: ctx.project.id, issue_date: d.issue_date || null, expiry_date: d.expiry_date || null, number: d.number || null, notes: d.notes || null };
    const sb = await supabaseServer();
    const { error } = id
      ? await sb.from("project_documents").update(row).eq("id", id).eq("project_id", ctx.project.id)
      : await sb.from("project_documents").insert({ ...row, created_by: ctx.user.id });
    if (error) return { ok: false, error: friendlyError(error) };
    await sb.rpc("refresh_project_alerts", { p_project: ctx.project.id });
    revalidatePath(`${path(companyCode, projectCode)}/configuracion`);
    revalidatePath(`/empresa/${companyCode}`, "layout");
    return { ok: true, message: id ? "Documento actualizado" : "Documento agregado al checklist" };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function closePeriod(companyCode: string, projectCode: string, input: { start: string; end: string; label: string }): Promise<ActionResult> {
  try {
    const ctx = await getProjectContext(companyCode, projectCode);
    if (!can(ctx.role, "closePeriod")) return { ok: false, error: "Solo Gerencia puede cerrar periodos." };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.start) || !/^\d{4}-\d{2}-\d{2}$/.test(input.end) || input.end < input.start) return { ok: false, error: "Periodo inválido." };
    const sb = await supabaseServer();
    const { data: overlap } = await sb.from("period_closures").select("id, label").eq("project_id", ctx.project.id).lte("period_start", input.end).gte("period_end", input.start).limit(1);
    if (overlap?.length) return { ok: false, error: `El periodo se superpone con el cierre “${overlap[0].label}”.` };
    const { count } = await sb.from("expenses").select("id", { count: "exact", head: true }).eq("project_id", ctx.project.id)
      .in("status", ["declarado", "observado"]).gte("issue_date", input.start).lte("issue_date", input.end);
    const { error } = await sb.from("period_closures").insert({ project_id: ctx.project.id, period_start: input.start, period_end: input.end, label: input.label, closed_by: ctx.user.id });
    if (error) return { ok: false, error: friendlyError(error) };
    revalidatePath(`${path(companyCode, projectCode)}/configuracion`);
    return { ok: true, message: `Periodo ${input.label} cerrado${count ? ` · ${count} comprobante(s) aún por aprobar en ese periodo` : ""}` };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function reopenPeriod(companyCode: string, projectCode: string, closureId: string): Promise<ActionResult> {
  try {
    const ctx = await getProjectContext(companyCode, projectCode);
    if (ctx.role !== "gerente_general") return { ok: false, error: "Solo Gerencia General puede reabrir un periodo cerrado." };
    const sb = await supabaseServer();
    const { error } = await sb.from("period_closures").delete().eq("id", closureId).eq("project_id", ctx.project.id);
    if (error) return { ok: false, error: friendlyError(error) };
    revalidatePath(`${path(companyCode, projectCode)}/configuracion`);
    return { ok: true, message: "Periodo reabierto (queda registrado en la trazabilidad)" };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}
