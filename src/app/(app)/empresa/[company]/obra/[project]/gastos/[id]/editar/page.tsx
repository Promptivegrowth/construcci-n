import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { ButtonLink, PageHeader } from "@/components/ui/primitives";
import { docRef, toNum } from "@/lib/format";
import { can } from "@/lib/permissions";
import { getProjectContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { ExpenseForm } from "../../_components/expense-form";
import { loadExpenseFormData } from "../../_components/form-data";
import type { ExpenseInput } from "../../actions";

export const metadata: Metadata = { title: "Corregir comprobante" };

export default async function EditarGastoPage({ params }: { params: Promise<{ company: string; project: string; id: string }> }) {
  const { company, project, id } = await params;
  const ctx = await getProjectContext(company, project);
  const base = `/empresa/${company}/obra/${project}`;
  const sb = await supabaseServer();
  const [{ data: e }, { data: alloc }, { count }] = await Promise.all([
    sb.from("expenses").select("*").eq("id", id).eq("project_id", ctx.project.id).maybeSingle(),
    sb.from("expense_allocations").select("wbs_id, amount_pen").eq("expense_id", id),
    sb.from("expense_files").select("id", { count: "exact", head: true }).eq("expense_id", id),
  ]);
  if (!e) notFound();
  if (!can(ctx.role, "registerExpense") || !["borrador", "observado", "declarado"].includes(e.status) || e.doc_type === "PL") redirect(`${base}/gastos/${id}`);
  const data = await loadExpenseFormData(ctx.company.id, ctx.project.id);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${ctx.project.code} · Comprobante N° ${e.seq}`}
        title={`Corregir ${docRef(e)}`}
        description={e.status === "observado" ? "Corrige lo observado por Gerencia y vuelve a declararlo." : "Completa el registro y decláralo para su aprobación."}
        actions={<ButtonLink href={`${base}/gastos/${id}`} variant="ghost"><ArrowLeft className="h-4 w-4" />Volver al detalle</ButtonLink>}
      />
      <ExpenseForm
        companyCode={company} projectCode={project} companyId={ctx.company.id} projectId={ctx.project.id} projectTc={toNum(ctx.project.exchange_rate)}
        {...data} canOverride={can(ctx.role, "approveOrder")} expenseId={id}
        initial={{
          supplier_id: e.supplier_id ?? "", doc_type: e.doc_type as ExpenseInput["doc_type"], series: e.series ?? "", doc_number: e.doc_number ?? "",
          issue_date: e.issue_date, reception_date: e.reception_date ?? e.issue_date, due_date: e.due_date ?? e.issue_date,
          currency: e.currency as "PEN" | "USD", exchange_rate: toNum(e.exchange_rate), tax_condition: e.tax_condition as ExpenseInput["tax_condition"],
          total: toNum(e.total), retention_pct: toNum(e.retention_pct), phase_id: e.phase_id ?? "", wbs_id: e.wbs_id ?? "", order_id: e.order_id,
          order_override: e.order_override, description: e.description, category: e.category ?? "",
          allocations: (alloc ?? []).map((a) => ({ wbs_id: a.wbs_id, amount: toNum(a.amount_pen) })),
          existingFiles: count ?? 0, observation: e.observation, status: e.status,
        }}
      />
    </div>
  );
}
