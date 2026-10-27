import type { Metadata } from "next";
import { can } from "@/lib/permissions";
import { getCompanyContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { toNum } from "@/lib/format";
import { MaterialsView, type CatalogRow, type TraceRow } from "./_components/materials-view";

export const metadata: Metadata = { title: "Catálogo de materiales" };

export default async function MaterialesPage({ params, searchParams }: {
  params: Promise<{ company: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { company } = await params;
  const sp = await searchParams;
  const ctx = await getCompanyContext(company);
  const sb = await supabaseServer();

  const [{ data: materials }, { data: projects }] = await Promise.all([
    sb.from("materials").select("*").eq("company_id", ctx.company.id).order("code"),
    sb.from("projects").select("id, code, short_name, name").eq("company_id", ctx.company.id).order("code"),
  ]);
  const projIds = (projects ?? []).map((p) => p.id);
  const { data: stock } = projIds.length ? await sb.from("v_stock").select("*").in("project_id", projIds).limit(2000) : { data: [] };

  const catalog: CatalogRow[] = (materials ?? []).map((m) => {
    const rows = (stock ?? []).filter((s) => s.material_id === m.id);
    const qtyIn = rows.reduce((s, r) => s + toNum(r.qty_in), 0);
    const costIn = rows.reduce((s, r) => s + toNum(r.cost_in), 0);
    return {
      id: m.id, code: m.code, name: m.name, unit: m.unit, category: m.category, min_stock: toNum(m.min_stock), description: m.description, active: m.active,
      stock: rows.reduce((s, r) => s + toNum(r.stock), 0), qtyIn, costIn, avg: qtyIn ? costIn / qtyIn : 0, projects: rows.filter((r) => toNum(r.qty_in) > 0).length,
      last: rows.map((r) => r.last_movement).filter(Boolean).sort().at(-1) ?? null,
    };
  });

  let trace: TraceRow[] = [];
  const selected = sp.material ? catalog.find((c) => c.id === sp.material) ?? null : null;
  if (selected) {
    const moves: Record<string, unknown>[] = [];
    for (let from = 0; ; from += 1000) {
      let q = sb.from("stock_movements")
        .select("id, project_id, movement_type, moved_at, quantity, unit_cost, total_cost, supplier_id, wbs_id, front, document_ref, responsible_name")
        .eq("company_id", ctx.company.id).eq("material_id", selected.id);
      if (sp.desde) q = q.gte("moved_at", sp.desde);
      if (sp.hasta) q = q.lte("moved_at", sp.hasta);
      if (sp.obra) q = q.eq("project_id", sp.obra);
      const { data } = await q.order("moved_at", { ascending: false }).range(from, from + 999);
      if (!data?.length) break;
      moves.push(...data);
      if (data.length < 1000) break;
    }
    const wbsIds = [...new Set(moves.map((m) => m.wbs_id).filter(Boolean))] as string[];
    const supIds = [...new Set(moves.map((m) => m.supplier_id).filter(Boolean))] as string[];
    const [{ data: wbs }, { data: sups }] = await Promise.all([
      wbsIds.length ? sb.from("wbs_nodes").select("id, code, name").in("id", wbsIds) : Promise.resolve({ data: [] as { id: string; code: string; name: string }[] }),
      supIds.length ? sb.from("suppliers").select("id, name").in("id", supIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);
    const wMap = new Map((wbs ?? []).map((w) => [w.id, w]));
    const sMap = new Map((sups ?? []).map((s) => [s.id, s.name]));
    const pMap = new Map((projects ?? []).map((p) => [p.id, p]));
    trace = moves.map((m) => {
      const r = m as Record<string, string | number | null>;
      const w = r.wbs_id ? wMap.get(r.wbs_id as string) : null;
      return {
        id: r.id as string, project_id: r.project_id as string, project: pMap.get(r.project_id as string)?.code ?? "—", type: r.movement_type as string,
        date: r.moved_at as string, qty: toNum(r.quantity), unit_cost: toNum(r.unit_cost), total: toNum(r.total_cost),
        supplier: r.supplier_id ? sMap.get(r.supplier_id as string) ?? null : null, wbs: w ? `${w.code} · ${w.name}` : null,
        front: (r.front as string) ?? null, document_ref: (r.document_ref as string) ?? null, responsible: (r.responsible_name as string) ?? null,
      };
    });
  }

  return (
    <MaterialsView
      companyCode={company}
      catalog={catalog}
      selected={selected}
      trace={trace}
      projects={(projects ?? []).map((p) => ({ value: p.id, label: `${p.code} · ${p.short_name ?? p.name}` }))}
      canManage={can(ctx.role, "manageMaterials")}
      meta={{ companyName: ctx.company.name, userName: ctx.profile.full_name }}
    />
  );
}
