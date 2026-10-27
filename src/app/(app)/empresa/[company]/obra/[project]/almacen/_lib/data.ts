import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { toNum } from "@/lib/format";

export type Material = { id: string; code: string; name: string; unit: string; category: string; min_stock: number; active: boolean };
export type Movement = {
  id: string; material_id: string; type: "ingreso" | "salida" | "devolucion" | "ajuste"; date: string; qty: number; unit_cost: number; total: number;
  supplier_id: string | null; supplier: string | null; order_id: string | null; order: string | null; wbs_id: string | null; wbs: string | null;
  phase_id: string | null; phase: string | null; front: string | null; document_ref: string | null; responsible: string | null; notes: string | null; photo_path: string | null;
  created_at: string;
};

/** Datos de almacén de una obra (los movimientos se paginan: PostgREST limita a 1000 filas). */
export async function loadWarehouse(companyId: string, projectId: string) {
  const sb = await supabaseServer();
  const fetchMoves = async () => {
    const out: Record<string, unknown>[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from("stock_movements")
        .select("id, material_id, movement_type, moved_at, quantity, unit_cost, total_cost, supplier_id, order_id, wbs_id, phase_id, front, document_ref, responsible_name, notes, photo_path, created_at")
        .eq("project_id", projectId).order("moved_at").order("created_at").range(from, from + 999);
      if (error || !data?.length) break;
      out.push(...data);
      if (data.length < 1000) break;
    }
    return out;
  };
  const [{ data: materials }, moves, { data: wbs }, { data: phases }, { data: suppliers }, { data: orders }] = await Promise.all([
    sb.from("materials").select("id, code, name, unit, category, min_stock, active").eq("company_id", companyId).order("code"),
    fetchMoves(),
    sb.from("wbs_nodes").select("id, code, name, cost_type, phase_id, is_leaf").eq("project_id", projectId).order("sort"),
    sb.from("phases").select("id, code, name, start_date").eq("project_id", projectId).order("sort"),
    sb.from("suppliers").select("id, name, ruc, kind").eq("company_id", companyId).neq("kind", "trabajador").order("name"),
    sb.from("orders").select("id, number, title, order_type, status, supplier_id").eq("project_id", projectId).eq("order_type", "OC").in("status", ["aprobada", "cerrada"]).order("number"),
  ]);
  const wbsMap = new Map((wbs ?? []).map((w) => [w.id, w]));
  const phaseMap = new Map((phases ?? []).map((p) => [p.id, p]));
  const supMap = new Map((suppliers ?? []).map((s) => [s.id, s]));
  const ordMap = new Map((orders ?? []).map((o) => [o.id, o]));

  const movements: Movement[] = moves.map((m) => {
    const r = m as Record<string, string | number | null>;
    return {
      id: r.id as string, material_id: r.material_id as string, type: r.movement_type as Movement["type"], date: r.moved_at as string,
      qty: toNum(r.quantity), unit_cost: toNum(r.unit_cost), total: toNum(r.total_cost),
      supplier_id: (r.supplier_id as string) ?? null, supplier: r.supplier_id ? supMap.get(r.supplier_id as string)?.name ?? null : null,
      order_id: (r.order_id as string) ?? null, order: r.order_id ? ordMap.get(r.order_id as string)?.number ?? null : null,
      wbs_id: (r.wbs_id as string) ?? null, wbs: r.wbs_id ? `${wbsMap.get(r.wbs_id as string)?.code ?? ""} · ${wbsMap.get(r.wbs_id as string)?.name ?? ""}` : null,
      phase_id: (r.phase_id as string) ?? null, phase: r.phase_id ? phaseMap.get(r.phase_id as string)?.code ?? null : null,
      front: (r.front as string) ?? null, document_ref: (r.document_ref as string) ?? null, responsible: (r.responsible_name as string) ?? null,
      notes: (r.notes as string) ?? null, photo_path: (r.photo_path as string) ?? null, created_at: r.created_at as string,
    };
  });

  return {
    materials: (materials ?? []).map((m) => ({ ...m, min_stock: toNum(m.min_stock) })) as Material[],
    movements,
    leaves: (wbs ?? []).filter((w) => w.is_leaf).map((w) => ({ id: w.id, code: w.code, name: w.name, phase_id: w.phase_id, cost_type: w.cost_type })),
    phases: (phases ?? []).map((p) => ({ id: p.id, code: p.code, name: p.name, start: p.start_date })),
    suppliers: (suppliers ?? []).map((s) => ({ id: s.id, name: s.name, ruc: s.ruc })),
    orders: (orders ?? []).map((o) => ({ id: o.id, number: o.number ?? "", title: o.title, supplier_id: o.supplier_id })),
  };
}

export type StockRow = Material & { stock: number; qtyIn: number; qtyOut: number; costIn: number; costOut: number; avg: number; value: number; last: string | null; lastPrice: number; minPrice: number; maxPrice: number; level: "ok" | "bajo" | "critico" | "sin" };

/** Kardex resumido por material, calculado desde los movimientos. */
export function stockSummary(materials: Material[], movements: Movement[]): StockRow[] {
  return materials.map((m) => {
    const mv = movements.filter((x) => x.material_id === m.id);
    const ins = mv.filter((x) => x.type === "ingreso");
    const outs = mv.filter((x) => x.type === "salida");
    const qtyIn = ins.reduce((s, x) => s + x.qty, 0);
    const costIn = ins.reduce((s, x) => s + x.total, 0);
    const qtyOut = outs.reduce((s, x) => s + x.qty, 0);
    const costOut = outs.reduce((s, x) => s + x.total, 0);
    const stock = mv.reduce((s, x) => s + (x.type === "salida" ? -x.qty : x.qty), 0);
    const avg = qtyIn > 0 ? costIn / qtyIn : 0;
    const prices = ins.map((x) => x.unit_cost).filter((p) => p > 0);
    const level: StockRow["level"] = !mv.length ? "sin" : m.min_stock > 0 && stock < m.min_stock * 0.5 ? "critico" : m.min_stock > 0 && stock < m.min_stock ? "bajo" : "ok";
    return {
      ...m, stock, qtyIn, qtyOut, costIn, costOut, avg, value: stock * avg, last: mv.at(-1)?.date ?? null,
      lastPrice: prices.at(-1) ?? 0, minPrice: prices.length ? Math.min(...prices) : 0, maxPrice: prices.length ? Math.max(...prices) : 0, level,
    };
  });
}
