"use server";
import { revalidatePath } from "next/cache";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { getProjectContext, projectPath } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

const r2 = (n: number) => Math.round(n * 100) / 100;

export type StockInInput = {
  material_id: string; quantity: number; unit_cost: number; moved_at: string; supplier_id: string | null; order_id: string | null;
  document_ref: string; responsible_name: string; notes: string; photo_path: string | null;
};
export type StockOutInput = {
  material_id: string; quantity: number; moved_at: string; wbs_id: string; phase_id: string | null; front: string; responsible_name: string; notes: string;
};

function revalidate(companyCode: string, projectCode: string) {
  const base = `${projectPath(companyCode, projectCode)}/almacen`;
  revalidatePath(base);
  revalidatePath(`${base}/movimientos`);
}

export async function registerStockIn(companyCode: string, projectCode: string, input: StockInInput): Promise<ActionResult> {
  try {
    const ctx = await getProjectContext(companyCode, projectCode);
    if (!can(ctx.role, "stockMovement")) return { ok: false, error: "Tu rol no registra movimientos de almacén." };
    if (!input.material_id) return { ok: false, error: "Selecciona el material." };
    if (!(input.quantity > 0)) return { ok: false, error: "La cantidad debe ser mayor a cero." };
    if (!(input.unit_cost >= 0)) return { ok: false, error: "Indica el costo unitario." };
    if (!input.responsible_name.trim()) return { ok: false, error: "Indica quién recibe el material." };
    const sb = await supabaseServer();
    const { error } = await sb.from("stock_movements").insert({
      company_id: ctx.company.id, project_id: ctx.project.id, material_id: input.material_id, movement_type: "ingreso",
      moved_at: input.moved_at, quantity: input.quantity, unit_cost: input.unit_cost, supplier_id: input.supplier_id || null,
      order_id: input.order_id || null, document_ref: input.document_ref || null, responsible_name: input.responsible_name.trim(),
      notes: input.notes || null, photo_path: input.photo_path, created_by: ctx.user.id,
    });
    if (error) return { ok: false, error: friendlyError(error) };
    await sb.rpc("refresh_project_alerts", { p_project: ctx.project.id });
    revalidate(companyCode, projectCode);
    return { ok: true, message: `Ingreso registrado · S/ ${r2(input.quantity * input.unit_cost).toLocaleString("es-PE", { minimumFractionDigits: 2 })}` };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function registerStockOut(companyCode: string, projectCode: string, input: StockOutInput): Promise<ActionResult> {
  try {
    const ctx = await getProjectContext(companyCode, projectCode);
    if (!can(ctx.role, "stockMovement")) return { ok: false, error: "Tu rol no registra movimientos de almacén." };
    if (!input.material_id) return { ok: false, error: "Selecciona el material." };
    if (!(input.quantity > 0)) return { ok: false, error: "La cantidad debe ser mayor a cero." };
    if (!input.wbs_id) return { ok: false, error: "Toda salida debe cargarse a un WBS (código de control)." };
    if (!input.responsible_name.trim()) return { ok: false, error: "Indica quién retira el material." };
    const sb = await supabaseServer();
    const { error } = await sb.from("stock_movements").insert({
      company_id: ctx.company.id, project_id: ctx.project.id, material_id: input.material_id, movement_type: "salida",
      moved_at: input.moved_at, quantity: input.quantity, wbs_id: input.wbs_id, phase_id: input.phase_id || null,
      front: input.front || null, responsible_name: input.responsible_name.trim(), notes: input.notes || null, created_by: ctx.user.id,
    });
    if (error) return { ok: false, error: friendlyError(error) };
    await sb.rpc("refresh_project_alerts", { p_project: ctx.project.id });
    revalidate(companyCode, projectCode);
    return { ok: true, message: "Salida registrada y cargada al WBS" };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

// ------------------------------------------------------------------ Equipos menores
export type EquipmentInput = {
  id?: string; code: string; name: string; equipment_type: string; brand: string; model: string; serial: string;
  ownership: "propio" | "alquilado"; order_id: string | null; rate_amount: number | null; rate_period: string | null; status: string; notes: string;
};

export async function saveEquipment(companyCode: string, projectCode: string, input: EquipmentInput): Promise<ActionResult> {
  try {
    const ctx = await getProjectContext(companyCode, projectCode);
    if (!can(ctx.role, "manageMaterials")) return { ok: false, error: "Tu rol no administra equipos." };
    if (!input.code.trim() || !input.name.trim()) return { ok: false, error: "Código y nombre son obligatorios." };
    const sb = await supabaseServer();
    const row = {
      company_id: ctx.company.id, code: input.code.trim().toUpperCase(), name: input.name.trim(), equipment_type: input.equipment_type || null,
      brand: input.brand || null, model: input.model || null, serial: input.serial || null, ownership: input.ownership,
      order_id: input.ownership === "alquilado" ? input.order_id || null : null,
      rate_amount: input.ownership === "alquilado" ? input.rate_amount : null, rate_period: input.ownership === "alquilado" ? input.rate_period : null,
      notes: input.notes || null,
    };
    const res = input.id
      ? await sb.from("equipment").update({ ...row, status: input.status }).eq("id", input.id)
      : await sb.from("equipment").insert({ ...row, status: "disponible" });
    if (res.error) return { ok: false, error: friendlyError(res.error) };
    revalidatePath(`${projectPath(companyCode, projectCode)}/almacen/equipos`);
    return { ok: true, message: input.id ? "Equipo actualizado" : "Equipo registrado" };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function deliverEquipment(companyCode: string, projectCode: string, input: {
  equipment_id: string; assigned_to: string; assigned_to_dni: string; condition_out: string; signature_out: string; notes: string;
}): Promise<ActionResult> {
  try {
    const ctx = await getProjectContext(companyCode, projectCode);
    if (!can(ctx.role, "stockMovement")) return { ok: false, error: "Tu rol no puede entregar equipos." };
    if (!input.assigned_to.trim()) return { ok: false, error: "Indica a quién se entrega el equipo." };
    if (!input.signature_out?.startsWith("data:image")) return { ok: false, error: "Falta la firma de recepción del trabajador." };
    const sb = await supabaseServer();
    const { data: eq } = await sb.from("equipment").select("status, name").eq("id", input.equipment_id).single();
    if (!eq) return { ok: false, error: "Equipo no encontrado." };
    if (eq.status === "asignado") return { ok: false, error: "El equipo ya está entregado; registra primero la devolución." };
    if (eq.status === "baja") return { ok: false, error: "El equipo está dado de baja." };
    const ins = await sb.from("equipment_assignments").insert({
      equipment_id: input.equipment_id, project_id: ctx.project.id, assigned_to: input.assigned_to.trim(), assigned_to_dni: input.assigned_to_dni || null,
      delivered_by: ctx.user.id, condition_out: input.condition_out || null, signature_out: input.signature_out, notes: input.notes || null,
    });
    if (ins.error) return { ok: false, error: friendlyError(ins.error) };
    const up = await sb.from("equipment").update({ status: "asignado", project_id: ctx.project.id }).eq("id", input.equipment_id);
    if (up.error) return { ok: false, error: friendlyError(up.error) };
    revalidatePath(`${projectPath(companyCode, projectCode)}/almacen/equipos`);
    return { ok: true, message: `${eq.name} entregado a ${input.assigned_to.trim()} con cargo firmado` };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function returnEquipment(companyCode: string, projectCode: string, input: {
  assignment_id: string; condition_in: string; signature_in: string; to_maintenance: boolean;
}): Promise<ActionResult> {
  try {
    const ctx = await getProjectContext(companyCode, projectCode);
    if (!can(ctx.role, "stockMovement")) return { ok: false, error: "Tu rol no puede recibir equipos." };
    if (!input.signature_in?.startsWith("data:image")) return { ok: false, error: "Falta la firma de devolución." };
    const sb = await supabaseServer();
    const { data: a } = await sb.from("equipment_assignments").select("equipment_id, returned_at").eq("id", input.assignment_id).single();
    if (!a) return { ok: false, error: "Cargo no encontrado." };
    if (a.returned_at) return { ok: false, error: "Este cargo ya fue devuelto." };
    const up = await sb.from("equipment_assignments").update({ returned_at: new Date().toISOString(), condition_in: input.condition_in || null, signature_in: input.signature_in }).eq("id", input.assignment_id);
    if (up.error) return { ok: false, error: friendlyError(up.error) };
    const eq = await sb.from("equipment").update({ status: input.to_maintenance ? "mantenimiento" : "disponible", project_id: null }).eq("id", a.equipment_id);
    if (eq.error) return { ok: false, error: friendlyError(eq.error) };
    revalidatePath(`${projectPath(companyCode, projectCode)}/almacen/equipos`);
    return { ok: true, message: "Devolución registrada con firma" };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}
