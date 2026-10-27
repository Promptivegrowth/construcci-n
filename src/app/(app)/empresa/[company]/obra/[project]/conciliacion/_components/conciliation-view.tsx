"use client";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, FileSearch, Landmark, LoaderCircle, Scale, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BatteryBar } from "@/components/ui/battery";
import { Drawer } from "@/components/ui/dialog";
import { ExportMenu } from "@/components/ui/export-menu";
import { CountUp } from "@/components/ui/motion";
import { Badge, Card, cn } from "@/components/ui/primitives";
import { CONCILIATION_LABEL, EXPENSE_STATUS, type Conciliation, type Tone } from "@/lib/calc";
import { DOC_TYPE_LABEL, date, docRef, money, pct } from "@/lib/format";
import type { ExportSheet } from "@/lib/export/types";
import { differenceDetailAction, type DiffDoc } from "../actions";

export type LeafCard = { id: string; code: string; name: string; path: string; budget: number; declared: number; paid: number; docs: number; pending: number; state: Conciliation };
export type CatCard = { id: string; code: string; name: string; budget: number; declared: number; paid: number; state: Conciliation; leaves: LeafCard[] };

const STATE_TONE: Record<Conciliation, Tone> = { conciliado: "green", por_conciliar: "amber", revisar: "red", sin_movimiento: "gray" };
const RANK: Record<Conciliation, number> = { revisar: 3, por_conciliar: 2, conciliado: 1, sin_movimiento: 0 };

function diffText(declared: number, paid: number) {
  const d = paid - declared;
  if (declared < 0.5 && paid < 0.5) return { text: "Sin comprobantes registrados", cls: "text-ink-muted" };
  if (Math.abs(d) < 1) return { text: "Declarado y pagado coinciden", cls: "text-brand-green-700" };
  if (d < 0) return { text: `Diferencia: ${money(-d)} · Falta pagar respecto a lo declarado`, cls: "text-danger" };
  return { text: `Diferencia: ${money(d)} · Pagado sin declarar por la obra`, cls: "text-danger" };
}

function Metric({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl border border-line-soft bg-white px-3 py-2.5">
      <p className="text-[11px] text-ink-muted">{label}</p>
      <p className={cn("num truncate font-display text-[15px] font-semibold sm:text-base", strong ? "text-navy-900" : "text-ink")}>{money(value)}</p>
    </div>
  );
}

export function ConciliationView({ cards, totals, project, refx, meta }: {
  cards: CatCard[]; totals: { budget: number; declared: number; paid: number };
  project: { code: string; name: string; short: string; company: string; threshold: number };
  refx: { company: string; project: string }; meta: { company: string; project: string; user: string };
}) {
  const [filter, setFilter] = useState<Conciliation | "todos">("todos");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<{ title: string; ids: string[]; declared: number; paid: number } | null>(null);

  const allLeaves = useMemo(() => cards.flatMap((c) => c.leaves.map((l) => ({ ...l, cat: `${c.code} · ${c.name}` }))), [cards]);
  const counts = useMemo(() => {
    const m: Record<string, number> = { conciliado: 0, por_conciliar: 0, revisar: 0, sin_movimiento: 0 };
    allLeaves.forEach((l) => m[l.state]++);
    return m;
  }, [allLeaves]);
  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return cards
      .map((c) => ({
        ...c,
        state: c.leaves.reduce<Conciliation>((w, l) => (RANK[l.state] > RANK[w] ? l.state : w), "sin_movimiento"),
        leaves: c.leaves.filter((l) => (filter === "todos" || l.state === filter) && (!term || `${l.code} ${l.name} ${l.path} ${c.name}`.toLowerCase().includes(term))),
      }))
      .filter((c) => c.leaves.length);
  }, [cards, filter, q]);

  const diffDeclared = totals.paid - totals.declared;
  const sheets = (): ExportSheet[] => [{
    name: "Conciliación", title: "Conciliación Obra vs. Contabilidad", subtitle: "Proyectado, declarado por obra y pagado por contabilidad por WBS",
    summary: [
      { label: "Proyectado", value: money(totals.budget), tone: "navy" },
      { label: "Declarado por obra", value: money(totals.declared), tone: "blue" },
      { label: "Pagado por contabilidad", value: money(totals.paid), tone: "green" },
      { label: "Saldo presupuestal", value: money(totals.budget - totals.paid), tone: totals.paid > totals.budget ? "red" : "navy" },
    ],
    columns: [
      { key: "cat", header: "Categoría", width: 30 }, { key: "code", header: "WBS", width: 14 }, { key: "name", header: "Subcategoría", width: 34 },
      { key: "budget", header: "Proyectado", type: "money" }, { key: "declared", header: "Declarado obra", type: "money" }, { key: "paid", header: "Pagado contabilidad", type: "money" },
      { key: "saldo", header: "Saldo", type: "money" }, { key: "diff", header: "Diferencia (pagado − declarado)", type: "money" }, { key: "state", header: "Estado", width: 20 },
    ],
    rows: allLeaves.map((l) => ({ cat: l.cat, code: l.code, name: l.path ? `${l.path} › ${l.name}` : l.name, budget: l.budget, declared: l.declared, paid: l.paid,
      saldo: l.budget - l.paid, diff: l.paid - l.declared, state: CONCILIATION_LABEL[l.state] })),
    totals: { budget: totals.budget, declared: totals.declared, paid: totals.paid, saldo: totals.budget - totals.paid, diff: diffDeclared },
  }];

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[330px_minmax(0,1fr)]">
      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-3xl bg-[linear-gradient(150deg,#0b5cab_0%,#062a4d_100%)] p-6 text-white shadow-pop">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/65">Presupuesto de la obra</p>
          <p className="mt-2 font-display text-2xl font-bold leading-tight">{project.short}</p>
          <p className="mt-1 text-xs text-white/65">{project.company} · {project.code}</p>
          <p className="mt-5 text-xs text-white/60">Total proyectado</p>
          <p className="font-display text-3xl font-bold"><CountUp value={totals.budget} /></p>
        </motion.div>
        <Card className="space-y-4 p-5">
          <div><p className="text-xs text-ink-muted">Gasto declarado por Obra</p><p className="font-display text-xl font-semibold"><CountUp value={totals.declared} /></p></div>
          <div><p className="text-xs text-ink-muted">Pagado por Contabilidad</p><p className="font-display text-xl font-semibold text-brand-green-700"><CountUp value={totals.paid} /></p></div>
          <div><p className="text-xs text-ink-muted">Saldo presupuestal</p><p className={cn("font-display text-xl font-semibold", totals.paid > totals.budget ? "text-danger" : "text-navy-900")}><CountUp value={totals.budget - totals.paid} /></p></div>
          <p className={cn("rounded-xl px-3 py-2 text-xs font-semibold", Math.abs(diffDeclared) < 1 ? "bg-ok-50 text-brand-green-700" : "bg-danger-50 text-danger")}>
            {Math.abs(diffDeclared) < 1 ? "Obra y Contabilidad conciliadas" : diffDeclared < 0 ? `Falta pagar ${money(-diffDeclared)} respecto a lo declarado` : `Contabilidad pagó ${money(diffDeclared)} más de lo declarado`}
          </p>
        </Card>
        <Card className="p-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-ink-muted">Estado de las partidas</p>
          {(["conciliado", "por_conciliar", "revisar", "sin_movimiento"] as Conciliation[]).map((s) => (
            <button key={s} onClick={() => setFilter(filter === s ? "todos" : s)}
              className={cn("mb-1.5 flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition", filter === s ? "bg-navy-900 text-white" : "hover:bg-slate-50")}>
              <span className="flex items-center gap-2"><Badge tone={STATE_TONE[s]}>{CONCILIATION_LABEL[s]}</Badge></span>
              <span className="num font-bold">{counts[s]}</span>
            </button>
          ))}
        </Card>
      </aside>

      <div className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar WBS o subcategoría…"
              className="h-10 w-full rounded-xl border border-line bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10" />
          </div>
          {filter !== "todos" && <button onClick={() => setFilter("todos")} className="h-10 rounded-xl bg-slate-100 px-3 text-xs font-semibold text-ink-soft">Ver todos</button>}
          <ExportMenu build={sheets} meta={{ filename: `conciliacion-${project.code}`, ...meta }} />
        </div>

        {!visible.length && (
          <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-sm text-ink-muted">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-brand-green-600" />No hay partidas con este estado.
          </div>
        )}

        {visible.map((c, ci) => (
          <motion.section key={c.id} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.45, delay: Math.min(ci, 4) * 0.04 }} className="overflow-hidden rounded-2xl border border-line bg-slate-50/60 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-5 py-4">
              <h3 className="font-display text-lg font-semibold text-navy-900">{c.code} · {c.name}</h3>
              <Badge tone={STATE_TONE[c.state]}>{CONCILIATION_LABEL[c.state]}</Badge>
            </div>
            <div className="space-y-4 p-4 sm:p-5">
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                <Metric label="Proyectado" value={c.budget} />
                <Metric label="Declarado Obra" value={c.declared} />
                <Metric label="Pagado Contabilidad" value={c.paid} />
                <Metric label="Saldo" value={c.budget - c.paid} strong />
              </div>
              {c.leaves.map((l) => {
                const d = diffText(l.declared, l.paid);
                return (
                  <div key={l.id} className="rounded-2xl border border-line bg-white p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-display text-[15px] font-semibold text-ink">{l.name}</p>
                        <p className="mt-0.5 text-xs text-ink-muted">{l.code}{l.path ? ` · ${l.path}` : ""} · {l.docs} comprobantes{l.pending > 0 ? ` · ${money(l.pending)} por aprobar` : ""}</p>
                      </div>
                      <Badge tone={STATE_TONE[l.state]}>{CONCILIATION_LABEL[l.state]}</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                      {[["Proyectado", l.budget], ["Declarado por Obra", l.declared], ["Pagado por Contabilidad", l.paid], ["Saldo presupuestal", l.budget - l.paid]].map(([k, v]) => (
                        <div key={k as string}><p className="text-[11px] text-ink-muted">{k}</p><p className={cn("num font-display text-[15px] font-semibold", (v as number) < 0 && "text-danger")}>{money(v)}</p></div>
                      ))}
                    </div>
                    <div className="mt-4 grid gap-4 rounded-xl border border-line-soft bg-slate-50/70 p-3.5 md:grid-cols-2">
                      <BatteryBar value={l.declared} total={l.budget} threshold={project.threshold} label={`Declarado por Obra / Proyectado · ${money(l.declared)}`} />
                      <BatteryBar value={l.paid} total={l.budget} threshold={project.threshold} label={`Pagado por Contabilidad / Proyectado · ${money(l.paid)}`} delay={0.15} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[13px]">
                      <span className="text-ink-soft">Pago contabilizado para la subcategoría: <b className="num text-ink">{money(l.paid)}</b></span>
                      <span className="flex items-center gap-3">
                        <span className={cn("font-semibold", d.cls)}>{d.text}</span>
                        {l.state !== "conciliado" && l.state !== "sin_movimiento" && (
                          <button onClick={() => setDetail({ title: `${l.code} · ${l.name}`, ids: [l.id], declared: l.declared, paid: l.paid })}
                            className="inline-flex items-center gap-1 rounded-lg bg-brand-blue-50 px-2.5 py-1 text-xs font-semibold text-brand-blue hover:bg-brand-blue-100">
                            <FileSearch className="h-3.5 w-3.5" />Ver comprobantes
                          </button>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.section>
        ))}
      </div>
      {detail && <DiffDrawer detail={detail} refx={refx} onClose={() => setDetail(null)} />}
    </div>
  );
}

function DiffDrawer({ detail, refx, onClose }: { detail: { title: string; ids: string[]; declared: number; paid: number }; refx: { company: string; project: string }; onClose: () => void }) {
  const [docs, setDocs] = useState<DiffDoc[] | null>(null);
  useEffect(() => {
    differenceDetailAction(refx, detail.ids).then((r) => (r.ok ? setDocs(r.data ?? []) : (toast.error(r.error), setDocs([]))));
  }, [detail, refx]);
  const notPaid = (docs ?? []).filter((d) => d.gap < 0);
  const notDeclared = (docs ?? []).filter((d) => d.gap > 0);
  const base = `/empresa/${refx.company}/obra/${refx.project}`;
  const List = ({ items, tone }: { items: DiffDoc[]; tone: "amber" | "red" }) => (
    <div className="space-y-2">
      {items.map((d) => (
        <Link key={d.id} href={`${base}/gastos/${d.id}`} className="flex items-start justify-between gap-3 rounded-xl border border-line p-3 transition hover:border-brand-blue/40 hover:bg-brand-blue-50/40">
          <div className="min-w-0">
            <p className="num text-sm font-semibold text-ink">{DOC_TYPE_LABEL[d.doc_type]} {docRef(d)}</p>
            <p className="truncate text-xs text-ink-muted">{d.supplier} · {date(d.issue_date)}</p>
            <p className="truncate text-xs text-ink-soft">{d.description}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5"><Badge tone={EXPENSE_STATUS[d.status]?.tone}>{EXPENSE_STATUS[d.status]?.label}</Badge>{d.origin === "lima" && <Badge tone="navy">Pago central Lima</Badge>}</div>
          </div>
          <div className="shrink-0 text-right">
            <p className={cn("num text-sm font-bold", tone === "red" ? "text-danger" : "text-[#9a5200]")}>{money(Math.abs(d.gap))}</p>
            <p className="num text-[10px] text-ink-muted">costo {money(d.cost)} · pagado {money(d.paidCost)}</p>
          </div>
        </Link>
      ))}
    </div>
  );
  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} title="Comprobantes que explican la diferencia" description={detail.title}>
      <div className="mb-5 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-violet-50 p-3"><p className="text-[11px] text-violet-700">Declarado</p><p className="num text-sm font-bold">{money(detail.declared)}</p></div>
        <div className="rounded-xl bg-ok-50 p-3"><p className="text-[11px] text-brand-green-700">Pagado</p><p className="num text-sm font-bold">{money(detail.paid)}</p></div>
        <div className="rounded-xl bg-danger-50 p-3"><p className="text-[11px] text-danger">Diferencia</p><p className="num text-sm font-bold">{money(detail.paid - detail.declared)}</p></div>
      </div>
      {!docs ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-muted"><LoaderCircle className="h-5 w-5 animate-spin" />Analizando comprobantes…</div>
      ) : (
        <div className="space-y-6">
          <section>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink"><Scale className="h-4 w-4 text-warn" />Declarados por la obra y aún no pagados ({notPaid.length})</p>
            {notPaid.length ? <List items={notPaid} tone="amber" /> : <p className="text-xs text-ink-muted">Ninguno.</p>}
            {notPaid.length > 0 && <p className="mt-2 text-xs text-ink-muted">Total por pagar: <b className="num">{money(-notPaid.reduce((s, d) => s + d.gap, 0))}</b> · {pct(detail.declared ? -notPaid.reduce((s, d) => s + d.gap, 0) / detail.declared : 0)} de lo declarado</p>}
          </section>
          <section>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink"><Landmark className="h-4 w-4 text-danger" />Pagados por Contabilidad sin declaración de obra ({notDeclared.length})</p>
            {notDeclared.length ? <List items={notDeclared} tone="red" /> : <p className="text-xs text-ink-muted">Ninguno.</p>}
          </section>
          <Link href={`${base}/pagos`} className="flex items-center justify-center gap-2 rounded-xl bg-navy-900 py-3 text-sm font-semibold text-white">Ir a la bandeja de pagos <ArrowRight className="h-4 w-4" /></Link>
        </div>
      )}
    </Drawer>
  );
}
