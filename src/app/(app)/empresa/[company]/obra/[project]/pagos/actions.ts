"use server";
import { revalidatePath } from "next/cache";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { getProjectContext, projectPath } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

type Ref = { company: string; project: string };

export type PaymentInput = Ref & {
  expenseId: string; amount: number; paid_at: string; method: string; bank?: string; operation_number?: string; notes?: string;
};

async function guard(ref: Ref) {
  const ctx = await getProjectContext(ref.company, ref.project);
  if (!can(ctx.role, "registerPayment")) throw new Error("Solo Contabilidad puede registrar o anular pagos.");
  if (ctx.project.status === "cerrada") throw new Error("La obra está cerrada (solo lectura).");
  return ctx;
}

function refresh(ref: Ref) {
  const base = projectPath(ref.company, ref.project);
  revalidatePath(base, "layout");
}

export async function registerPaymentAction(input: PaymentInput): Promise<ActionResult<{ status: string }>> {
  try {
    const ctx = await guard(input);
    if (!(input.amount > 0)) return { ok: false, error: "El monto debe ser mayor a cero." };
    const sb = await supabaseServer();
    const { error } = await sb.from("payments").insert({
      expense_id: input.expenseId,
      amount_pen: Math.round(input.amount * 100) / 100,
      paid_at: input.paid_at,
      method: input.method,
      bank: input.bank || null,
      operation_number: input.operation_number || null,
      notes: input.notes || null,
      registered_by: ctx.user.id,
    });
    if (error) return { ok: false, error: friendlyError(error) };
    await sb.rpc("refresh_project_alerts", { p_project: ctx.project.id });
    const { data: e } = await sb.from("expenses").select("status").eq("id", input.expenseId).single();
    refresh(input);
    return { ok: true, data: { status: e?.status ?? "" } };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function voidPaymentAction(input: Ref & { paymentId: string; reason: string }): Promise<ActionResult> {
  try {
    const ctx = await guard(input);
    if (!input.reason?.trim()) return { ok: false, error: "Indica el motivo de la anulación." };
    const sb = await supabaseServer();
    const { error } = await sb.from("payments").update({ voided: true, void_reason: input.reason.trim() })
      .eq("id", input.paymentId).eq("project_id", ctx.project.id);
    if (error) return { ok: false, error: friendlyError(error) };
    await sb.rpc("refresh_project_alerts", { p_project: ctx.project.id });
    refresh(input);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export type LimaExpenseInput = Ref & {
  supplierId?: string | null;
  newSupplier?: { ruc: string; name: string } | null;
  doc_type: "FT" | "BV" | "RH" | "TK" | "OT";
  series?: string; doc_number: string;
  issue_date: string; reception_date?: string; due_date?: string;
  currency: "PEN" | "USD"; exchange_rate?: number;
  total: number; tax_condition: "gravado" | "no_gravado" | "exonerado";
  retention_pct?: number;
  phase_id: string; wbs_id: string; description: string; category?: string;
  file?: { path: string; size: number; mime: string; name: string } | null;
  payNow?: { amount: number; paid_at: string; method: string; bank?: string; operation_number?: string } | null;
};

/** Comprobante que solo llega a Lima (pago central): queda aprobado y visible para la obra. */
export async function registerLimaExpenseAction(input: LimaExpenseInput): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await guard(input);
    if (!input.wbs_id || !input.phase_id) return { ok: false, error: "Clasificación obligatoria: fase y WBS de último nivel." };
    if (!input.description?.trim()) return { ok: false, error: "Agrega una descripción del gasto." };
    if (!(input.total > 0)) return { ok: false, error: "El monto del comprobante debe ser mayor a cero." };
    const sb = await supabaseServer();

    const { data: leaf } = await sb.from("wbs_nodes").select("id, is_leaf").eq("id", input.wbs_id).eq("project_id", ctx.project.id).single();
    if (!leaf?.is_leaf) return { ok: false, error: "Selecciona un WBS de último nivel." };

    let supplierId = input.supplierId ?? null;
    if (!supplierId && input.newSupplier?.ruc) {
      const ruc = input.newSupplier.ruc.trim();
      if (!/^\d{8}$|^\d{11}$/.test(ruc)) return { ok: false, error: "El RUC debe tener 11 dígitos (o DNI de 8)." };
      const { data: existing } = await sb.from("suppliers").select("id").eq("company_id", ctx.company.id).eq("ruc", ruc).maybeSingle();
      if (existing) supplierId = existing.id;
      else {
        const { data: created, error } = await sb.from("suppliers")
          .insert({ company_id: ctx.company.id, ruc, name: input.newSupplier.name.trim().toUpperCase(), kind: "proveedor" })
          .select("id").single();
        if (error) return { ok: false, error: friendlyError(error) };
        supplierId = created.id;
      }
    }
    if (!supplierId) return { ok: false, error: "Selecciona o registra el proveedor." };

    const now = new Date().toISOString();
    const { data: exp, error } = await sb.from("expenses").insert({
      company_id: ctx.company.id,
      project_id: ctx.project.id,
      wbs_id: input.wbs_id,
      phase_id: input.phase_id,
      supplier_id: supplierId,
      category: input.category || "PAGO CENTRAL LIMA",
      description: input.description.trim(),
      doc_type: input.doc_type,
      series: input.series?.trim().toUpperCase() || null,
      doc_number: input.doc_number.trim(),
      issue_date: input.issue_date,
      reception_date: input.reception_date || input.issue_date,
      due_date: input.due_date || input.reception_date || input.issue_date,
      currency: input.currency,
      exchange_rate: input.currency === "USD" ? input.exchange_rate || Number(ctx.project.exchange_rate) : 1,
      tax_condition: input.doc_type === "FT" ? input.tax_condition : "no_gravado",
      total: Math.round(input.total * 100) / 100,
      retention_pct: input.retention_pct ?? 0,
      origin: "lima",
      status: "aprobado",
      created_by: ctx.user.id,
      approved_by: ctx.user.id,
      approved_at: now,
      declared_at: now,
    }).select("id, payable_pen").single();
    if (error) return { ok: false, error: friendlyError(error) };

    if (input.file) {
      await sb.from("expense_files").insert({
        expense_id: exp.id, file_path: input.file.path, file_name: input.file.name, mime: input.file.mime, size_bytes: input.file.size,
        uploaded_by: ctx.user.id, captured_at: now,
      });
    }
    if (input.payNow && input.payNow.amount > 0) {
      const { error: pe } = await sb.from("payments").insert({
        expense_id: exp.id, amount_pen: Math.min(Math.round(input.payNow.amount * 100) / 100, Number(exp.payable_pen)),
        paid_at: input.payNow.paid_at, method: input.payNow.method, bank: input.payNow.bank || null,
        operation_number: input.payNow.operation_number || null, registered_by: ctx.user.id,
      });
      if (pe) return { ok: false, error: `Comprobante registrado, pero el pago falló: ${friendlyError(pe)}` };
    }
    await sb.rpc("refresh_project_alerts", { p_project: ctx.project.id });
    refresh(input);
    return { ok: true, data: { id: exp.id } };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}
