import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/primitives";
import { buildTree, flatten } from "@/lib/calc";
import { getWbsStats } from "@/lib/queries";
import { getProjectContext } from "@/lib/session";
import { ReportsCenter } from "./reports-center";
import { canView } from "@/lib/permissions";
import { NoAccess } from "@/components/ui/no-access";

export const metadata: Metadata = { title: "Reportes" };

export default async function ReportsPage({ params }: { params: Promise<{ company: string; project: string }> }) {
  const { company, project } = await params;
  const ctx = await getProjectContext(company, project);
  if (!canView(ctx.role, "finance")) return <NoAccess role={ctx.role} area="finance" back={`/empresa/${company}/obra/${project}`} backLabel="Volver a la obra" />;
  const stats = await getWbsStats(ctx.project.id);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`${ctx.project.code} · Reportes`} title="Centro de reportes"
        description="Reportes ejecutivos con la identidad de Grupo Cruz, exportables a Excel y PDF. Filtra por quincena, mes o rango de fechas." />
      <ReportsCenter companyCode={company} projectCode={ctx.project.code}
        meta={{ company: ctx.company.tagline ?? ctx.company.name, project: `${ctx.project.code} · ${ctx.project.name}`, user: ctx.profile.full_name }}
        start={ctx.project.start_date} status={ctx.project.status}
        wbs={flatten(buildTree(stats)).map((n) => ({ id: n.wbs_id, label: `${"  ".repeat(n.level - 1)}${n.code} · ${n.name}` }))} />
    </div>
  );
}
