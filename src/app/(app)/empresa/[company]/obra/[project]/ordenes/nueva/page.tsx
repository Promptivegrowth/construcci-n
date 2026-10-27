import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { ButtonLink, PageHeader } from "@/components/ui/primitives";
import { projectEnd } from "@/lib/calc";
import { can } from "@/lib/permissions";
import { getProjectContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { loadExpenseFormData } from "../../gastos/_components/form-data";
import { OrderForm } from "./order-form";

export const metadata: Metadata = { title: "Nueva orden" };

export default async function NuevaOrdenPage({ params }: { params: Promise<{ company: string; project: string }> }) {
  const { company, project } = await params;
  const ctx = await getProjectContext(company, project);
  const base = `/empresa/${company}/obra/${project}`;
  if (!can(ctx.role, "requestOrder") || ctx.project.status === "cerrada") redirect(`${base}/ordenes`);
  const sb = await supabaseServer();
  const [data, { data: materials }] = await Promise.all([
    loadExpenseFormData(ctx.company.id, ctx.project.id),
    sb.from("materials").select("id, code, name, unit").eq("company_id", ctx.company.id).eq("active", true).order("code"),
  ]);
  const approver = can(ctx.role, "approveOrder");
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`${ctx.project.code} · Administración`} title={approver ? "Emitir orden" : "Solicitar orden"}
        description="Define el monto global proyectado de la orden. Cada factura semanal, quincenal o mensual descontará su saldo."
        actions={<ButtonLink href={`${base}/ordenes`} variant="ghost"><ArrowLeft className="h-4 w-4" />Órdenes</ButtonLink>} />
      <OrderForm companyCode={company} projectCode={project} suppliers={data.suppliers} leaves={data.leaves} materials={materials ?? []} canApprove={approver} projectEnd={projectEnd(ctx.project)} />
    </div>
  );
}
