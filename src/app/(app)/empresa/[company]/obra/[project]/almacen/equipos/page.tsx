import type { Metadata } from "next";
import { can } from "@/lib/permissions";
import { getProjectContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { toNum } from "@/lib/format";
import { EquipmentView, type EquipmentItem } from "./_components/equipment-view";

export const metadata: Metadata = { title: "Equipos menores" };

export default async function EquiposPage({ params }: { params: Promise<{ company: string; project: string }> }) {
  const { company, project } = await params;
  const ctx = await getProjectContext(company, project);
  const sb = await supabaseServer();
  const [{ data: equipment }, { data: assignments }, { data: orders }, { data: projects }, { data: profiles }] = await Promise.all([
    sb.from("equipment").select("*").eq("company_id", ctx.company.id).order("code"),
    sb.from("equipment_assignments").select("*").order("delivered_at", { ascending: false }).limit(1000),
    sb.from("orders").select("id, number, title, project_id, total, status").eq("company_id", ctx.company.id).eq("order_type", "OS"),
    sb.from("projects").select("id, code, short_name").eq("company_id", ctx.company.id),
    sb.from("profiles").select("id, full_name"),
  ]);
  const projMap = new Map((projects ?? []).map((p) => [p.id, p]));
  const ordMap = new Map((orders ?? []).map((o) => [o.id, o]));
  const people = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const items: EquipmentItem[] = (equipment ?? []).map((e) => {
    const hist = (assignments ?? []).filter((a) => a.equipment_id === e.id).map((a) => ({
      id: a.id, project: projMap.get(a.project_id)?.code ?? "—", project_id: a.project_id, assigned_to: a.assigned_to, dni: a.assigned_to_dni,
      delivered_at: a.delivered_at, delivered_by: a.delivered_by ? people.get(a.delivered_by) ?? null : null, condition_out: a.condition_out, signature_out: a.signature_out,
      returned_at: a.returned_at, condition_in: a.condition_in, signature_in: a.signature_in, notes: a.notes,
    }));
    const o = e.order_id ? ordMap.get(e.order_id) : null;
    return {
      id: e.id, code: e.code, name: e.name, type: e.equipment_type, brand: e.brand, model: e.model, serial: e.serial, ownership: e.ownership as "propio" | "alquilado",
      status: e.status, notes: e.notes, rate_amount: e.rate_amount === null ? null : toNum(e.rate_amount), rate_period: e.rate_period,
      project_id: e.project_id, project_code: e.project_id ? projMap.get(e.project_id)?.code ?? null : null,
      order: o ? { id: o.id, number: o.number ?? "", title: o.title, project: projMap.get(o.project_id)?.code ?? "" } : null, order_id: e.order_id,
      open: hist.find((h) => !h.returned_at) ?? null, history: hist,
    };
  });

  return (
    <EquipmentView
      items={items}
      projectId={ctx.project.id}
      projectCode={ctx.project.code}
      companyCode={company}
      orders={(orders ?? []).map((o) => ({ id: o.id, label: `${o.number} · ${o.title} (${projMap.get(o.project_id)?.code ?? ""})` }))}
      canMove={can(ctx.role, "stockMovement") && ctx.project.status !== "cerrada"}
      canManage={can(ctx.role, "manageMaterials")}
      meta={{ companyName: ctx.company.name, projectLabel: `${ctx.project.code} · ${ctx.project.short_name ?? ctx.project.name}`, userName: ctx.profile.full_name }}
    />
  );
}
