import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/primitives";
import { toNum } from "@/lib/format";
import { getCompanyContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { SuppliersView, type SupplierRow } from "./_components/suppliers-view";

export const metadata: Metadata = { title: "Proveedores" };

export default async function ProveedoresPage({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<{ q?: string }> }) {
  const { company } = await params;
  const { q } = await searchParams;
  const ctx = await getCompanyContext(company);
  const sb = await supabaseServer();

  const [{ data: suppliers }, { data: projects }, { data: expenses }] = await Promise.all([
    sb.from("suppliers").select("*").eq("company_id", ctx.company.id).order("name"),
    sb.from("projects").select("id, code").eq("company_id", ctx.company.id),
    sb.from("expenses").select("id, supplier_id, project_id, total_pen, payable_pen, retention_pen, status, issue_date")
      .eq("company_id", ctx.company.id).not("status", "in", "(borrador,anulado)").limit(10000),
  ]);
  const projectIds = (projects ?? []).map((p) => p.id);
  const { data: paid } = projectIds.length
    ? await sb.from("v_expense_paid").select("expense_id, paid_pen").in("project_id", projectIds).limit(10000)
    : { data: [] };
  const paidBy = new Map((paid ?? []).map((p) => [p.expense_id, toNum(p.paid_pen)]));
  const code = new Map((projects ?? []).map((p) => [p.id, p.code]));

  const agg = new Map<string, { invoiced: number; paid: number; balance: number; retention: number; docs: number; projects: Set<string>; last: string | null }>();
  for (const e of expenses ?? []) {
    if (!e.supplier_id) continue;
    const a = agg.get(e.supplier_id) ?? { invoiced: 0, paid: 0, balance: 0, retention: 0, docs: 0, projects: new Set<string>(), last: null };
    const p = paidBy.get(e.id) ?? 0;
    a.invoiced += toNum(e.total_pen);
    a.paid += p;
    a.balance += Math.max(0, toNum(e.payable_pen) - p);
    a.retention += toNum(e.retention_pen);
    a.docs++;
    a.projects.add(code.get(e.project_id) ?? "");
    a.last = !a.last || e.issue_date > a.last ? e.issue_date : a.last;
    agg.set(e.supplier_id, a);
  }

  const term = (q ?? "").trim().toLowerCase();
  const rows: SupplierRow[] = (suppliers ?? [])
    .filter((s) => !term || s.ruc.toLowerCase().includes(term) || s.name.toLowerCase().includes(term))
    .map((s) => {
      const a = agg.get(s.id);
      return {
        id: s.id, ruc: s.ruc, name: s.name, kind: s.kind, phone: s.phone, email: s.email, address: s.address, bank: s.bank, account_number: s.account_number,
        invoiced: a?.invoiced ?? 0, paid: a?.paid ?? 0, balance: a?.balance ?? 0, retention: a?.retention ?? 0, docs: a?.docs ?? 0,
        projects: [...(a?.projects ?? [])].filter(Boolean).sort().join(", "), last: a?.last ?? null,
      };
    });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={ctx.company.tagline ?? ctx.company.name}
        title="Proveedores"
        description="Directorio de proveedores, subcontratistas y entidades con lo facturado, pagado y el saldo por pagar consolidado de todas las obras de la empresa."
      />
      <SuppliersView rows={rows} companyCode={ctx.company.code} companyName={ctx.company.name} userName={ctx.profile.full_name} filter={q ?? null}
        canEdit={["gerente_general", "gerente_proyectos", "administrador", "contabilidad"].includes(ctx.role)} />
    </div>
  );
}
