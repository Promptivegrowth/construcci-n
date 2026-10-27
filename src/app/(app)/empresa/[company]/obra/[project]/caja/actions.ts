"use server";
import { revalidatePath } from "next/cache";
import { friendlyError, type ActionResult } from "@/lib/errors";
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
    const { data: r } = await sb.from("fund_requests").select("id, seq, amount, reason, status, box_id").eq("id", id).eq("project_id", ctx.project.id).single();
    if (!r || r.status !== "aprobada") return { ok: false, error: "Solo se depositan solicitudes aprobadas." };
    if (!r.box_id) return { ok: false, error: "La solicitud no tiene caja asociada." };
    const when = input.date || new Date().toISOString().slice(0, 10);
    const { error } = await sb.from("fund_requests").update({ status: "depositada", deposited_by: ctx.user.id, deposited_at: new Date(`${when}T12:00:00`).toISOString(), deposit_operation: input.operation.trim() }).eq("id", id);
    if (error) throw error;
    const { error: mErr } = await sb.from("cash_movements").insert({
      box_id: r.box_id, project_id: ctx.project.id, movement_type: "ingreso", amount: r.amount, moved_at: when,
      concept: `Depósito solicitud N° ${r.seq} — ${r.reason}`, fund_request_id: r.id, created_by: ctx.user.id,
    });
    if (mErr) throw mErr;
    revalidatePath(`${path(companyCode, projectCode)}/caja`);
    return { ok: true, message: `Depósito registrado: la caja recibe la solicitud N° ${r.seq}.` };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function renderFunds(companyCode: string, projectCode: string, id: string, input: { expenseIds: string[]; extras: { concept: string; amount: number; date: string }[] }): Promise<ActionResult> {
  try {
    const ctx = await getProjectContext(companyCode, projectCode);
    if (!["administrador", "gerente_proyectos", "contabilidad", "residente"].includes(ctx.role)) return { ok: false, error: "La rendición la registra el residente, el administrador de obra o Contabilidad." };
    const sb = await supabaseServer();
    const { data: r } = await sb.from("fund_requests").select("id, seq, amount, status, box_id, requested_by").eq("id", id).eq("project_id", ctx.project.id).single();
    if (!r || r.status !== "depositada") return { ok: false, error: "Solo se rinden solicitudes depositadas." };
    const extras = input.extras.filter((x) => x.concept.trim() && x.amount > 0);
    if (!input.expenseIds.length && !extras.length) return { ok: false, error: "Agrega al menos un comprobante o egreso a la rendición." };
    const { data: exps } = input.expenseIds.length
      ? await sb.from("expenses").select("id, total_pen, issue_date, description, status").in("id", input.expenseIds).eq("project_id", ctx.project.id)
      : { data: [] as { id: string; total_pen: number; issue_date: string; description: string; status: string }[] };
    if ((exps ?? []).some((e) => e.status === "anulado")) return { ok: false, error: "No se pueden rendir comprobantes anulados." };
    const rows = [
      ...(exps ?? []).map((e) => ({ box_id: r.box_id!, project_id: ctx.project.id, movement_type: "egreso", amount: Number(e.total_pen), moved_at: e.issue_date, concept: e.description, expense_id: e.id, fund_request_id: r.id, created_by: ctx.user.id })),
      ...extras.map((x) => ({ box_id: r.box_id!, project_id: ctx.project.id, movement_type: "egreso", amount: r2(x.amount), moved_at: x.date || new Date().toISOString().slice(0, 10), concept: x.concept.trim(), fund_request_id: r.id, created_by: ctx.user.id })),
    ];
    const total = r2(rows.reduce((s, x) => s + x.amount, 0));
    if (total > Number(r.amount) * 1.2) return { ok: false, error: `La rendición (S/ ${total.toFixed(2)}) excede en más de 20% el monto depositado.` };
    const { error: mErr } = await sb.from("cash_movements").insert(rows);
    if (mErr) throw mErr;
    const { error } = await sb.from("fund_requests").update({ status: "rendida", rendered_amount: total, rendered_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
    revalidatePath(`${path(companyCode, projectCode)}/caja`);
    const diff = r2(Number(r.amount) - total);
    return { ok: true, message: `Rendición N° ${r.seq} registrada · ${diff >= 0 ? `queda S/ ${diff.toFixed(2)} en caja` : `reembolso de S/ ${(-diff).toFixed(2)} al responsable`}.` };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}
