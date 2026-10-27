"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, PencilLine, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BatteryBar, Semaphore } from "@/components/ui/battery";
import { ExportMenu } from "@/components/ui/export-menu";
import { Badge, Button, Card, cn } from "@/components/ui/primitives";
import { COST_TYPE_LABEL, CONCILIATION_LABEL, conciliation, consumptionLevel, flatten, ratio, type WbsNode } from "@/lib/calc";
import { money, pct } from "@/lib/format";
import { ChangeDialog } from "./change-dialog";

const STATE_TONE = { conciliado: "green", por_conciliar: "red", revisar: "amber", sin_movimiento: "gray" } as const;

export function WbsTree({ tree, base, threshold, elapsed, phases, canEdit, meta }: {
  tree: WbsNode[]; base: string; threshold: number; elapsed?: number; phases: { id: string; code: string }[]; canEdit: boolean;
  meta: { company: string; project: string; user: string };
}) {
  const all = useMemo(() => flatten(tree), [tree]);
  const [open, setOpen] = useState<Set<string>>(() => new Set(tree.map((n) => n.wbs_id)));
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<WbsNode | null>(null);
  const phaseCode = new Map(phases.map((p) => [p.id, p.code]));

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return null;
    const ids = new Set<string>();
    const byId = new Map(all.map((n) => [n.wbs_id, n]));
    all.filter((n) => `${n.code} ${n.name}`.toLowerCase().includes(term)).forEach((n) => {
      let cur: WbsNode | undefined = n;
      while (cur) { ids.add(cur.wbs_id); cur = cur.parent_id ? byId.get(cur.parent_id) : undefined; }
    });
    return ids;
  }, [q, all]);

  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const renderNode = (n: WbsNode, depth: number): React.ReactNode => {
    if (matches && !matches.has(n.wbs_id)) return null;
    const isOpen = matches ? true : open.has(n.wbs_id);
    const r = ratio(n.paid, n.budget);
    const state = conciliation(n.declared, n.paid);
    const leaf = !n.children.length;
    return (
      <div key={n.wbs_id}>
        <div className={cn("group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-line-soft px-4 py-3 transition hover:bg-brand-blue-50/40 lg:grid-cols-[minmax(260px,1.6fr)_repeat(4,minmax(92px,0.6fr))_minmax(180px,1fr)_auto]",
          depth === 0 && "bg-slate-50/70")}>
          <div className="flex min-w-0 items-center gap-2" style={{ paddingLeft: depth * 20 }}>
            {leaf ? <span className="w-6 shrink-0" /> : (
              <button onClick={() => toggle(n.wbs_id)} className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-ink-muted hover:bg-white hover:text-ink" aria-label="Expandir">
                <ChevronRight className={cn("h-4 w-4 transition", isOpen && "rotate-90")} />
              </button>
            )}
            <Link href={`${base}/presupuesto/${n.wbs_id}`} className="min-w-0">
              <p className={cn("truncate text-[13px] text-ink group-hover:text-brand-blue", depth === 0 ? "font-bold" : leaf ? "font-medium" : "font-semibold")}>
                <span className="text-ink-muted">{n.code}</span> · {n.name}
              </p>
              <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-ink-muted">
                {(n as WbsNode & { cost_center?: string | null }).cost_center && <span>CC {(n as WbsNode & { cost_center?: string }).cost_center}</span>}
                {n.phase_id && <span>{phaseCode.get(n.phase_id)}</span>}
                {n.cost_type && <span>{COST_TYPE_LABEL[n.cost_type]}</span>}
                <span>{n.docs} comprobantes</span>
                <span className="lg:hidden">· {money(n.paid)} de {money(n.budget)}</span>
              </p>
            </Link>
          </div>
          <p className="num hidden text-right text-[13px] font-semibold lg:block">{money(n.budget)}</p>
          <p className="num hidden text-right text-[13px] text-violet-700 lg:block">{money(n.declared)}</p>
          <p className="num hidden text-right text-[13px] text-brand-green-700 lg:block">{money(n.paid)}</p>
          <p className={cn("num hidden text-right text-[13px] font-semibold lg:block", n.budget - n.paid < 0 && "text-danger")}>{money(n.budget - n.paid)}</p>
          <div className="col-span-2 lg:col-span-1"><BatteryBar value={n.paid} total={n.budget} threshold={threshold} elapsed={elapsed} size="sm" label={`${pct(r)}${n.committed ? ` · comp. ${money(n.committed)}` : ""}`} showLabel /></div>
          <div className="col-start-2 row-start-1 flex items-center justify-end gap-1.5 lg:col-start-auto lg:row-start-auto">
            <Badge tone={STATE_TONE[state]} className="hidden xl:inline-flex">{CONCILIATION_LABEL[state]}</Badge>
            <Semaphore level={consumptionLevel(r, threshold)} />
            {canEdit && leaf && (
              <button onClick={() => setEdit(n)} className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted opacity-60 transition hover:bg-white hover:text-brand-blue group-hover:opacity-100" title="Adicional / deductivo">
                <PencilLine className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <AnimatePresence initial={false}>
          {!leaf && isOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
              {n.children.map((c) => renderNode(c, depth + 1))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const exportRows = all.map((n) => ({
    code: `${"   ".repeat(n.level - 1)}${n.code}`, name: n.name, cc: (n as WbsNode & { cost_center?: string }).cost_center ?? "", fase: n.phase_id ? phaseCode.get(n.phase_id) : "",
    level: n.level, budget: n.budget, margin: n.margin, meta: n.budget - n.margin, declared: n.declared, paid: n.paid, committed: n.committed, saldo: n.budget - n.paid,
    pct: ratio(n.paid, n.budget), estado: CONCILIATION_LABEL[conciliation(n.declared, n.paid)],
  }));
  const leaves = all.filter((n) => !n.children.length);
  const sum = (k: keyof WbsNode) => leaves.reduce((s, n) => s + Number(n[k]), 0);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-4 py-3">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar WBS o centro de costo…"
            className="h-9 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm outline-none focus:border-brand-blue focus:bg-white" />
        </div>
        <div className="flex flex-1 justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen(new Set(all.filter((n) => n.children.length).map((n) => n.wbs_id)))}><ChevronsUpDown className="h-4 w-4" />Expandir</Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(new Set())}><ChevronsDownUp className="h-4 w-4" />Contraer</Button>
          <ExportMenu size="sm" meta={{ filename: `Presupuesto_WBS_${meta.project.split(" ")[0]}`, ...meta }}
            build={() => [{
              name: "Presupuesto WBS", title: "Hoja de presupuesto por WBS", subtitle: "Proyectado, margen, meta, declarado, pagado y saldo",
              summary: [
                { label: "Proyectado", value: money(sum("budget")), tone: "blue" }, { label: "Pagado", value: money(sum("paid")), tone: "green" },
                { label: "Comprometido", value: money(sum("committed")), tone: "amber" }, { label: "Saldo", value: money(sum("budget") - sum("paid")), tone: "navy" },
              ],
              columns: [
                { key: "code", header: "WBS", width: 18 }, { key: "name", header: "Descripción", width: 40 }, { key: "cc", header: "CC", width: 8 }, { key: "fase", header: "Fase", width: 7 },
                { key: "budget", header: "Proyectado", type: "money" }, { key: "margin", header: "Margen", type: "money" }, { key: "meta", header: "Monto meta", type: "money" },
                { key: "declared", header: "Declarado", type: "money" }, { key: "paid", header: "Pagado", type: "money" }, { key: "committed", header: "Comprometido", type: "money" },
                { key: "saldo", header: "Saldo", type: "money" }, { key: "pct", header: "% consumo", type: "pct" }, { key: "estado", header: "Conciliación", width: 18 },
              ],
              rows: exportRows,
              totals: { budget: sum("budget"), margin: sum("margin"), meta: sum("budget") - sum("margin"), declared: sum("declared"), paid: sum("paid"), committed: sum("committed"), saldo: sum("budget") - sum("paid") },
            }]} />
        </div>
      </div>
      <div className="hidden grid-cols-[minmax(260px,1.6fr)_repeat(4,minmax(92px,0.6fr))_minmax(180px,1fr)_auto] gap-3 bg-slate-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted lg:grid">
        <span>Partida / centro de costo</span><span className="text-right">Proyectado</span><span className="text-right">Declarado</span><span className="text-right">Pagado</span><span className="text-right">Saldo</span><span>Consumo</span><span className="w-[120px] text-right">Estado</span>
      </div>
      <div>{tree.map((n) => renderNode(n, 0))}</div>
      {!tree.length && <p className="p-10 text-center text-sm text-ink-muted">Esta obra aún no tiene presupuesto. Impórtalo desde Excel para empezar.</p>}
      <ChangeDialog node={edit} onClose={() => setEdit(null)} />
    </Card>
  );
}
