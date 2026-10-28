"use server";
import { revalidatePath } from "next/cache";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { getProjectContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type OrderInput = {
  order_type: "OS" | "OC";
  supplier_id: string;
  wbs_id: string;
  title: string;
  description: string;
  currency: "PEN" | "USD";
  exchange_rate: number;
  includes_igv: boolean;
  billing_frequency: "unica" | "semanal" | "quincenal" | "mensual";
  start_date: string;
  end_date: string;
  notes: string;
  items: { description: string; unit: string; quantity: number; unit_price: number; material_id?: string | null }[];
};

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export async function createOrder(companyCode: string, projectCode: string, input: OrderInput): Promise<ActionResult<{ id: string; number: string }>> {
  try {
    const ctx = await getProjectContext(companyCode, projectCode);
    if (!can(ctx.role, "requestOrder")) return { ok: false, error: "Tu rol no puede solicitar órdenes." };
    if (!input.supplier_id) return { ok: false, error: "Selecciona el proveedor." };
    if (!input.wbs_id) return { ok: false, error: "Indica el WBS al que se carga la orden." };
    if (input.title.trim().length < 4) return { ok: false, error: "Escribe el objeto de la orden." };
    const items = input.items.filter((i) => i.description.trim() && i.quantity > 0 && i.unit_price >= 0);
    if (!items.length) return { ok: false, error: "Agrega al menos un ítem con cantidad y precio." };
    if (input.end_date && input.start_date && input.end_date < input.start_date) return { ok: false, error: "La fecha de fin no puede ser anterior al inicio." };

    const sb = await supabaseServer();
    const { data: wbs } = await sb.from("wbs_nodes").select("id, is_leaf, project_id, phase_id, parent_id").eq("id", input.wbs_id).single();
    if (!wbs || wbs.project_id !== ctx.project.id || !wbs.is_leaf) return { ok: false, error: "El WBS debe ser de último nivel de esta obra." };
    let phase = wbs.phase_id;
    let parent = wbs.parent_id;
    while (!phase && parent) {
      const { data: p } = await sb.from("wbs_nodes").select("phase_id, parent_id").eq("id", parent).single();
      phase = p?.phase_id ?? null;
      parent = p?.parent_id ?? null;
    }

    const base = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
    const total = r2(input.includes_igv ? base * 1.18 : base);
    const direct = can(ctx.role, "approveOrder");
    const { data, error } = await sb.from("orders").insert({
      company_id: ctx.company.id, project_id: ctx.project.id, order_type: input.order_type, supplier_id: input.supplier_id, wbs_id: input.wbs_id, phase_id: phase,
      title: input.title.trim(), description: input.description.trim() || null, currency: input.currency, exchange_rate: input.currency === "USD" ? input.exchange_rate : 1,
      includes_igv: input.includes_igv, total, billing_frequency: input.billing_frequency, start_date: input.start_date || null, end_date: input.end_date || null,
      notes: input.notes.trim() || null, status: direct ? "aprobada" : "solicitada", requested_by: ctx.user.id,
      approved_by: direct ? ctx.user.id : null, approved_at: direct ? new Date().toISOString() : null,
    }).select("id, number").single();
    if (error) throw error;
    const { error: iErr } = await sb.from("order_items").insert(items.map((i) => ({
      order_id: data.id, description: i.description.trim(), unit: i.unit || "und", quantity: i.quantity, unit_price: i.unit_price, material_id: i.material_id ?? null,
    })));
    if (iErr) throw iErr;
    revalidatePath(`/empresa/${companyCode}/obra/${projectCode}`, "layout");
    return { ok: true, data: { id: data.id, number: data.number ?? "" }, message: direct ? `Orden ${data.number} emitida y aprobada.` : `Orden ${data.number} solicitada. Queda pendiente de aprobación de Gerencia.` };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function changeOrderStatus(companyCode: string, projectCode: string, id: string, action: "aprobar" | "rechazar" | "cerrar" | "anular", note?: string): Promise<ActionResult> {
  try {
    const ctx = await getProjectContext(companyCode, projectCode);
    if (ctx.project.status === "cerrada") return { ok: false, error: "La obra está cerrada (solo lectura)." };
    if (!can(ctx.role, "approveOrder")) return { ok: false, error: "Solo Gerencia aprueba, cierra o anula órdenes." };
    const sb = await supabaseServer();
    const { data: o } = await sb.from("orders").select("id, status, number, notes").eq("id", id).eq("project_id", ctx.project.id).single();
    if (!o) return { ok: false, error: "Orden no encontrada." };
    const stamp = `${new Date().toLocaleDateString("es-PE")} · ${ctx.profile.full_name}: ${note?.trim() ?? ""}`;
    let patch: Database["public"]["Tables"]["orders"]["Update"] = {};
    if (action === "aprobar" || action === "rechazar") {
      if (o.status !== "solicitada") return { ok: false, error: "Solo se aprueban o rechazan órdenes solicitadas." };
      if (action === "rechazar" && (note?.trim().length ?? 0) < 5) return { ok: false, error: "Indica el motivo del rechazo." };
      patch = { status: action === "aprobar" ? "aprobada" : "rechazada", approved_by: ctx.user.id, approved_at: new Date().toISOString(), ...(note?.trim() ? { notes: [o.notes, stamp].filter(Boolean).join("\n") } : {}) };
    } else if (action === "cerrar") {
      if (o.status !== "aprobada") return { ok: false, error: "Solo se cierran órdenes aprobadas." };
      patch = { status: "cerrada", notes: [o.notes, note?.trim() ? stamp : null].filter(Boolean).join("\n") || null };
    } else {
      if (["anulada", "cerrada"].includes(o.status)) return { ok: false, error: "La orden ya no está vigente." };
      if ((note?.trim().length ?? 0) < 5) return { ok: false, error: "El motivo de anulación es obligatorio." };
      const { count } = await sb.from("expenses").select("id", { count: "exact", head: true }).eq("order_id", id).neq("status", "anulado");
      if (count) return { ok: false, error: "La orden tiene comprobantes asociados; ciérrala en lugar de anularla." };
      patch = { status: "anulada", notes: [o.notes, stamp].filter(Boolean).join("\n") };
    }
    const { error } = await sb.from("orders").update(patch).eq("id", id);
    if (error) throw error;
    revalidatePath(`/empresa/${companyCode}/obra/${projectCode}`, "layout");
    const verb = { aprobar: "aprobada", rechazar: "rechazada", cerrar: "cerrada", anular: "anulada" }[action];
    return { ok: true, message: `Orden ${o.number} ${verb}.` };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}
