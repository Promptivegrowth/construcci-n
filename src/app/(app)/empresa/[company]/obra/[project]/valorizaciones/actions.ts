"use server";
import { revalidatePath } from "next/cache";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { toNum } from "@/lib/format";
import { can, type Permission } from "@/lib/permissions";
import { getProjectContext, projectPath } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

type Ref = { company: string; project: string };

async function guard(ref: Ref, perm: Permission) {
  const ctx = await getProjectContext(ref.company, ref.project);
  if (!can(ctx.role, perm)) throw new Error(perm === "registerCollection" ? "Solo Contabilidad registra cobros." : "No tienes permiso para gestionar valorizaciones.");
  if (ctx.project.status === "cerrada") throw new Error("La obra está cerrada (solo lectura).");
  return ctx;
}
const done = (ref: Ref) => revalidatePath(projectPath(ref.company, ref.project), "layout");

export async function createValuationAction(input: Ref & { period_start: string; period_end: string; phase_id: string | null; presented_amount: number; notes?: string }): Promise<ActionResult> {
  try {
    const ctx = await guard(input, "registerValuation");
    if (!(input.presented_amount > 0)) return { ok: false, error: "El monto valorizado debe ser mayor a cero." };
    if (input.period_end < input.period_start) return { ok: false, error: "El fin del periodo es anterior al inicio." };
    const sb = await supabaseServer();
    const { data: last } = await sb.from("valuations").select("number").eq("project_id", ctx.project.id).order("number", { ascending: false }).limit(1).maybeSingle();
    const { error } = await sb.from("valuations").insert({
      company_id: ctx.company.id, project_id: ctx.project.id, number: (last?.number ?? 0) + 1, period_start: input.period_start, period_end: input.period_end,
      phase_id: input.phase_id || null, presented_amount: Math.round(input.presented_amount * 100) / 100, notes: input.notes || null, status: "presentada", created_by: ctx.user.id,
    });
    if (error) return { ok: false, error: friendlyError(error) };
    done(input);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function approveValuationAction(input: Ref & { id: string; approved_amount: number; observe?: boolean; notes?: string }): Promise<ActionResult> {
  try {
    const ctx = await guard(input, "registerValuation");
    const sb = await supabaseServer();
    const patch = input.observe
      ? { status: "observada", notes: input.notes || null }
      : { status: "aprobada", approved_amount: Math.round(input.approved_amount * 100) / 100, notes: input.notes || null };
    if (!input.observe && !(input.approved_amount > 0)) return { ok: false, error: "Indica el monto aprobado por el cliente." };
    const { error } = await sb.from("valuations").update(patch).eq("id", input.id).eq("project_id", ctx.project.id);
    if (error) return { ok: false, error: friendlyError(error) };
    done(input);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function invoiceValuationAction(input: Ref & { id: string; invoice_number: string; invoice_date: string }): Promise<ActionResult> {
  try {
    const ctx = await guard(input, "registerValuation");
    if (!input.invoice_number.trim()) return { ok: false, error: "Ingresa el número de factura emitida al cliente." };
    const sb = await supabaseServer();
    const { data: v } = await sb.from("valuations").select("status, approved_amount").eq("id", input.id).eq("project_id", ctx.project.id).single();
    if (!v || !v.approved_amount) return { ok: false, error: "La valorización debe estar aprobada antes de facturar." };
    const { error } = await sb.from("valuations").update({ status: "facturada", invoice_number: input.invoice_number.trim().toUpperCase(), invoice_date: input.invoice_date })
      .eq("id", input.id).eq("project_id", ctx.project.id);
    if (error) return { ok: false, error: friendlyError(error) };
    done(input);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function registerCollectionAction(input: Ref & { valuation_id: string; amount: number; collected_at: string; operation_number?: string; notes?: string }): Promise<ActionResult<{ status: string }>> {
  try {
    const ctx = await guard(input, "registerCollection");
    if (!(input.amount > 0)) return { ok: false, error: "El monto del abono debe ser mayor a cero." };
    const sb = await supabaseServer();
    const { data: v } = await sb.from("valuations").select("id, number, approved_amount, status").eq("id", input.valuation_id).eq("project_id", ctx.project.id).single();
    if (!v || !["facturada", "cobrada_parcial"].includes(v.status)) return { ok: false, error: "Solo se cobran valorizaciones facturadas." };
    const { data: prev } = await sb.from("collections").select("amount").eq("valuation_id", v.id);
    const already = (prev ?? []).reduce((s, c) => s + toNum(c.amount), 0);
    const invoiced = Math.round(toNum(v.approved_amount) * 1.18 * 100) / 100;
    if (already + input.amount > invoiced + 0.01) return { ok: false, error: `El abono excede el saldo por cobrar (S/ ${(invoiced - already).toFixed(2)}).` };
    const { error } = await sb.from("collections").insert({
      valuation_id: v.id, project_id: ctx.project.id, amount: Math.round(input.amount * 100) / 100, collected_at: input.collected_at,
      operation_number: input.operation_number || null, notes: input.notes || `Abono valorización N° ${v.number}`, registered_by: ctx.user.id,
    });
    if (error) return { ok: false, error: friendlyError(error) };
    const status = already + input.amount >= invoiced - 0.01 ? "cobrada" : "cobrada_parcial";
    await sb.from("valuations").update({ status }).eq("id", v.id);
    done(input);
    return { ok: true, data: { status } };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}
