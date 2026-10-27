"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { getProjectContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

/** Resuelve empresa/obra por id (RLS) y valida el contexto completo del usuario. */
async function ctxById(projectId: string) {
  const sb = await supabaseServer();
  const { data } = await sb.from("projects").select("code, company:companies(code)").eq("id", projectId).maybeSingle();
  if (!data) throw new Error("No tienes acceso a esta obra.");
  const companyCode = (data.company as unknown as { code: string }).code;
  return { sb, ctx: await getProjectContext(companyCode, data.code), companyCode };
}

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const pathOk = (p: string, companyId: string, projectId: string) => p.startsWith(`${companyId}/${projectId}/`);

async function ensureSupplier(sb: Awaited<ReturnType<typeof supabaseServer>>, companyId: string, ruc: string, name: string) {
  const { data: found } = await sb.from("suppliers").select("id").eq("company_id", companyId).eq("ruc", ruc).maybeSingle();
  if (found) return found.id;
  const { data, error } = await sb.from("suppliers")
    .insert({ company_id: companyId, ruc, name: name.trim().toUpperCase() || `PROVEEDOR ${ruc}`, kind: ruc.length === 8 ? "trabajador" : "proveedor" })
    .select("id").single();
  if (error) throw error;
  return data.id;
}

// ----------------------------------------------------------------- Gasto
const expenseSchema = z.object({
  projectId: z.string().uuid(),
  wbsId: z.string().uuid({ message: "Selecciona el WBS (centro de costo)" }),
  phaseId: z.string().uuid({ message: "Selecciona la fase" }),
  supplierRuc: z.string().regex(/^(\d{8}|\d{11})$/, "RUC (11) o DNI (8) inválido"),
  supplierName: z.string().trim().max(120).optional().default(""),
  docType: z.enum(["FT", "BV", "RH", "TK", "OT"]),
  series: z.string().trim().max(8).optional().default(""),
  docNumber: z.string().trim().min(1, "Ingresa el número del comprobante").max(20),
  issueDate: z.string().regex(isoDate),
  total: z.number().positive("El monto debe ser mayor a cero"),
  description: z.string().trim().min(4, "Describe el gasto"),
  photoPath: z.string().min(10, "La foto del comprobante es obligatoria"),
  photoSize: z.number().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  capturedAt: z.string(),
});
export type FieldExpense = z.input<typeof expenseSchema>;

export async function submitFieldExpense(input: FieldExpense): Promise<ActionResult<{ seq: number | null }>> {
  try {
    const parsed = expenseSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const d = parsed.data;
    const { sb, ctx } = await ctxById(d.projectId);
    if (!can(ctx.role, "registerExpense")) return { ok: false, error: "Tu rol no registra gastos." };
    if (ctx.project.status === "cerrada" || ctx.project.status === "cancelada") return { ok: false, error: "La obra no admite nuevos gastos." };
    if (!pathOk(d.photoPath, ctx.company.id, ctx.project.id)) return { ok: false, error: "Sustento inválido." };

    const { data: leaf } = await sb.from("v_wbs_stats").select("is_leaf, budget, declared, paid, phase_id").eq("wbs_id", d.wbsId).eq("project_id", ctx.project.id).maybeSingle();
    if (!leaf?.is_leaf) return { ok: false, error: "El gasto debe cargarse a un WBS de último nivel." };
    const supplierId = await ensureSupplier(sb, ctx.company.id, d.supplierRuc, d.supplierName);
    const cost = d.docType === "FT" ? d.total / 1.18 : d.total;
    const exceeds = Number(leaf.budget ?? 0) > 0 && Math.max(Number(leaf.declared ?? 0), Number(leaf.paid ?? 0)) + cost > Number(leaf.budget);

    const { data: exp, error } = await sb.from("expenses").insert({
      company_id: ctx.company.id, project_id: ctx.project.id, wbs_id: d.wbsId, phase_id: d.phaseId, supplier_id: supplierId,
      category: "CAJA CHICA", description: d.description, doc_type: d.docType, series: d.series ? d.series.toUpperCase() : null, doc_number: d.docNumber,
      issue_date: d.issueDate, reception_date: d.issueDate, due_date: d.issueDate, currency: "PEN", exchange_rate: 1,
      tax_condition: d.docType === "FT" ? "gravado" : "no_gravado", total: d.total, origin: "campo", status: "declarado",
      exceeds_budget: exceeds, created_by: ctx.user.id, lat: d.lat ?? null, lng: d.lng ?? null,
    }).select("id, seq").single();
    if (error) return { ok: false, error: friendlyError(error) };

    const { error: fe } = await sb.from("expense_files").insert({
      expense_id: exp.id, file_path: d.photoPath, file_name: `${d.series ? `${d.series}-` : ""}${d.docNumber}.jpg`, mime: "image/jpeg",
      size_bytes: d.photoSize ?? null, lat: d.lat ?? null, lng: d.lng ?? null, captured_at: d.capturedAt, uploaded_by: ctx.user.id,
    });
    if (fe) return { ok: false, error: friendlyError(fe) };
    await sb.rpc("refresh_project_alerts", { p_project: ctx.project.id });
    revalidatePath("/campo");
    return { ok: true, data: { seq: exp.seq }, message: exceeds ? "Gasto declarado · excede el saldo del WBS: requerirá aprobación de Gerencia" : "Gasto declarado con su sustento" };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

// ----------------------------------------------------------------- Asistencia
const attSchema = z.object({
  projectId: z.string().uuid(),
  kind: z.enum(["entrada", "salida"]),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  accuracy: z.number().nullable().optional(),
  markedAt: z.string(),
  photoPath: z.string().nullable().optional(),
  notes: z.string().max(200).nullable().optional(),
});
export type FieldAttendance = z.input<typeof attSchema>;

function haversine(a: number, b: number, c: number, d: number) {
  const R = 6371000, r = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function submitAttendance(input: FieldAttendance): Promise<ActionResult<{ distance: number | null; within: boolean | null }>> {
  try {
    const parsed = attSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const d = parsed.data;
    const { sb, ctx } = await ctxById(d.projectId);
    const p = ctx.project;
    if (d.photoPath && !pathOk(d.photoPath, ctx.company.id, p.id)) return { ok: false, error: "Foto inválida." };
    const marked = new Date(d.markedAt);
    if (Number.isNaN(marked.getTime()) || marked.getTime() > Date.now() + 5 * 60000 || Date.now() - marked.getTime() > 7 * 86400000)
      return { ok: false, error: "Hora de marcación inválida (solo se sincronizan marcaciones de los últimos 7 días)." };
    const distance = d.lat !== null && d.lng !== null && p.lat !== null && p.lng !== null ? haversine(p.lat, p.lng, d.lat, d.lng) : null;
    const within = distance === null ? null : distance <= p.geofence_radius;
    const { error } = await sb.from("attendance").insert({
      company_id: ctx.company.id, project_id: p.id, user_id: ctx.user.id, kind: d.kind, marked_at: marked.toISOString(),
      lat: d.lat, lng: d.lng, accuracy: d.accuracy ?? null, distance_m: distance === null ? null : Math.round(distance * 100) / 100, within_geofence: within,
      photo_path: d.photoPath ?? null, notes: within === false ? `Marcación fuera de la geocerca${d.notes ? ` · ${d.notes}` : ""}` : d.notes ?? null,
    });
    if (error) return { ok: false, error: friendlyError(error) };
    revalidatePath("/campo");
    return {
      ok: true, data: { distance, within },
      message: within === false ? `${d.kind === "entrada" ? "Entrada" : "Salida"} registrada fuera de la geocerca (${Math.round(distance!)} m)` : `${d.kind === "entrada" ? "Entrada" : "Salida"} registrada${distance !== null ? ` a ${Math.round(distance)} m de la obra` : ""}`,
    };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

// ----------------------------------------------------------------- Almacén
const stockSchema = z.object({
  projectId: z.string().uuid(),
  materialId: z.string().uuid({ message: "Selecciona el material" }),
  quantity: z.number().positive("Cantidad mayor a cero"),
  unitCost: z.number().min(0),
  supplierRuc: z.string().regex(/^(\d{8}|\d{11})?$/, "RUC inválido").optional().default(""),
  supplierName: z.string().optional().default(""),
  documentRef: z.string().trim().max(40).optional().default(""),
  movedAt: z.string().regex(isoDate),
  photoPath: z.string().nullable().optional(),
  notes: z.string().max(300).optional().default(""),
});
export type FieldStockIn = z.input<typeof stockSchema>;

export async function submitStockIn(input: FieldStockIn): Promise<ActionResult> {
  try {
    const parsed = stockSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const d = parsed.data;
    const { sb, ctx } = await ctxById(d.projectId);
    if (!can(ctx.role, "stockMovement")) return { ok: false, error: "Tu rol no registra movimientos de almacén." };
    if (d.photoPath && !pathOk(d.photoPath, ctx.company.id, ctx.project.id)) return { ok: false, error: "Foto inválida." };
    const supplierId = d.supplierRuc ? await ensureSupplier(sb, ctx.company.id, d.supplierRuc, d.supplierName) : null;
    const { error } = await sb.from("stock_movements").insert({
      company_id: ctx.company.id, project_id: ctx.project.id, material_id: d.materialId, movement_type: "ingreso", moved_at: d.movedAt,
      quantity: d.quantity, unit_cost: d.unitCost, supplier_id: supplierId, document_ref: d.documentRef || null,
      responsible_name: ctx.profile.full_name, photo_path: d.photoPath ?? null, notes: d.notes || "Registrado desde la app de campo", created_by: ctx.user.id,
    });
    if (error) return { ok: false, error: friendlyError(error) };
    await sb.rpc("refresh_project_alerts", { p_project: ctx.project.id });
    revalidatePath("/campo");
    return { ok: true, message: "Ingreso a almacén registrado" };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

// ----------------------------------------------------------------- Aprobaciones
export async function reviewExpense(expenseId: string, decision: "aprobar" | "observar", observation?: string): Promise<ActionResult> {
  try {
    const sb = await supabaseServer();
    const { data: e } = await sb.from("expenses").select("id, project_id, status, exceeds_budget").eq("id", expenseId).maybeSingle();
    if (!e) return { ok: false, error: "Comprobante no encontrado." };
    const { ctx } = await ctxById(e.project_id);
    if (!can(ctx.role, "approveExpense")) return { ok: false, error: "Solo Gerencia aprueba u observa gastos." };
    if (!["declarado", "observado"].includes(e.status)) return { ok: false, error: "El comprobante ya fue revisado." };
    if (decision === "aprobar") {
      const { count } = await sb.from("expense_files").select("id", { count: "exact", head: true }).eq("expense_id", e.id);
      if (!count) return { ok: false, error: "Sustento obligatorio: el comprobante no tiene foto o PDF." };
      const { error } = await sb.from("expenses").update({ status: "aprobado", approved_by: ctx.user.id, approved_at: new Date().toISOString(), observation: null }).eq("id", e.id);
      if (error) return { ok: false, error: friendlyError(error) };
    } else {
      if (!observation || observation.trim().length < 5) return { ok: false, error: "Escribe el motivo de la observación." };
      const { error } = await sb.from("expenses").update({ status: "observado", observation: observation.trim() }).eq("id", e.id);
      if (error) return { ok: false, error: friendlyError(error) };
    }
    await sb.rpc("refresh_project_alerts", { p_project: e.project_id });
    revalidatePath("/campo");
    return { ok: true, message: decision === "aprobar" ? "Gasto aprobado · pasa a Contabilidad para pago" : "Gasto observado · se notificó al registrante" };
  } catch (err) {
    return { ok: false, error: friendlyError(err) };
  }
}
