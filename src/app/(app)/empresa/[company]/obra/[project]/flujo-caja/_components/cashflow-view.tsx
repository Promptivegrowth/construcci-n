"use client";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Landmark } from "lucide-react";
import { useRef, useState } from "react";
import { CashFlowChart } from "@/components/charts";
import { Panel } from "@/components/ui/cont-kit";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ExportMenu } from "@/components/ui/export-menu";
import { Card, cn } from "@/components/ui/primitives";
import type { ExportSheet } from "@/lib/export/types";
import { date, money } from "@/lib/format";

export type FlowPeriod = { key: string; label: string; ingresos: number; egresos: number; neto: number; saldo: number };
export type ValuationBlock = { date: string; number: number | null; invoice: string | null; ingreso: number; items: { label: string; amount: number }[]; egresos: number; saldo: number; from: string | null };
type Meta = { filename: string; company: string; project: string; user: string };

export function CashFlowView({ periods, blocks, vista, meta }: { periods: FlowPeriod[]; blocks: ValuationBlock[]; vista: string; meta: Meta }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [showAll, setShowAll] = useState(false);
  const chartData = vista === "semana" ? periods.slice(-26) : periods;
  const shownBlocks = showAll ? [...blocks].reverse() : [...blocks].reverse().slice(0, 6);

  const columns: Column<FlowPeriod>[] = [
    { key: "label", header: vista === "semana" ? "Semana (desde lunes)" : "Mes", value: (r) => r.key, cell: (r) => <span className="font-semibold">{r.label}</span> },
    { key: "ingresos", header: "Ingresos", type: "money", total: true, className: "whitespace-nowrap text-brand-green-700" },
    { key: "egresos", header: "Egresos", type: "money", total: true, className: "whitespace-nowrap" },
    { key: "neto", header: "Neto del periodo", type: "money", total: true, className: "whitespace-nowrap", cell: (r) => <span className={cn("num font-semibold", r.neto < 0 ? "text-danger" : "text-brand-green-700")}>{money(r.neto)}</span> },
    { key: "saldo", header: "Saldo acumulado", type: "money", className: "whitespace-nowrap", cell: (r) => <span className={cn("num font-bold", r.saldo < 0 ? "text-danger" : "text-navy-900")}>{money(r.saldo)}</span> },
  ];

  const sheets = (): ExportSheet[] => [
    {
      name: "Flujo de caja", title: `Flujo de caja ${vista === "semana" ? "semanal" : "mensual"}`, subtitle: "Ingresos por valorizaciones vs. egresos pagados",
      summary: [
        { label: "Ingresos", value: money(periods.reduce((s, p) => s + p.ingresos, 0)), tone: "green" },
        { label: "Egresos", value: money(periods.reduce((s, p) => s + p.egresos, 0)), tone: "amber" },
        { label: "Saldo en cuenta", value: money(periods.at(-1)?.saldo ?? 0), tone: "navy" },
      ],
      columns: [{ key: "label", header: vista === "semana" ? "Semana" : "Mes", width: 16 }, { key: "ingresos", header: "Ingresos", type: "money" }, { key: "egresos", header: "Egresos", type: "money" },
        { key: "neto", header: "Neto", type: "money" }, { key: "saldo", header: "Saldo acumulado", type: "money" }],
      rows: periods,
      totals: { ingresos: periods.reduce((s, p) => s + p.ingresos, 0), egresos: periods.reduce((s, p) => s + p.egresos, 0), neto: periods.reduce((s, p) => s + p.neto, 0) },
    },
    {
      name: "Por valorización", title: "Flujo por valorización", subtitle: "Ingreso por pago de valorización, egresos del periodo y saldo en cuenta",
      columns: [{ key: "fecha", header: "Fecha", type: "date" }, { key: "concepto", header: "Concepto", width: 44 }, { key: "ingreso", header: "Ingreso", type: "money" }, { key: "egreso", header: "Egreso", type: "money" }, { key: "saldo", header: "Saldo en cuenta", type: "money" }],
      rows: blocks.flatMap((b) => [
        { fecha: b.date, concepto: `PAGO DE VALORIZACIÓN N° ${b.number ?? "—"}${b.invoice ? ` (${b.invoice})` : ""}`, ingreso: b.ingreso, egreso: "", saldo: "" },
        ...b.items.map((it) => ({ fecha: "", concepto: `   ${it.label}`, ingreso: "", egreso: it.amount, saldo: "" })),
        { fecha: "", concepto: "SALDO EN CUENTA", ingreso: "", egreso: b.egresos, saldo: b.saldo },
      ]),
    },
  ];

  return (
    <div className="space-y-6">
      <Panel title={`Ingresos vs. egresos ${vista === "semana" ? "· últimas 26 semanas" : "por mes"}`} subtitle="Barras: cobros y pagos del periodo · línea: saldo acumulado en cuenta"
        actions={<ExportMenu build={sheets} meta={() => ({ ...meta, charts: [chartRef.current] })} />}>
        <div ref={chartRef} className="bg-white">
          {chartData.length ? <CashFlowChart data={chartData} height={320} /> : <p className="py-20 text-center text-sm text-ink-muted">Sin movimientos de caja todavía.</p>}
        </div>
      </Panel>

      <div>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="font-display text-[15px] font-semibold text-ink">Flujo por valorización</h3>
            <p className="text-xs text-ink-muted">Cada abono del cliente y los egresos pagados desde el abono anterior, como en la hoja “DATA”.</p>
          </div>
          {blocks.length > 6 && <button onClick={() => setShowAll(!showAll)} className="text-xs font-semibold text-brand-blue hover:underline">{showAll ? "Ver últimos 6" : `Ver los ${blocks.length}`}</button>}
        </div>
        {blocks.length ? (
          <div className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {shownBlocks.map((b, i) => (
              <motion.div key={`${b.date}-${i}`} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: Math.min(i, 5) * 0.05 }}
                className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
                <div className="bg-ok-50 px-4 py-3">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-green-700"><ArrowDownRight className="h-3.5 w-3.5" />Ingresos · {date(b.date)}</p>
                  <p className="mt-1 text-xs font-semibold text-ink">Pago de valorización N° {b.number ?? "—"}{b.invoice ? ` · ${b.invoice}` : ""}</p>
                  <p className="num font-display text-xl font-semibold text-brand-green-700">{money(b.ingreso)}</p>
                </div>
                <div className="px-4 py-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#9a5200]"><ArrowUpRight className="h-3.5 w-3.5" />Egresos del periodo{b.from ? ` · desde ${date(b.from)}` : ""}</p>
                  <ul className="space-y-1">
                    {b.items.slice(0, 6).map((it) => (
                      <li key={it.label} className="flex items-center justify-between gap-3 text-xs"><span className="truncate text-ink-soft">{it.label}</span><span className="num shrink-0 font-medium">{money(it.amount)}</span></li>
                    ))}
                    {b.items.length > 6 && (
                      <li className="flex items-center justify-between gap-3 text-xs text-ink-muted"><span>Otros ({b.items.length - 6})</span><span className="num">{money(b.items.slice(6).reduce((s, x) => s + x.amount, 0))}</span></li>
                    )}
                    {!b.items.length && <li className="text-xs text-ink-muted">Sin egresos en el periodo.</li>}
                  </ul>
                  <div className="mt-2 flex justify-between border-t border-line-soft pt-2 text-xs font-semibold"><span>Total egresos</span><span className="num">{money(b.egresos)}</span></div>
                </div>
                <div className={cn("flex items-center justify-between px-4 py-3", b.saldo >= 0 ? "bg-navy-900 text-white" : "bg-danger text-white")}>
                  <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em]"><Landmark className="h-3.5 w-3.5" />Saldo en cuenta</span>
                  <span className="num font-display text-lg font-semibold">{money(b.saldo)}</span>
                </div>
              </motion.div>
            ))}
          </div>
        ) : <p className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-sm text-ink-muted">Aún no se registran cobros de valorizaciones.</p>}
      </div>

      <Card>
        <DataTable rows={[...periods].reverse()} columns={columns} pageSize={12} searchable={false}
          exportSheet={{ name: "Flujo de caja", title: `Flujo de caja ${vista === "semana" ? "semanal" : "mensual"}` }} exportMeta={meta} />
      </Card>
    </div>
  );
}
