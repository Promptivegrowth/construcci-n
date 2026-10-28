"use server";
import { revalidatePath } from "next/cache";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { getProjectContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { computeExpense, r2 } from "./_components/expense-math";

export type EvidenceInput = { path: string; name: string; mime: string; size: number; lat: number | null; lng: number | null; captured_at: string };
export type ExpenseInput = {
  supplier_id: string;
  doc_type: "FT" | "BV" | "RH" | "TK" | "OT";
  series: string;
  doc_number: string;
  issue_date: string;
  reception_date: string;
  due_date: string;
  currency: "PEN" | "USD";
  exchange_rate: number;
  tax_condition: "gravado" | "no_gravado" | "exonerado";
  total: number;
  retention_pct: number;
  phase_id: string;
  wbs_id: string;
  order_id: string | null;
  order_override: boolean;
  description: string;
  category: string;
  allocations: { wbs_id: string; amount: number }[];
  files: EvidenceInput[];
  lat: number | null;
  lng: number | null;
};

const base = (c: string, p: string) => `/empresa/${c}/obra/${p}`;

async function refreshAlerts(projectId: string) {
  const sb = await supabaseServer();
  await sb.rpc("refresh_project_alerts", { p_project: projectId });
}

export async function createSupplier(companyCode: string, projectCode: string, input: { ruc: string; name: string; kind: string }): Promise<ActionResult<{ id: string; name: string; ruc: string }>> {
  try {
    const ctx = await getProjectContext(companyCode, projectCode);
    const ruc = input.ruc.replace(/\D/g, "");
    if (![8, 11].includes(ruc.length)) return { ok: false, error: "El RUC debe tener 11 dígitos (o DNI de 8 dígitos)." };
    if (input.name.trim().length < 3) return { ok: false, error: "Ingresa la razón social o nombre completo." };
    const sb = await supabaseServer();
    const { data: existing } = await sb.from("suppliers").select("id, name, ruc").eq("company_id", ctx.company.id).eq("ruc", ruc).maybeSingle();
    if (existing) return { ok: true, data: existing, message: "El proveedor ya estaba registrado." };
    const { data, error } = await sb.from("suppliers").insert({ company_id: ctx.company.id, ruc, name: input.name.trim().toUpperCase(), kind: input.kind || "proveedor" }).select("id, name, ruc").single();
    if (error) throw error;
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function saveExpense(companyCode: string, projectCode: string, input: ExpenseInput, mode: "borrador" | "declarado", expenseId?: string): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await getProjectContext(companyCode, projectCode);
    if (!can(ctx.role, "registerExpense")) return { ok: false, error: "Tu rol no puede registrar gastos." };
    if (ctx.project.status === "cerrada") return { ok: false, error: "La obra está cerrada (solo lectura)." };
    const sb = await supabaseServer();
    const pid = ctx.project.id;

    if (!input.supplier_id) return { ok: false, error: "Selecciona el proveedor." };
    if (!input.phase_id || !input.wbs_id) return { ok: false, error: "Clasificación obligatoria: indica fase y WBS de último nivel." };
    if (!(input.total > 0)) return { ok: false, error: "El monto del comprobante debe ser mayor a cero." };
    if (!input.description.trim()) return { ok: false, error: "Describe el gasto." };
    if (input.doc_type !== "OT" && input.doc_type !== "TK" && !input.doc_number.trim()) return { ok: false, error: "Ingresa el número del comprobante." };
    if (input.currency === "USD" && !(input.exchange_rate > 0)) return { ok: false, error: "Indica el tipo de cambio del comprobante." };

    const [{ data: wbs }, { data: phase }] = await Promise.all([
      sb.from("wbs_nodes").select("id, is_leaf, parent_id, project_id").eq("id", input.wbs_id).single(),
      sb.from("phases").select("id, project_id").eq("id", input.phase_id).single(),
    ]);
    if (!wbs || wbs.project_id !== pid || !wbs.is_leaf) return { ok: false, error: "El WBS debe ser de último nivel y pertenecer a esta obra." };
    if (!phase || phase.project_id !== pid) return { ok: false, error: "La fase no pertenece a esta obra." };

    const m = computeExpense({ docType: input.doc_type, tax: input.tax_condition, total: input.total, currency: input.currency, tc: input.exchange_rate, retentionPct: input.retention_pct });

    // Distribución entre subcategorías del mismo WBS padre
    let allocations = [{ wbs_id: input.wbs_id, amount: m.cost }];
    if (input.allocations.length > 1) {
      const ids = input.allocations.map((a) => a.wbs_id);
      const { data: leaves } = await sb.from("wbs_nodes").select("id, parent_id, is_leaf, project_id").in("id", ids);
      if (!leaves || leaves.length !== new Set(ids).size || leaves.some((l) => !l.is_leaf || l.project_id !== pid || l.parent_id !== wbs.parent_id))
        return { ok: false, error: "La distribución solo puede usar subcategorías hoja del mismo WBS padre." };
      const sum = r2(input.allocations.reduce((s, a) => s + a.amount, 0));
      if (Math.abs(sum - m.cost) > 0.01) return { ok: false, error: `La distribución (S/ ${sum.toFixed(2)}) debe sumar el costo del comprobante (S/ ${m.cost.toFixed(2)}).` };
      allocations = input.allocations.map((a) => ({ wbs_id: a.wbs_id, amount: r2(a.amount) }));
    }

    // Sustento obligatorio para declarar
    let existingFiles = 0;
    let prev: { status: string; created_by: string | null } | null = null;
    if (expenseId) {
      const [{ count }, { data: e }] = await Promise.all([
        sb.from("expense_files").select("id", { count: "exact", head: true }).eq("expense_id", expenseId),
        sb.from("expenses").select("status, created_by").eq("id", expenseId).single(),
      ]);
      existingFiles = count ?? 0;
      prev = e;
      if (!prev) return { ok: false, error: "Comprobante no encontrado." };
      if (!["borrador", "observado", "declarado"].includes(prev.status)) return { ok: false, error: "Solo se corrigen comprobantes en borrador, observados o pendientes de aprobación." };
    }
    if (mode === "declarado" && existingFiles + input.files.length === 0) return { ok: false, error: "Sustento obligatorio: adjunta la foto o PDF del comprobante para declararlo." };

    // Orden de servicio / compra
    if (input.order_id) {
      const [{ data: order }, { data: bal }] = await Promise.all([
        sb.from("orders").select("id, status, subtotal_pen, project_id, number").eq("id", input.order_id).single(),
        sb.from("v_order_balance").select("invoiced_pen").eq("order_id", input.order_id).single(),
      ]);
      if (!order || order.project_id !== pid) return { ok: false, error: "La orden no pertenece a esta obra." };
      if (order.status !== "aprobada") return { ok: false, error: `La orden ${order.number} no está aprobada.` };
      let invoiced = Number(bal?.invoiced_pen ?? 0);
      if (expenseId) {
        const { data: self } = await sb.from("expenses").select("cost_pen, order_id").eq("id", expenseId).single();
        if (self?.order_id === input.order_id) invoiced -= Number(self.cost_pen ?? 0);
      }
      if (invoiced + m.cost > Number(order.subtotal_pen) + 0.5 && !input.order_override)
        return { ok: false, error: `El comprobante excede el saldo de la orden ${order.number} (saldo S/ ${Math.max(0, Number(order.subtotal_pen) - invoiced).toFixed(2)}). Requiere aprobación especial de Gerencia.` };
      if (input.order_override && !can(ctx.role, "approveOrder")) return { ok: false, error: "Solo Gerencia puede autorizar exceder el saldo de una orden." };
    }

    // ¿Deja el WBS en negativo? → requiere aprobación de Gerencia
    const { data: stats } = await sb.from("v_wbs_stats").select("wbs_id, budget, registered").in("wbs_id", allocations.map((a) => a.wbs_id));
    let currentOwn = new Map<string, number>();
    if (expenseId) {
      const { data: own } = await sb.from("expense_allocations").select("wbs_id, amount_pen").eq("expense_id", expenseId);
      if (prev && !["borrador"].includes(prev.status)) currentOwn = new Map((own ?? []).map((a) => [a.wbs_id, Number(a.amount_pen)]));
    }
    const exceeds = allocations.some((a) => {
      const s = (stats ?? []).find((x) => x.wbs_id === a.wbs_id);
      return s ? Number(s.registered) - (currentOwn.get(a.wbs_id) ?? 0) + a.amount > Number(s.budget) + 0.01 : false;
    });

    const row = {
      supplier_id: input.supplier_id,
      doc_type: input.doc_type,
      series: input.series.trim().toUpperCase() || null,
      doc_number: input.doc_number.trim() || null,
      issue_date: input.issue_date,
      reception_date: input.reception_date || input.issue_date,
      due_date: input.due_date || input.reception_date || input.issue_date,
      currency: input.currency,
      exchange_rate: input.currency === "USD" ? input.exchange_rate : 1,
      tax_condition: input.doc_type === "FT" ? input.tax_condition : "no_gravado",
      total: r2(input.total),
      retention_pct: input.retention_pct || 0,
      phase_id: input.phase_id,
      wbs_id: input.wbs_id,
      order_id: input.order_id,
      order_override: !!input.order_id && input.order_override,
      exceeds_budget: exceeds,
      description: input.description.trim(),
      category: input.category || null,
      status: mode,
      observation: null,
    };

    let id = expenseId;
    if (expenseId) {
      // Solo si sigue corrigiéndose: si Gerencia lo aprobó mientras se editaba, no se revierte
      const { data: upd, error } = await sb.from("expenses").update({ ...row, declared_at: mode === "declarado" ? new Date().toISOString() : null })
        .eq("id", expenseId).in("status", ["borrador", "observado", "declarado"]).select("id");
      if (error) throw error;
      if (!upd?.length) return { ok: false, error: "El comprobante cambió de estado mientras lo editabas (p. ej. ya fue aprobado). Recarga la página." };
    } else {
      const { data, error } = await sb.from("expenses").insert({
        ...row, company_id: ctx.company.id, project_id: pid, created_by: ctx.user.id,
        origin: ctx.role === "contabilidad" ? "lima" : "obra", lat: input.lat, lng: input.lng,
      }).select("id").single();
      if (error) throw error;
      id = data.id;
    }

    // Asignaciones: se reescriben solo si la distribución cambió (un cambio de texto no toca las cifras del WBS)
    const key = (l: { wbs_id: string; amount: number }[]) => l.map((a) => `${a.wbs_id}:${r2(a.amount).toFixed(2)}`).sort().join("|");
    const { data: ownNow } = await sb.from("expense_allocations").select("wbs_id, amount_pen").eq("expense_id", id!);
    if (key((ownNow ?? []).map((a) => ({ wbs_id: a.wbs_id, amount: Number(a.amount_pen) }))) !== key(allocations)) {
      const { error: dErr } = await sb.from("expense_allocations").delete().eq("expense_id", id!);
      if (dErr) throw dErr;
      const { error: aErr } = await sb.from("expense_allocations").insert(allocations.map((a) => ({ expense_id: id!, wbs_id: a.wbs_id, amount_pen: a.amount })));
      if (aErr) throw aErr;
    }

    if (input.files.length) {
      const { error: fErr } = await sb.from("expense_files").insert(input.files.map((f) => ({
        expense_id: id!, file_path: f.path, file_name: f.name, mime: f.mime, size_bytes: f.size, lat: f.lat, lng: f.lng, captured_at: f.captured_at, uploaded_by: ctx.user.id,
      })));
      if (fErr) throw fErr;
    }

    revalidatePath(base(companyCode, projectCode), "layout");
    return {
      ok: true, data: { id: id! },
      message: mode === "borrador" ? "Borrador guardado." : exceeds ? "Declarado. Deja el WBS en negativo: requiere aprobación de Gerencia." : "Gasto declarado y enviado a aprobación.",
    };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function approveExpenses(companyCode: string, projectCode: string, ids: string[]): Promise<ActionResult<{ approved: number }>> {
  try {
    const ctx = await getProjectContext(companyCode, projectCode);
    if (ctx.project.status === "cerrada") return { ok: false, error: "La obra está cerrada (solo lectura)." };
    if (!can(ctx.role, "approveExpense")) return { ok: false, error: "Solo Gerencia aprueba gastos." };
    const sb = await supabaseServer();
    const { data: rows } = await sb.from("expenses").select("id, status, doc_type, files:expense_files(count)").in("id", ids).eq("project_id", ctx.project.id);
    const valid = (rows ?? []).filter((r) => r.status === "declarado");
    const noFile = valid.filter((r) => r.doc_type !== "PL" && !((r.files as unknown as { count: number }[])?.[0]?.count > 0));
    const ok = valid.filter((r) => !noFile.includes(r)).map((r) => r.id);
    if (!ok.length) return { ok: false, error: noFile.length ? "Los comprobantes seleccionados no tienen sustento adjunto." : "No hay comprobantes pendientes de aprobación en la selección." };
    const { error } = await sb.from("expenses").update({ status: "aprobado", approved_by: ctx.user.id, approved_at: new Date().toISOString(), observation: null }).in("id", ok);
    if (error) throw error;
    await refreshAlerts(ctx.project.id);
    revalidatePath(base(companyCode, projectCode), "layout");
    return { ok: true, data: { approved: ok.length }, message: `${ok.length} comprobante(s) aprobado(s) y enviados a Contabilidad.${noFile.length ? ` ${noFile.length} sin sustento quedaron pendientes.` : ""}` };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function observeExpenses(companyCode: string, projectCode: string, ids: string[], comment: string): Promise<ActionResult> {
  try {
    const ctx = await getProjectContext(companyCode, projectCode);
    if (ctx.project.status === "cerrada") return { ok: false, error: "La obra está cerrada (solo lectura)." };
    if (!can(ctx.role, "approveExpense")) return { ok: false, error: "Solo Gerencia observa gastos." };
    if (comment.trim().length < 5) return { ok: false, error: "Escribe el motivo de la observación." };
    const sb = await supabaseServer();
    const { error } = await sb.from("expenses").update({ status: "observado", observation: comment.trim(), approved_by: null, approved_at: null })
      .in("id", ids).eq("project_id", ctx.project.id).eq("status", "declarado");
    if (error) throw error;
    revalidatePath(base(companyCode, projectCode), "layout");
    return { ok: true, message: "Observación enviada a la obra." };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function voidExpense(companyCode: string, projectCode: string, id: string, reason: string): Promise<ActionResult> {
  try {
    const ctx = await getProjectContext(companyCode, projectCode);
    if (ctx.project.status === "cerrada") return { ok: false, error: "La obra está cerrada (solo lectura)." };
    if (!can(ctx.role, "registerExpense")) return { ok: false, error: "Tu rol no puede anular comprobantes." };
    if (reason.trim().length < 5) return { ok: false, error: "El motivo de anulación es obligatorio." };
    const sb = await supabaseServer();
    const { data: e } = await sb.from("expenses").select("status, created_by").eq("id", id).single();
    if (!e) return { ok: false, error: "Comprobante no encontrado." };
    if (e.status === "anulado") return { ok: false, error: "El comprobante ya está anulado." };
    const { count } = await sb.from("payments").select("id", { count: "exact", head: true }).eq("expense_id", id).eq("voided", false);
    if (count) return { ok: false, error: "Tiene pagos registrados: Contabilidad debe anular los pagos antes." };
    const approver = can(ctx.role, "approveExpense");
    if (!approver && e.status === "aprobado") return { ok: false, error: "Un comprobante aprobado solo lo anula Gerencia." };
    const { error } = await sb.from("expenses").update({ status: "anulado", voided_by: ctx.user.id, voided_at: new Date().toISOString(), void_reason: reason.trim() }).eq("id", id);
    if (error) throw error;
    await refreshAlerts(ctx.project.id);
    revalidatePath(base(companyCode, projectCode), "layout");
    return { ok: true, message: "Comprobante anulado. Queda visible para auditoría." };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}
