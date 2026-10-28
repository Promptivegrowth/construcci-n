"use server";
import { revalidatePath } from "next/cache";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { todayISO } from "@/lib/format";
import { can } from "@/lib/permissions";
import { getProjectContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

const path = (c: string, p: string) => `/empresa/${c}/obra/${p}`;
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export async function createBox(companyCode: string, projectCode: string, name: string): Promise<ActionResult> {
  try {
    const ctx = await getProjectContext(companyCode, projectCode);
    if (!["gerente_general", "gerente_proyectos", "contabilidad"].includes(ctx.role)) return { ok: false, error: "Solo Gerencia o Contabilidad abren cajas de obra." };
    const sb = await supabaseServer();
    const { error } = await sb.from("cash_boxes").insert({ company_id: ctx.company.id, project_id: ctx.project.id, name: name.trim() || "Caja chica de obra", responsible_id: ctx.project.admin_id ?? ctx.project.resident_id });
    if (error) throw error;
    revalidatePath(`${path(companyCode, projectCode)}/caja`);
    return { ok: true, message: "Caja de obra creada." };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function requestFunds(companyCode: string, projectCode: string, input: { box_id: string; amount: number; reason: string; needed_by: string }): Promise<ActionResult> {
  try {
    const ctx = await getProjectContext(companyCode, projectCode);
    if (!can(ctx.role, "requestFunds")) return { ok: false, error: "Tu rol no solicita fondos." };
    if (!(input.amount > 0)) return { ok: false, error: "Indica el monto solicitado." };
    if (input.reason.trim().length < 5) return { ok: false, error: "Explica el motivo de la solicitud." };
    const sb = await supabaseServer();
    const { data, error } = await sb.from("fund_requests").insert({
      company_id: ctx.company.id, project_id: ctx.project.id, box_id: input.box_id, requested_by: ctx.user.id, amount: r2(input.amount),
      reason: input.reason.trim(), needed_by: input.needed_by || null, status: "pendiente",
    }).select("seq").single();
    if (error) throw error;
    revalidatePath(`${path(companyCode, projectCode)}/caja`);
    return { ok: true, message: `Solicitud N° ${data.seq} enviada a Gerencia para su aprobación.` };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function decideFunds(companyCode: string, projectCode: string, id: string, approve: boolean, note: string): Promise<ActionResult> {
  try {
    const ctx = await getProjectContext(companyCode, projectCode);
    if (!can(ctx.role, "approveFunds")) return { ok: false, error: "Solo Gerencia aprueba solicitudes de fondos." };
    if (!approve && note.trim().length < 5) return { ok: false, error: "Indica el motivo del rechazo." };
    const sb = await supabaseServer();
    const { data, error } = await sb.from("fund_requests").update({
      status: approve ? "aprobada" : "rechazada", approved_by: ctx.user.id, approved_at: new Date().toISOString(), approval_note: note.trim() || null,
    }).eq("id", id).eq("project_id", ctx.project.id).eq("status", "pendiente").select("seq");
    if (error) throw error;
    if (!data?.length) return { ok: false, error: "La solicitud ya no está pendiente." };
    revalidatePath(`${path(companyCode, projectCode)}/caja`);
    return { ok: true, message: approve ? `Solicitud N° ${data[0].seq} aprobada · Contabilidad realizará el depósito.` : `Solicitud N° ${data[0].seq} rechazada.` };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function depositFunds(companyCode: string, projectCode: string, id: string, input: { operation: string; date: string }): Promise<ActionResult> {
  try {
    const ctx = await getProjectContext(companyCode, projectCode);
    if (!can(ctx.role, "depositFunds")) return { ok: false, error: "Solo Contabilidad registra depósitos." };
    if (input.operation.trim().length < 4) return { ok: false, error: "Ingresa el número de operación bancaria." };
    const sb = await supabaseServer();
    // La base registra el depósito y el ingreso de caja en una sola transacción (bloquea dobles registros)
    const { data: seq, error } = await sb.rpc("deposit_fund_request", { p_request: id, p_operation: input.operation.trim(), p_date: input.date || todayISO() });
    if (error) throw error;
    revalidatePath(`${path(companyCode, projectCode)}/caja`);
    return { ok: true, message: `Depósito registrado: la caja recibe la solicitud N° ${seq}.` };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function renderFunds(companyCode: string, projectCode: string, id: string, input: { expenseIds: string[]; extras: { concept: string; amount: number; date: string }[] }): Promise<ActionResult> {
  try {
    const ctx = await getProjectContext(companyCode, projectCode);
    if (!["administrador", "gerente_proyectos", "contabilidad", "residente"].includes(ctx.role)) return { ok: false, error: "La rendición la registra el residente, el administrador de obra o Contabilidad." };
    if (input.extras.some((x) => !x.concept.trim() || !(x.amount > 0))) return { ok: false, error: "Cada egreso adicional necesita concepto y un monto mayor a cero." };
    if (!input.expenseIds.length && !input.extras.length) return { ok: false, error: "Agrega al menos un comprobante o egreso a la rendición." };
    const sb = await supabaseServer();
    // Rendición atómica: los comprobantes rendidos quedan pagados con caja y salen de la bandeja de Pagos
    const { data, error } = await sb.rpc("render_fund_request", {
      p_request: id, p_expenses: input.expenseIds, p_extras: input.extras.map((x) => ({ concept: x.concept.trim(), amount: r2(x.amount), date: x.date })),
    });
    if (error) throw error;
    const r = data as { seq: number; total: number; amount: number };
    revalidatePath(path(companyCode, projectCode), "layout");
    const diff = r2(Number(r.amount) - Number(r.total));
    return { ok: true, message: `Rendición N° ${r.seq} registrada · ${diff >= 0 ? `queda S/ ${diff.toFixed(2)} en caja` : `reembolso de S/ ${(-diff).toFixed(2)} al responsable`}.` };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}
