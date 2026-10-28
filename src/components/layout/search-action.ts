"use server";
import { canView } from "@/lib/permissions";
import { getCompanyContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export type SearchHit = { type: "comprobante" | "orden" | "material" | "proveedor" | "usuario"; id: string; title: string; subtitle: string; href: string };

/** Búsqueda global por código, número de comprobante, proveedor, RUC, apellido u orden (respeta RLS). */
export async function globalSearch(companyId: string, companyCode: string, q: string): Promise<SearchHit[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const { role } = await getCompanyContext(companyCode);
  // Cada tipo de resultado solo aparece para los roles que pueden ver su pantalla
  const fin = canView(role, "finance"), alm = canView(role, "warehouse"), audit = canView(role, "audit");
  const sb = await supabaseServer();
  const like = `%${term.replace(/[%_,()]/g, " ")}%`;

  const [{ data: sup }, { data: projects }] = await Promise.all([
    sb.from("suppliers").select("id, name, ruc").eq("company_id", companyId).or(`name.ilike.${like},ruc.ilike.${like}`).limit(6),
    sb.from("projects").select("id, code").eq("company_id", companyId),
  ]);
  const code = new Map((projects ?? []).map((p) => [p.id, p.code]));
  const supIds = (sup ?? []).map((s) => s.id);

  const [{ data: exp }, { data: ord }, { data: mat }, { data: people }] = await Promise.all([
    sb.from("expenses").select("id, project_id, series, doc_number, description, total_pen, issue_date, supplier:suppliers(name, ruc)")
      .eq("company_id", companyId)
      .or([`doc_number.ilike.${like}`, `description.ilike.${like}`, `series.ilike.${like}`, supIds.length ? `supplier_id.in.(${supIds.join(",")})` : null].filter(Boolean).join(","))
      .order("issue_date", { ascending: false }).limit(8),
    sb.from("orders").select("id, project_id, number, title, total").eq("company_id", companyId).or(`number.ilike.${like},title.ilike.${like}`).limit(5),
    sb.from("materials").select("id, code, name, unit").eq("company_id", companyId).or(`name.ilike.${like},code.ilike.${like}`).limit(5),
    sb.from("profiles").select("id, full_name, position").ilike("full_name", like).limit(4),
  ]);

  const base = `/empresa/${companyCode}`;
  const money = (n: number) => `S/ ${Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const hits: SearchHit[] = [];
  for (const e of fin ? exp ?? [] : []) {
    const s = e.supplier as unknown as { name: string; ruc: string } | null;
    hits.push({ type: "comprobante", id: e.id, title: `${[e.series, e.doc_number].filter(Boolean).join("-") || "S/N"} · ${s?.name ?? ""}`,
      subtitle: `${code.get(e.project_id)} · ${e.description} · ${money(Number(e.total_pen))}`, href: `${base}/obra/${code.get(e.project_id)}/gastos/${e.id}` });
  }
  for (const o of ord ?? []) hits.push({ type: "orden", id: o.id, title: `${o.number} · ${o.title}`, subtitle: `${code.get(o.project_id)} · ${money(Number(o.total))}`, href: `${base}/obra/${code.get(o.project_id)}/ordenes/${o.id}` });
  for (const m of alm ? mat ?? [] : []) hits.push({ type: "material", id: m.id, title: `${m.code} · ${m.name}`, subtitle: `Unidad: ${m.unit} · ver ingresos, salidas y destinos`, href: `${base}/materiales?material=${m.id}` });
  for (const s of fin ? sup ?? [] : []) hits.push({ type: "proveedor", id: s.id, title: s.name, subtitle: `RUC ${s.ruc}`, href: `${base}/proveedores?q=${encodeURIComponent(s.ruc)}` });
  for (const p of audit ? people ?? [] : []) hits.push({ type: "usuario", id: p.id, title: p.full_name, subtitle: p.position ?? "", href: `${base}/auditoria?usuario=${p.id}` });
  return hits;
}
