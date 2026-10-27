"use client";
import { ArrowLeft, Banknote, ChevronRight, ClipboardList, FileCheck2, FileX2, History, Layers, Receipt, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { PeriodBars } from "@/components/charts";
import { BatteryBar, LevelBadge } from "@/components/ui/battery";
import { DataTable } from "@/components/ui/data-table";
import { ExportMenu } from "@/components/ui/export-menu";
import { CountUp, FadeIn, Stagger, StaggerItem } from "@/components/ui/motion";
import { Badge, Card, CardBody, CardHeader, PageHeader, cn } from "@/components/ui/primitives";
import { COST_TYPE_LABEL, CONCILIATION_LABEL, EXPENSE_STATUS, ORDER_STATUS, conciliation, fortnightLabel, fortnightOf, ratio, CONCILIATION_TONE } from "@/lib/calc";
import { date, dateShort, DOC_TYPE_LABEL, money, monthLabel, pct } from "@/lib/format";
import type { ExportSheet } from "@/lib/export/types";

type Doc = { id: string; seq: number; date: string; due: string | null; doc: string; docType: string; supplier: string; ruc: string; description: string; wbs: string; phase: string; order: string;
  total: number; igv: number; cost: number; paid: number; saldo: number; status: string; origin: string; files: number; split: boolean };
type Props = {
  base: string; meta: { company: string; project: string; user: string };
  node: { id: string; code: string; name: string; level: number; budget: number; margin: number; declared: number; paid: number; committed: number; approved: number; pending: number; cost_type: string | null; phase: string | null; cost_center: string | null };
  ancestors: { id: string; code: string; name: string }[];
  subs: { id: string; code: string; name: string; budget: number; declared: number; paid: number; committed: number; leaves: number }[];
  docs: Doc[];
  payments: { id: string; date: string; amount: number; pct: number; method: string; bank: string | null; op: string | null; doc: string; supplier: string; expenseId: string }[];
  orders: { id: string; number: string; type: string; title: string; amount: number; invoiced: number; paid: number; status: string; supplier: string }[];
  changes: { type: string; amount: number; next: number; reason: string | null; at: string }[];
  threshold: number; elapsed?: number;
};

const STATE_TONE = CONCILIATION_TONE;

export function WbsDetail({ base, meta, node, ancestors, subs, docs, payments, orders, changes, threshold, elapsed }: Props) {
  const [mode, setMode] = useState<"q" | "m">("q");
  const [period, setPeriod] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const state = conciliation(node.declared, node.paid);
  const saldo = node.budget - node.paid;
  const keyOf = (d: string) => (mode === "q" ? fortnightOf(d) : d.slice(0, 7));

  const series = useMemo(() => {
    const map = new Map<string, { paid: number; declared: number }>();
    docs.forEach((d) => {
      const k = keyOf(d.date);
      const cur = map.get(k) ?? { paid: 0, declared: 0 };
      cur.paid += d.paid;
      if (d.origin !== "lima") cur.declared += d.cost;
      map.set(k, cur);
    });
    return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => ({ key: k, label: mode === "q" ? fortnightLabel(k) : monthLabel(k), value: Math.round(v.paid), secondary: Math.round(v.declared) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs, mode]);

  const shown = period ? docs.filter((d) => keyOf(d.date) === period) : docs;
  const declaredNotPaid = docs.filter((d) => d.origin !== "lima" && d.saldo > 0.5).reduce((s, d) => s + d.saldo, 0);
  const paidNotDeclared = docs.filter((d) => d.origin === "lima").reduce((s, d) => s + d.paid, 0);

  const cards = [
    { k: "Proyectado", v: node.budget, c: "text-brand-blue", sub: node.margin ? `Meta ${money(node.budget - node.margin)}` : "Presupuesto aprobado" },
    { k: "Declarado por Obra", v: node.declared, c: "text-violet-700", sub: `${pct(ratio(node.declared, node.budget))} del proyectado` },
    { k: "Pagado por Contabilidad", v: node.paid, c: "text-brand-green-700", sub: `${pct(ratio(node.paid, node.budget))} del proyectado` },
    { k: "Saldo", v: saldo, c: saldo < 0 ? "text-danger" : "text-ink", sub: node.committed ? `Comprometido ${money(node.committed)}` : "Proyectado − pagado" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link href={`${base}/presupuesto`} className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-brand-blue"><ArrowLeft className="h-3.5 w-3.5" />Presupuesto y WBS</Link>
        {ancestors.length > 0 && (
          <p className="mb-1 flex flex-wrap items-center gap-1 text-xs text-ink-muted">
            {ancestors.map((a, i) => (
              <span key={a.id} className="flex items-center gap-1">{i > 0 && <ChevronRight className="h-3 w-3" />}<Link href={`${base}/presupuesto/${a.id}`} className="hover:text-brand-blue">{a.code} · {a.name}</Link></span>
            ))}
          </p>
        )}
        <PageHeader eyebrow={<span className="flex flex-wrap items-center gap-2">{node.code}{node.cost_center && <Badge tone="navy" dot={false}>CC {node.cost_center}</Badge>}{node.phase && <Badge tone="blue">{node.phase}</Badge>}{node.cost_type && <Badge tone="gray">{COST_TYPE_LABEL[node.cost_type]}</Badge>}</span>}
          title={node.name}
          description={`${docs.length} comprobantes · ${payments.length} pagos registrados · ${orders.length} órdenes vinculadas`}
          actions={<ExportMenu label="Reporte del WBS"
            meta={() => ({ filename: `WBS_${node.code}`, ...meta, charts: [chartRef.current] })}
            build={(): ExportSheet[] => [{
              name: "Comprobantes", title: `Reporte por WBS · ${node.code}`, subtitle: `${node.name}${period ? ` · periodo ${period}` : ""}`,
              summary: [
                { label: "Proyectado", value: money(node.budget), tone: "blue" }, { label: "Declarado", value: money(node.declared), tone: "navy" },
                { label: "Pagado", value: money(node.paid), tone: "green" }, { label: "Saldo", value: money(saldo), tone: saldo < 0 ? "red" : "navy" },
                { label: "Conciliación", value: CONCILIATION_LABEL[state], tone: state === "sin_movimiento" ? undefined : CONCILIATION_TONE[state] },
              ],
              columns: [
                { key: "date", header: "Fecha", type: "date" }, { key: "docLabel", header: "Comprobante", width: 22 }, { key: "supplier", header: "Proveedor", width: 32 }, { key: "ruc", header: "RUC/DNI", width: 13 },
                { key: "description", header: "Descripción", width: 36 }, { key: "wbs", header: "WBS", width: 14 }, { key: "phase", header: "Fase", width: 6 }, { key: "order", header: "O/S-O/C", width: 10 },
                { key: "total", header: "Monto c/IGV", type: "money" }, { key: "cost", header: "Costo cargado", type: "money" }, { key: "paid", header: "Pagado", type: "money" }, { key: "saldo", header: "Saldo", type: "money" }, { key: "estado", header: "Estado", width: 14 },
              ],
              rows: shown.map((d) => ({ ...d, docLabel: `${DOC_TYPE_LABEL[d.docType]} ${d.doc}`, estado: EXPENSE_STATUS[d.status]?.label })),
              totals: { total: shown.reduce((s, d) => s + d.total, 0), cost: shown.reduce((s, d) => s + d.cost, 0), paid: shown.reduce((s, d) => s + d.paid, 0), saldo: shown.reduce((s, d) => s + d.saldo, 0) },
            }, {
              name: "Pagos", title: `Pagos · ${node.code}`, subtitle: node.name,
              columns: [{ key: "date", header: "Fecha", type: "date" }, { key: "doc", header: "Comprobante", width: 18 }, { key: "supplier", header: "Proveedor", width: 32 }, { key: "method", header: "Medio", width: 14 }, { key: "bank", header: "Banco", width: 12 }, { key: "op", header: "N° operación", width: 14 }, { key: "pct", header: "%", type: "number" }, { key: "amount", header: "Monto", type: "money" }],
              rows: payments, totals: { amount: payments.reduce((s, x) => s + x.amount, 0) },
            }]} />}
        />
      </div>

      <Stagger className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map((c) => (
          <StaggerItem key={c.k}>
            <Card className="h-full p-4">
              <p className="text-xs font-semibold text-ink-soft">{c.k}</p>
              <p className={cn("mt-1 font-display text-xl font-semibold sm:text-2xl", c.c)}><CountUp value={c.v} /></p>
              <p className="mt-0.5 text-[11px] text-ink-muted">{c.sub}</p>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>

      <FadeIn>
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2"><LevelBadge ratio={ratio(node.paid, node.budget)} threshold={threshold} /><Badge tone={STATE_TONE[state]}>{CONCILIATION_LABEL[state]}</Badge></div>
            {elapsed !== undefined && <p className="text-xs text-ink-muted">Marca azul marino = {pct(elapsed, 0)} del plazo transcurrido · línea ámbar = umbral {pct(threshold, 0)}</p>}
          </div>
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            <BatteryBar value={node.declared} total={node.budget} threshold={threshold} elapsed={elapsed} size="lg" label={`Declarado por Obra / Proyectado · ${money(node.declared)}`} />
            <BatteryBar value={node.paid} total={node.budget} threshold={threshold} elapsed={elapsed} size="lg" label={`Pagado por Contabilidad / Proyectado · ${money(node.paid)}`} delay={0.15} />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-3 text-[12.5px]">
            <span className="text-ink-soft">Pago contabilizado para todo el centro de costo: <b className="num text-ink">{money(node.paid)}</b></span>
            {state === "conciliado" ? <span className="font-semibold text-brand-green-700">Declarado y pagado coinciden</span>
              : state === "por_conciliar" ? <span className="font-semibold text-danger">Diferencia: {money(node.declared - node.paid)} · Falta pagar respecto a lo declarado</span>
              : state === "revisar" ? <span className="font-semibold text-[#9a5200]">Diferencia: {money(node.paid - node.declared)} · Pagado por Lima sin declarar por obra</span>
              : <span className="text-ink-muted">Sin movimientos</span>}
          </div>
          {(declaredNotPaid > 0.5 || paidNotDeclared > 0.5) && (
            <p className="mt-2 text-[11.5px] text-ink-muted">Explicación: {declaredNotPaid > 0.5 && <>comprobantes declarados pendientes de pago por {money(declaredNotPaid)}</>}{declaredNotPaid > 0.5 && paidNotDeclared > 0.5 && " · "}{paidNotDeclared > 0.5 && <>pagos centrales registrados solo en Lima por {money(paidNotDeclared)}</>}.</p>
          )}
        </Card>
      </FadeIn>

      {subs.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">Subcategorías</h2>
          <Stagger className="grid gap-4 lg:grid-cols-2">
            {subs.map((c) => {
              const st = conciliation(c.declared, c.paid);
              return (
                <StaggerItem key={c.id}>
                  <Link href={`${base}/presupuesto/${c.id}`} className="block h-full">
                    <Card className="h-full p-5 transition hover:border-brand-blue/30 hover:shadow-pop">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0"><p className="truncate font-display font-semibold text-ink">{c.name}</p><p className="text-xs text-ink-muted">{c.code}{c.leaves ? ` · ${c.leaves} partidas` : " · detalle de cada subcategoría declarada"}</p></div>
                        <Badge tone={STATE_TONE[st]}>{CONCILIATION_LABEL[st]}</Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                        {[["Proyectado", c.budget], ["Declarado por Obra", c.declared], ["Pagado por Contab.", c.paid], ["Saldo presupuestal", c.budget - c.paid]].map(([k, v]) => (
                          <div key={k as string}><p className="text-ink-muted">{k}</p><p className={cn("num font-semibold", (v as number) < 0 && "text-danger")}>{money(v)}</p></div>
                        ))}
                      </div>
                      <div className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
                        <BatteryBar value={c.declared} total={c.budget} threshold={threshold} size="sm" label="Declarado / Proyectado" />
                        <BatteryBar value={c.paid} total={c.budget} threshold={threshold} size="sm" label="Pagado / Proyectado" />
                      </div>
                    </Card>
                  </Link>
                </StaggerItem>
              );
            })}
          </Stagger>
        </section>
      )}

      <Card>
        <CardHeader title={`Consumo por ${mode === "q" ? "quincena" : "mes"}`} subtitle="Pagado (verde) vs. declarado por obra (azul). Clic en una barra para filtrar los comprobantes." icon={<Layers className="h-4 w-4" />}
          actions={<div className="inline-flex rounded-lg bg-slate-100 p-0.5">
            {(["q", "m"] as const).map((m) => <button key={m} onClick={() => { setMode(m); setPeriod(null); }} className={cn("rounded-md px-2.5 py-1 text-[11px] font-semibold", mode === m ? "bg-white text-navy-900 shadow-sm" : "text-ink-muted")}>{m === "q" ? "Quincenal" : "Mensual"}</button>)}
          </div>} />
        <CardBody>
          <div ref={chartRef} className="bg-white">
            {series.length ? <PeriodBars data={series} height={250} name="Pagado" secondaryName="Declarado" onSelect={(k) => setPeriod(period === k ? null : k)} selected={period} highlightLast={false} />
              : <p className="py-12 text-center text-sm text-ink-muted">Aún no hay consumo registrado en este centro de costo.</p>}
          </div>
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Comprobantes del centro de costo" subtitle="Factura, fase, monto con IGV, orden asociada y pagos parciales" icon={<Receipt className="h-4 w-4" />}
          actions={period && <button onClick={() => setPeriod(null)} className="inline-flex items-center gap-1 rounded-full bg-brand-blue-50 px-3 py-1 text-xs font-semibold text-brand-blue">{mode === "q" ? fortnightLabel(period) : monthLabel(period)} <X className="h-3 w-3" /></button>} />
        <div className="mt-3">
          <DataTable rows={shown as (Doc & Record<string, unknown>)[]} rowHref={(r) => `${base}/gastos/${r.id}`} searchPlaceholder="Proveedor, RUC, número, descripción…"
            exportSheet={{ name: `Comprobantes_${node.code}`, title: `Comprobantes · ${node.code}`, subtitle: node.name }}
            exportMeta={{ filename: `Comprobantes_${node.code}`, ...meta }}
            columns={[
              { key: "date", header: "Fecha", type: "date", value: (r) => r.date, cell: (r) => <span className="whitespace-nowrap text-xs">{dateShort(r.date)}</span> },
              { key: "doc", header: "Comprobante", value: (r) => `${DOC_TYPE_LABEL[r.docType]} ${r.doc}`, cell: (r) => (
                <span className="flex items-center gap-1.5">
                  {r.files ? <FileCheck2 className="h-4 w-4 shrink-0 text-brand-green-600" aria-label="Con sustento" /> : <FileX2 className="h-4 w-4 shrink-0 text-ink-muted/50" aria-label="Sin sustento digital" />}
                  <span><span className="block text-[13px] font-semibold">{r.doc}</span><span className="text-[11px] text-ink-muted">{DOC_TYPE_LABEL[r.docType]}{r.order ? ` · ${r.order}` : ""}{r.split ? " · distribuido" : ""}</span></span>
                </span>) },
              { key: "supplier", header: "Proveedor", value: (r) => `${r.supplier} ${r.ruc}`, cell: (r) => <span className="block max-w-[220px]"><span className="block truncate text-[13px]">{r.supplier}</span><span className="block truncate text-[11px] text-ink-muted">{r.description}</span></span> },
              { key: "phase", header: "Fase", value: (r) => r.phase, hideSm: true },
              { key: "total", header: "Monto c/IGV", type: "money", value: (r) => r.total, hideSm: true },
              { key: "cost", header: "Costo", type: "money", value: (r) => r.cost, total: true },
              { key: "paid", header: "Pagado", type: "money", value: (r) => r.paid, total: true },
              { key: "status", header: "Estado", value: (r) => EXPENSE_STATUS[r.status]?.label, cell: (r) => (
                <span className="flex flex-col items-start gap-0.5"><Badge tone={EXPENSE_STATUS[r.status]?.tone}>{EXPENSE_STATUS[r.status]?.label}</Badge>{r.origin === "lima" && <span className="text-[10px] font-semibold text-[#9a5200]">Pago central Lima</span>}</span>) },
            ]} />
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader title="Pagos / amortizaciones" subtitle="Registrados por Contabilidad" icon={<Banknote className="h-4 w-4" />} />
          <div className="mt-3">
            <DataTable rows={payments as (Props["payments"][number] & Record<string, unknown>)[]} pageSize={8} searchable={false} rowHref={(r) => `${base}/gastos/${r.expenseId}`}
              columns={[
                { key: "date", header: "Fecha", type: "date", value: (r) => r.date, cell: (r) => <span className="text-xs">{date(r.date)}</span> },
                { key: "doc", header: "Comprobante", value: (r) => r.doc, cell: (r) => <span><span className="block text-[13px] font-semibold">{r.doc}</span><span className="block max-w-[180px] truncate text-[11px] text-ink-muted">{r.supplier}</span></span> },
                { key: "method", header: "Medio", value: (r) => `${r.method} ${r.bank ?? ""}`, cell: (r) => <span className="text-xs capitalize">{r.method} · {r.bank}<span className="block text-[10.5px] text-ink-muted">Op. {r.op}</span></span>, hideSm: true },
                { key: "pct", header: "%", value: (r) => r.pct, cell: (r) => <span className="text-xs">{r.pct.toFixed(0)}%</span> },
                { key: "amount", header: "Monto", type: "money", value: (r) => r.amount, total: true },
              ]} />
          </div>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Órdenes vinculadas" subtitle="Monto global proyectado que se va consumiendo con cada factura" icon={<ClipboardList className="h-4 w-4" />} />
            <CardBody className="space-y-3">
              {orders.map((o) => (
                <Link key={o.id} href={`${base}/ordenes/${o.id}`} className="block rounded-xl border border-line-soft p-3 transition hover:bg-slate-50">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="truncate text-[13px] font-semibold"><span className="text-brand-blue">{o.number}</span> · {o.title}</p>
                    <Badge tone={ORDER_STATUS[o.status]?.tone}>{ORDER_STATUS[o.status]?.label}</Badge>
                  </div>
                  <BatteryBar value={o.invoiced} total={o.amount} threshold={threshold} size="sm" label={`${o.supplier} · facturado ${money(o.invoiced)} de ${money(o.amount)}`} />
                </Link>
              ))}
              {!orders.length && <p className="py-4 text-center text-sm text-ink-muted">Sin órdenes de servicio o compra en este centro de costo.</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Historial del presupuesto" icon={<History className="h-4 w-4" />} />
            <CardBody className="space-y-3">
              {changes.map((c, i) => (
                <div key={i} className="relative border-l-2 border-line pl-4">
                  <span className={cn("absolute -left-[5px] top-1 h-2 w-2 rounded-full", c.amount < 0 ? "bg-danger-500" : c.type === "importacion" ? "bg-brand-blue" : "bg-brand-green-600")} />
                  <p className="text-[13px] font-semibold capitalize">{c.type} · <span className={c.amount < 0 ? "text-danger" : "text-ink"}>{money(c.amount)}</span></p>
                  <p className="text-xs text-ink-muted">{c.reason}</p>
                  <p className="text-[10.5px] text-ink-muted">{date(c.at)} · nuevo presupuesto {money(c.next)}</p>
                </div>
              ))}
              {!changes.length && <p className="text-sm text-ink-muted">Sin cambios registrados.</p>}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
