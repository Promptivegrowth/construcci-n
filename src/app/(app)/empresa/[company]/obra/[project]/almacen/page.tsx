import type { Metadata } from "next";
import { can } from "@/lib/permissions";
import { getProjectContext } from "@/lib/session";
import { loadWarehouse, stockSummary } from "./_lib/data";
import { KardexView } from "./_components/kardex-view";

export const metadata: Metadata = { title: "Kardex valorizado" };

export default async function AlmacenPage({ params }: { params: Promise<{ company: string; project: string }> }) {
  const { company, project } = await params;
  const ctx = await getProjectContext(company, project);
  const data = await loadWarehouse(ctx.company.id, ctx.project.id);
  const stock = stockSummary(data.materials, data.movements);

  return (
    <KardexView
      stock={stock}
      movements={data.movements}
      canMove={can(ctx.role, "stockMovement") && ctx.project.status !== "cerrada"}
      meta={{ companyName: ctx.company.name, projectLabel: `${ctx.project.code} · ${ctx.project.short_name ?? ctx.project.name}`, userName: ctx.profile.full_name }}
      form={{
        companyCode: company, projectCode: ctx.project.code, companyId: ctx.company.id, projectId: ctx.project.id, userName: ctx.profile.full_name,
        materials: stock.filter((s) => s.active).map((s) => ({ id: s.id, code: s.code, name: s.name, unit: s.unit, category: s.category, stock: s.stock, avg: s.avg })),
        leaves: data.leaves, phases: data.phases, suppliers: data.suppliers, orders: data.orders,
      }}
    />
  );
}
