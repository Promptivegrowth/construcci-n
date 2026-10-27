import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/primitives";
import { can } from "@/lib/permissions";
import { getProjectContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { Importer } from "./importer";

export const metadata: Metadata = { title: "Importar presupuesto" };

export default async function ImportPage({ params }: { params: Promise<{ company: string; project: string }> }) {
  const { company, project } = await params;
  const ctx = await getProjectContext(company, project);
  if (!can(ctx.role, "importBudget")) redirect(`/empresa/${company}/obra/${project}/presupuesto`);
  const sb = await supabaseServer();
  const [{ data: nodes }, { data: phases }, { count }] = await Promise.all([
    sb.from("wbs_nodes").select("code, level").eq("project_id", ctx.project.id),
    sb.from("phases").select("code, name").eq("project_id", ctx.project.id).order("sort"),
    sb.from("expenses").select("id", { count: "exact", head: true }).eq("project_id", ctx.project.id),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`${ctx.project.code} · Presupuesto`} title="Importar presupuesto aprobado"
        description="Copia el presupuesto cerrado con el cliente en la plantilla estándar (ya faseado y desglosado por WBS). El sistema valida códigos, jerarquía y montos antes de cargar y muestra los errores fila por fila." />
      <Importer companyCode={company} projectCode={ctx.project.code} projectName={ctx.project.name}
        existing={(nodes ?? []).map((n) => ({ code: n.code, level: n.level }))} phases={phases ?? []} hasMovements={(count ?? 0) > 0} />
    </div>
  );
}
