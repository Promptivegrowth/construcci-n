"use server";
import { revalidatePath } from "next/cache";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { getProjectContext, projectPath } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export type PayrollInput = {
  payroll_type: "obreros" | "staff" | "cts" | "gratificacion" | "liquidacion";
  week: number | null;
  label: string;
  period_start: string;
  period_end: string;
  phase_id: string;
  wbs_id: string;
  notes: string;
  lines: { category: string; workers: number; days: number | null; amount: number }[];
};

const TYPE_LABEL: Record<PayrollInput["payroll_type"], string> = {
  obreros: "Planilla de obreros", staff: "Planilla staff", cts: "Planilla staff — Abono CTS",
  gratificacion: "Planilla staff — Gratificación", liquidacion: "Planilla staff — Liquidación",
};

/** Registra una planilla como costo: comprobante PL + planilla + líneas por categoría. */
export async function registerPayroll(companyCode: string, projectCode: string, input: PayrollInput): Promise<ActionResult> {
  try {
    const ctx = await getProjectContext(companyCode, projectCode);
    if (!can(ctx.role, "registerPayroll")) return { ok: false, error: "Tu rol no puede registrar planillas." };
    if (ctx.project.status === "cerrada") return { ok: false, error: "La obra está cerrada (solo lectura)." };
    const lines = input.lines.filter((l) => Number(l.amount) > 0).map((l) => ({ ...l, amount: Math.round(Number(l.amount) * 100) / 100, workers: Math.max(0, Math.round(Number(l.workers) || 0)) }));
    const total = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
    if (!lines.length || total <= 0) return { ok: false, error: "Ingresa al menos un monto por categoría." };
    if (!input.phase_id || !input.wbs_id) return { ok: false, error: "La planilla debe clasificarse en una fase y un WBS de mano de obra." };
    if (!input.period_end) return { ok: false, error: "Indica la fecha de cierre del periodo." };
    const obreros = input.payroll_type === "obreros";
    if (obreros && (!input.week || input.week < 1)) return { ok: false, error: "Indica el número de semana de obra." };

    const sb = await supabaseServer();
    const pid = ctx.project.id;
    if (obreros) {
      const { data: dup } = await sb.from("payrolls").select("id").eq("project_id", pid).eq("payroll_type", "obreros").eq("week", input.week!).maybeSingle();
      if (dup) return { ok: false, error: `La semana N° ${input.week} ya está registrada en esta obra.` };
    }

    const ruc = obreros ? "PLANILLA-OBR" : "PLANILLA-STF";
    let { data: supplier } = await sb.from("suppliers").select("id").eq("company_id", ctx.company.id).eq("ruc", ruc).maybeSingle();
    if (!supplier) {
      const ins = await sb.from("suppliers").insert({ company_id: ctx.company.id, ruc, name: obreros ? "PLANILLA DE OBREROS" : "PLANILLA STAFF", kind: "trabajador" }).select("id").single();
      if (ins.error) return { ok: false, error: friendlyError(ins.error) };
      supplier = ins.data;
    }

    const { data: stat } = await sb.from("v_wbs_stats").select("budget, registered").eq("wbs_id", input.wbs_id).maybeSingle();
    const exceeds = stat ? Number(stat.registered ?? 0) + total > Number(stat.budget ?? 0) : false;

    const label = obreros ? `Semana N° ${input.week}` : input.label || input.period_end.slice(0, 7);
    const description = obreros ? `${TYPE_LABEL.obreros} — ${label}` : `${TYPE_LABEL[input.payroll_type]}${input.payroll_type === "staff" ? ` — ${label}` : ""}`;
    const isConta = ctx.role === "contabilidad";
    const now = new Date().toISOString();

    const exp = await sb.from("expenses").insert({
      company_id: ctx.company.id, project_id: pid, wbs_id: input.wbs_id, phase_id: input.phase_id, supplier_id: supplier!.id,
      category: obreros ? "PLANILLA OBREROS" : "PLANILLA STAFF", description, doc_type: "PL",
      doc_number: obreros ? `S${String(input.week).padStart(2, "0")}-${input.period_end.slice(0, 4)}` : `ST-${input.period_end.slice(0, 7)}-${input.payroll_type.toUpperCase()}`,
      issue_date: input.period_end, reception_date: input.period_end, due_date: input.period_end, week: obreros ? input.week : null,
      currency: "PEN", tax_condition: "no_gravado", total, origin: "obra", exceeds_budget: exceeds,
      status: isConta ? "aprobado" : "declarado", created_by: ctx.user.id,
      approved_by: isConta ? ctx.user.id : null, approved_at: isConta ? now : null,
    }).select("id").single();
    if (exp.error) return { ok: false, error: friendlyError(exp.error) };

    const pr = await sb.from("payrolls").insert({
      company_id: ctx.company.id, project_id: pid, payroll_type: input.payroll_type, week: obreros ? input.week : null,
      period_label: label, period_start: input.period_start || null, period_end: input.period_end, phase_id: input.phase_id,
      wbs_id: input.wbs_id, total, expense_id: exp.data.id, notes: input.notes || null, created_by: ctx.user.id,
    }).select("id").single();
    if (pr.error) {
      await sb.from("expenses").delete().eq("id", exp.data.id);
      return { ok: false, error: friendlyError(pr.error) };
    }
    const ln = await sb.from("payroll_lines").insert(lines.map((l) => ({ payroll_id: pr.data.id, category: l.category, workers: l.workers, days: l.days, amount: l.amount })));
    if (ln.error) {
      await sb.from("payrolls").delete().eq("id", pr.data.id);
      await sb.from("expenses").delete().eq("id", exp.data.id);
      return { ok: false, error: friendlyError(ln.error) };
    }
    await sb.rpc("refresh_project_alerts", { p_project: pid });
    revalidatePath(projectPath(companyCode, projectCode), "layout");
    return {
      ok: true,
      message: `${label} registrada por S/ ${total.toLocaleString("es-PE", { minimumFractionDigits: 2 })}${isConta ? " · lista para pago" : " · pendiente de aprobación"}${exceeds ? " · supera el saldo del WBS" : ""}`,
    };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

/** Guarda la matriz de distribución proyectada de M.O. (fase × categoría). */
export async function saveLaborProjections(companyCode: string, projectCode: string, rows: { phase_id: string; category: string; amount: number; workers: number | null }[]): Promise<ActionResult> {
  try {
    const ctx = await getProjectContext(companyCode, projectCode);
    if (!can(ctx.role, "editBudget")) return { ok: false, error: "Solo Gerencia puede editar la proyección de mano de obra." };
    const sb = await supabaseServer();
    const clean = rows.filter((r) => r.phase_id && ["capataz", "operario", "oficial", "peon"].includes(r.category)).map((r) => ({
      project_id: ctx.project.id, phase_id: r.phase_id, category: r.category as "capataz" | "operario" | "oficial" | "peon",
      amount: Math.max(0, Math.round(Number(r.amount) * 100) / 100), workers: r.workers ? Math.round(r.workers) : null,
    }));
    const { error } = await sb.from("labor_projections").upsert(clean, { onConflict: "project_id,phase_id,category" });
    if (error) return { ok: false, error: friendlyError(error) };
    revalidatePath(`${projectPath(companyCode, projectCode)}/mano-de-obra`);
    return { ok: true, message: "Proyección de mano de obra actualizada" };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}
