import type { Metadata } from "next";
import { FileUp } from "lucide-react";
import { UrlSegment } from "@/components/ui/filters";
import { CountUp, Stagger, StaggerItem } from "@/components/ui/motion";
import { ButtonLink, Card, PageHeader, cn } from "@/components/ui/primitives";
import { buildTree, elapsed, ratio, totals } from "@/lib/calc";
import { pct } from "@/lib/format";
import { can, canView } from "@/lib/permissions";
import { getPhases, getWbsStats } from "@/lib/queries";
import { getProjectContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { BudgetChanges } from "./_components/budget-changes";
import { WbsTree } from "./_components/wbs-tree";
import { NoAccess } from "@/components/ui/no-access";

export const metadata: Metadata = { title: "Presupuesto y WBS" };

export default async function BudgetPage({ params, searchParams }: { params: Promise<{ company: string; project: string }>; searchParams: Promise<{ fase?: string }> }) {
  const { company, project } = await params;
  const { fase } = await searchParams;
  const ctx = await getProjectContext(company, project);
  if (!canView(ctx.role, "finance")) return <NoAccess role={ctx.role} area="finance" back={`/empresa/${company}/obra/${project}`} backLabel="Volver a la obra" />;
  const p = ctx.project;
  const sb = await supabaseServer();
  const [stats, phases, { data: changes }] = await Promise.all([
    getWbsStats(p.id), getPhases(p.id),
    sb.from("budget_changes").select("*, wbs:wbs_nodes(code, name), author:profiles(full_name)").eq("project_id", p.id).order("created_at", { ascending: false }).limit(300),
  ]);

  // Filtro por fase: hojas de esa fase y sus ancestros
  let rows = stats;
  if (fase) {
    const keep = new Set<string>();
    const byId = new Map(stats.map((s) => [s.wbs_id, s]));
    stats.filter((s) => s.is_leaf && s.phase_id === fase).forEach((s) => {
      let cur: typeof s | undefined = s;
      while (cur) { keep.add(cur.wbs_id); cur = cur.parent_id ? byId.get(cur.parent_id) : undefined; }
    });
    rows = stats.filter((s) => keep.has(s.wbs_id));
  }
  const t = totals(rows);
  const tree = buildTree(rows);
  const base = `/empresa/${company}/obra/${p.code}`;
  const canEdit = can(ctx.role, "editBudget") && p.status !== "cerrada";
  const kpis = [
    { label: "Proyectado", v: t.budget, c: "text-brand-blue" },
    { label: "Margen objetivo", v: t.margin, c: "text-ink" },
    { label: "Monto meta", v: t.budget - t.margin, c: "text-ink", sub: "Proyectado − margen" },
    { label: "Pagado", v: t.paid, c: "text-brand-green-700", sub: pct(ratio(t.paid, t.budget)) },
    { label: "Comprometido", v: t.committed, c: "text-[#9a5200]" },
    { label: "Saldo", v: t.budget - t.paid, c: t.budget - t.paid < 0 ? "text-danger" : "text-ink" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`${p.code} · Hoja de presupuesto`} title="Presupuesto y WBS"
        description="Estructura de centros de costo de hasta tres niveles. El presupuesto vive en las partidas de último nivel; los niveles superiores acumulan."
        actions={can(ctx.role, "importBudget") && p.status !== "cerrada" ? <ButtonLink href={`${base}/presupuesto/importar`} variant="outline"><FileUp className="h-4 w-4" />Importar desde Excel</ButtonLink> : undefined} />

      <Stagger className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <StaggerItem key={k.label}>
            <Card className="h-full p-4">
              <p className="text-xs font-medium text-ink-muted">{k.label}</p>
              <p className={cn("mt-1 whitespace-nowrap font-display text-base font-semibold 2xl:text-xl", k.c)}><CountUp value={k.v} /></p>
              {k.sub && <p className="text-[11px] text-ink-muted">{k.sub}</p>}
            </Card>
          </StaggerItem>
        ))}
      </Stagger>

      <UrlSegment name="fase" options={[{ value: "", label: "Todas las fases" }, ...phases.map((f) => ({ value: f.id, label: f.code === f.name ? f.code : `${f.code} · ${f.name.split("·")[1]?.trim() ?? f.name}` }))]} />

      <WbsTree tree={tree} base={base} threshold={p.alert_threshold / 100} elapsed={p.status === "ejecucion" ? elapsed(p) : undefined}
        phases={phases.map((f) => ({ id: f.id, code: f.code }))} canEdit={canEdit}
        meta={{ company: ctx.company.tagline ?? ctx.company.name, project: `${p.code} · ${p.name}`, user: ctx.profile.full_name }} />

      <BudgetChanges changes={(changes ?? []).map((c) => ({
        id: c.id, type: c.change_type, amount: Number(c.amount), prev: Number(c.previous_budget ?? 0), next: Number(c.new_budget ?? 0), reason: c.reason,
        at: c.created_at, wbs: (c.wbs as unknown as { code: string; name: string } | null), author: (c.author as unknown as { full_name: string } | null)?.full_name ?? "—",
      }))} />
    </div>
  );
}
