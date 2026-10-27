import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/primitives";
import { buildTree, conciliation, flatten, totals, type WbsNode } from "@/lib/calc";
import { getWbsStats } from "@/lib/queries";
import { getProjectContext } from "@/lib/session";
import { ConciliationView, type CatCard, type LeafCard } from "./_components/conciliation-view";

export const metadata: Metadata = { title: "Conciliación Obra vs. Contabilidad" };

export default async function ConciliacionPage({ params }: { params: Promise<{ company: string; project: string }> }) {
  const { company, project } = await params;
  const ctx = await getProjectContext(company, project);
  const stats = await getWbsStats(ctx.project.id);
  const tree = buildTree(stats);
  const t = totals(stats);

  const toLeaf = (n: WbsNode, path: string): LeafCard => ({
    id: n.wbs_id, code: n.code, name: n.name, path, budget: n.budget, declared: n.declared, paid: n.paid, docs: n.docs,
    pending: n.pending_approval, state: conciliation(n.declared, n.paid),
  });
  const cards: CatCard[] = tree.map((root) => {
    const leaves: LeafCard[] = root.children.length
      ? root.children.flatMap((c) => (c.children.length ? flatten(c.children).filter((x) => x.is_leaf).map((x) => toLeaf(x, c.name)) : [toLeaf(c, "")]))
      : [toLeaf(root, "")];
    return { id: root.wbs_id, code: root.code, name: root.name, budget: root.budget, declared: root.declared, paid: root.paid, state: conciliation(root.declared, root.paid), leaves };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${ctx.project.code} · Contabilidad`}
        title="Conciliación Obra vs. Contabilidad"
        description="Proyectado = presupuesto aprobado · Declarado = gasto informado por la obra con su comprobante · Pagado = pagos registrados por Contabilidad · Saldo = proyectado − pagado. Un comprobante puede cubrir varias subcategorías sin duplicarse."
      />
      <ConciliationView
        cards={cards}
        totals={{ budget: t.budget, declared: t.declared, paid: t.paid }}
        project={{ code: ctx.project.code, name: ctx.project.name, short: ctx.project.short_name ?? ctx.project.name, company: ctx.company.tagline ?? ctx.company.name, threshold: ctx.project.alert_threshold / 100 }}
        refx={{ company, project }}
        meta={{ company: ctx.company.legal_name ?? ctx.company.name, project: `${ctx.project.code} · ${ctx.project.name}`, user: ctx.profile.full_name }}
      />
    </div>
  );
}
