import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { toNum } from "@/lib/format";

export type FormLeaf = { id: string; code: string; name: string; parent_id: string | null; parent_label: string; phase_id: string | null; cost_type: string | null; budget: number; registered: number; paid: number };
export type FormOrder = { id: string; number: string; title: string; order_type: string; supplier_id: string | null; wbs_id: string | null; subtotal_pen: number; invoiced: number };
export type FormSupplier = { id: string; name: string; ruc: string; kind: string };
export type FormPhase = { id: string; code: string; name: string };

export async function loadExpenseFormData(companyId: string, projectId: string) {
  const sb = await supabaseServer();
  const [{ data: suppliers }, { data: phases }, { data: nodes }, { data: stats }, { data: orders }, { data: balances }] = await Promise.all([
    sb.from("suppliers").select("id, name, ruc, kind").eq("company_id", companyId).order("name").limit(2000),
    sb.from("phases").select("id, code, name").eq("project_id", projectId).order("sort"),
    sb.from("wbs_nodes").select("id, code, name, parent_id, phase_id, cost_type, is_leaf, sort").eq("project_id", projectId).order("sort"),
    sb.from("v_wbs_stats").select("wbs_id, budget, registered, paid").eq("project_id", projectId),
    sb.from("orders").select("id, number, title, order_type, supplier_id, wbs_id, subtotal_pen").eq("project_id", projectId).eq("status", "aprobada").order("number"),
    sb.from("v_order_balance").select("order_id, invoiced_pen").eq("project_id", projectId),
  ]);
  const byId = new Map((nodes ?? []).map((n) => [n.id, n]));
  const st = new Map((stats ?? []).map((s) => [s.wbs_id, s]));
  const label = (id: string | null): string => {
    const parts: string[] = [];
    let cur = id ? byId.get(id) : undefined;
    while (cur) { parts.unshift(`${cur.code} ${cur.name}`); cur = cur.parent_id ? byId.get(cur.parent_id) : undefined; }
    return parts.join(" › ");
  };
  const leaves: FormLeaf[] = (nodes ?? []).filter((n) => n.is_leaf).map((n) => {
    // la fase se hereda del ancestro más cercano que la tenga
    let phase = n.phase_id;
    let cur = n.parent_id ? byId.get(n.parent_id) : undefined;
    while (!phase && cur) { phase = cur.phase_id; cur = cur.parent_id ? byId.get(cur.parent_id) : undefined; }
    const s = st.get(n.id);
    return { id: n.id, code: n.code, name: n.name, parent_id: n.parent_id, parent_label: label(n.parent_id) || "Nivel 1", phase_id: phase, cost_type: n.cost_type,
      budget: toNum(s?.budget), registered: toNum(s?.registered), paid: toNum(s?.paid) };
  });
  const inv = new Map((balances ?? []).map((b) => [b.order_id, toNum(b.invoiced_pen)]));
  return {
    suppliers: (suppliers ?? []).filter((s) => !s.ruc.startsWith("PLANILLA")) as FormSupplier[],
    phases: (phases ?? []) as FormPhase[],
    leaves,
    orders: (orders ?? []).map((o) => ({ ...o, subtotal_pen: toNum(o.subtotal_pen), invoiced: inv.get(o.id) ?? 0 })) as FormOrder[],
  };
}
