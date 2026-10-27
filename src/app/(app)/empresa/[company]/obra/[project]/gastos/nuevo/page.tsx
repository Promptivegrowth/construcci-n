import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { ButtonLink, PageHeader } from "@/components/ui/primitives";
import { can } from "@/lib/permissions";
import { getProjectContext } from "@/lib/session";
import { toNum } from "@/lib/format";
import { ExpenseForm } from "../_components/expense-form";
import { loadExpenseFormData } from "../_components/form-data";

export const metadata: Metadata = { title: "Registrar gasto" };

export default async function NuevoGastoPage({ params, searchParams }: { params: Promise<{ company: string; project: string }>; searchParams: Promise<{ wbs?: string; orden?: string }> }) {
  const { company, project } = await params;
  const sp = await searchParams;
  const ctx = await getProjectContext(company, project);
  const base = `/empresa/${company}/obra/${project}`;
  if (!can(ctx.role, "registerExpense") || ctx.project.status === "cerrada") redirect(`${base}/gastos`);
  const data = await loadExpenseFormData(ctx.company.id, ctx.project.id);
  const order = data.orders.find((o) => o.id === sp.orden);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${ctx.project.code} · Administración`}
        title="Registrar gasto"
        description="Registra el comprobante en el momento de la compra. Gerencia lo aprueba y Contabilidad lo paga; la batería del WBS se actualiza automáticamente."
        actions={<ButtonLink href={`${base}/gastos`} variant="ghost"><ArrowLeft className="h-4 w-4" />Volver</ButtonLink>}
      />
      <ExpenseForm
        companyCode={company} projectCode={project} companyId={ctx.company.id} projectId={ctx.project.id} projectTc={toNum(ctx.project.exchange_rate)}
        {...data} canOverride={can(ctx.role, "approveOrder")}
        initial={{ wbs_id: order?.wbs_id ?? sp.wbs ?? undefined, order_id: order?.id, supplier_id: order?.supplier_id ?? undefined }}
      />
    </div>
  );
}
