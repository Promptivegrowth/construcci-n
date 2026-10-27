import type { Metadata } from "next";
import { can } from "@/lib/permissions";
import { getProjectContext } from "@/lib/session";
import { signedUrls } from "@/lib/storage";
import { loadWarehouse, stockSummary } from "../_lib/data";
import { MovementsView } from "./_components/movements-view";

export const metadata: Metadata = { title: "Ingresos y salidas de almacén" };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default async function MovimientosPage({ params, searchParams }: {
  params: Promise<{ company: string; project: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { company, project } = await params;
  const sp = await searchParams;
  const ctx = await getProjectContext(company, project);
  const data = await loadWarehouse(ctx.company.id, ctx.project.id);
  const stock = stockSummary(data.materials, data.movements);

  const keyword = sp.busca ? norm(sp.busca) : "";
  const matchMat = new Set(
    data.materials.filter((m) => (!sp.material || m.id === sp.material)
      && (!keyword || (["madera", "epp", "agregados"].includes(keyword) ? m.category === keyword : norm(`${m.name} ${m.code}`).includes(keyword)))).map((m) => m.id),
  );
  const filtered = data.movements
    .filter((m) => matchMat.has(m.material_id))
    .filter((m) => !sp.tipo || m.type === sp.tipo)
    .filter((m) => !sp.proveedor || m.supplier_id === sp.proveedor)
    .filter((m) => !sp.wbs || m.wbs_id === sp.wbs)
    .filter((m) => !sp.fase || m.phase_id === sp.fase)
    .filter((m) => (!sp.desde || m.date >= sp.desde) && (!sp.hasta || m.date <= sp.hasta))
    .reverse();

  const photos = await signedUrls(filtered.slice(0, 400).map((m) => m.photo_path));
  const material = sp.material ? data.materials.find((m) => m.id === sp.material) : null;

  return (
    <MovementsView
      rows={filtered.map((m) => ({ ...m, photo_url: m.photo_path ? photos.get(m.photo_path) ?? null : null }))}
      materials={data.materials}
      materialName={material?.name ?? null}
      keyword={sp.busca ?? null}
      range={{ desde: sp.desde ?? null, hasta: sp.hasta ?? null }}
      filtersActive={Object.keys(sp).some((k) => ["material", "tipo", "proveedor", "wbs", "fase", "desde", "hasta", "busca"].includes(k))}
      options={{
        materials: data.materials.filter((m) => stock.find((s) => s.id === m.id)?.level !== "sin").map((m) => ({ value: m.id, label: `${m.code} · ${m.name}` })),
        suppliers: data.suppliers.filter((s) => data.movements.some((m) => m.supplier_id === s.id)).map((s) => ({ value: s.id, label: s.name })),
        wbs: data.leaves.map((w) => ({ value: w.id, label: `${w.code} · ${w.name}` })),
        phases: data.phases.map((p) => ({ value: p.id, label: p.code })),
      }}
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
