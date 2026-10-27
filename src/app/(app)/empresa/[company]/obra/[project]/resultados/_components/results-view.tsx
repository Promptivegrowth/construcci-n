"use client";
import { CalendarDays, Info } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Bar3DChart, PeriodBars } from "@/components/charts";
import { Panel } from "@/components/ui/cont-kit";
import { ExportMenu } from "@/components/ui/export-menu";
import { useUrlFilters } from "@/components/ui/filters";
import { cn } from "@/components/ui/primitives";
import type { ExportSheet } from "@/lib/export/types";
import { money, monthLabel, monthLong, pct } from "@/lib/format";

export type MonthResult = { month: string; ventas: number; directo: number; bruta: number; gg: number; uai: number; impuesto: number; neta: number };
export type IgvMonth = {
  month: string; ventasBase: number; ventasIgv: number; comprasBase: number; comprasIgv: number; noGravadas: number;
  resultante: number; anterior: number; porPagar: number; credito: number;
};
type Meta = { filename: string; company: string; project: string; user: string };
const TAX = 0.295;

function Statement({ r, title }: { r: Omit<MonthResult, "month">; title: string }) {
  const lines: { label: string; value: number; strong?: boolean; minus?: boolean; tone?: string }[] = [
    { label: "Ventas (valorizado aprobado)", value: r.ventas, strong: true },
    { label: "( − ) Costo directo", value: r.directo, minus: true },
    { label: "Utilidad bruta", value: r.bruta, strong: true },
    { label: "( − ) Gastos generales y administración", value: r.gg, minus: true },
    { label: "Utilidad antes de impuestos", value: r.uai, strong: true },
    { label: "( − ) Impuesto a la renta 29.5% (estimado)", value: r.impuesto, minus: true },
    { label: "Utilidad neta", value: r.neta, strong: true, tone: "final" },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      <div className="flex items-center justify-between bg-navy-900 px-4 py-2.5 text-white">
        <p className="text-sm font-semibold">{title}</p><p className="text-[11px] text-white/60">% sobre ventas</p>
      </div>
      {lines.map((l) => (
        <div key={l.label} className={cn("flex items-center justify-between gap-3 border-t border-line-soft px-4 py-2.5 text-sm",
          l.strong && "bg-slate-50 font-semibold", l.tone === "final" && (l.value >= 0 ? "bg-ok-50 text-brand-green-700" : "bg-danger-50 text-danger"))}>
          <span className={cn(l.minus && "pl-3 text-ink-soft")}>{l.label}</span>
          <span className="flex items-center gap-4">
            <span className={cn("num whitespace-nowrap", l.value < 0 && "text-danger")}>{l.minus ? `(${money(l.value)})` : money(l.value)}</span>
            <span className="num w-14 text-right text-xs text-ink-muted">{r.ventas ? pct(l.value / r.ventas) : "—"}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

export function ResultsView({ rows, igv, selected, companyName, meta }: { rows: MonthResult[]; igv: IgvMonth[]; selected: string; companyName: string; meta: Meta }) {
  const { set } = useUrlFilters();
  const chartRef = useRef<HTMLDivElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"acum" | "mes">("acum");
  const acc = useMemo(() => {
    const a = rows.reduce((s, r) => ({ ventas: s.ventas + r.ventas, directo: s.directo + r.directo, gg: s.gg + r.gg }), { ventas: 0, directo: 0, gg: 0 });
    const bruta = a.ventas - a.directo, uai = bruta - a.gg, impuesto = Math.max(0, uai) * TAX;
    return { ...a, bruta, uai, impuesto, neta: uai - impuesto };
  }, [rows]);
  const cur = rows.find((r) => r.month === selected) ?? rows[rows.length - 1];
  const ig = igv.find((r) => r.month === selected) ?? igv[igv.length - 1];
  const required = ig && ig.porPagar > 0 ? (ig.porPagar / 0.18) * 1.18 : 0;

  const sheets = (): ExportSheet[] => [
    {
      name: "Estado de resultados", title: "Estado de resultados de la obra", subtitle: "Por mes y acumulado · montos sin IGV",
      summary: [
        { label: "Ventas", value: money(acc.ventas), tone: "blue" }, { label: "Costo directo", value: money(acc.directo), tone: "amber" },
        { label: "Gastos generales", value: money(acc.gg), tone: "amber" }, { label: "Utilidad neta", value: money(acc.neta), tone: acc.neta >= 0 ? "green" : "red" },
      ],
      columns: [{ key: "mes", header: "Mes", width: 16 }, { key: "ventas", header: "Ventas", type: "money" }, { key: "directo", header: "Costo directo", type: "money" },
        { key: "bruta", header: "Utilidad bruta", type: "money" }, { key: "gg", header: "Gastos generales", type: "money" }, { key: "uai", header: "Utilidad antes imp.", type: "money" },
        { key: "impuesto", header: "Renta 29.5% (est.)", type: "money" }, { key: "neta", header: "Utilidad neta", type: "money" }, { key: "margen", header: "Margen neto", type: "pct" }],
      rows: rows.map((r) => ({ ...r, mes: monthLong(r.month), margen: r.ventas ? r.neta / r.ventas : "" })),
      totals: { ventas: acc.ventas, directo: acc.directo, bruta: acc.bruta, gg: acc.gg, uai: acc.uai, impuesto: acc.impuesto, neta: acc.neta, margen: acc.ventas ? acc.neta / acc.ventas : 0 },
    },
    {
      name: "Liquidación IGV", title: "Liquidación estimada de IGV por mes", subtitle: "IGV de valorizaciones facturadas vs. crédito fiscal de compras",
      columns: [{ key: "mes", header: "Mes", width: 16 }, { key: "ventasBase", header: "Ventas base", type: "money" }, { key: "ventasIgv", header: "IGV ventas", type: "money" },
        { key: "comprasBase", header: "Compras base 18%", type: "money" }, { key: "comprasIgv", header: "IGV compras", type: "money" }, { key: "noGravadas", header: "Compras no gravadas", type: "money" },
        { key: "anterior", header: "Saldo a favor anterior", type: "money" }, { key: "porPagar", header: "IGV por pagar", type: "money" }, { key: "credito", header: "Crédito fiscal", type: "money" }],
      rows: igv.map((r) => ({ ...r, mes: monthLong(r.month) })),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-white/70 p-2.5">
        <div className="inline-flex gap-1 rounded-xl bg-slate-100 p-1">
          {([["acum", "Acumulado"], ["mes", "Mes seleccionado"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} className={cn("h-8 rounded-lg px-3 text-xs font-semibold", mode === k ? "bg-white text-navy-900 shadow-sm" : "text-ink-muted")}>{l}</button>
          ))}
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-1.5 text-xs">
          <CalendarDays className="h-4 w-4 text-brand-blue" />
          <select value={selected} onChange={(e) => { set({ mes: e.target.value }); setMode("mes"); }} className="bg-transparent font-semibold outline-none">
            {rows.map((r) => <option key={r.month} value={r.month}>{monthLong(r.month)}</option>)}
          </select>
        </label>
        <div className="ml-auto"><ExportMenu build={sheets} meta={() => ({ ...meta, charts: [chartRef.current, barsRef.current] })} /></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <Panel title={mode === "acum" ? "Estado de resultados acumulado" : `Estado de resultados · ${monthLong(cur.month)}`} subtitle="Formato simplificado de gestión">
          <Statement r={mode === "acum" ? acc : cur} title={mode === "acum" ? "Desde el inicio de la obra" : monthLong(cur.month)} />
        </Panel>
        <Panel title="Composición del resultado acumulado" subtitle="Ventas, costos y utilidad (sin IGV)">
          <div ref={chartRef} className="bg-white">
            <Bar3DChart height={300}
              categories={[{ label: "Ventas", values: [acc.ventas] }, { label: "Costo directo", values: [acc.directo] }, { label: "Gastos grales.", values: [acc.gg] },
                { label: "Utilidad neta", values: [Math.max(0, acc.neta)], sub: acc.neta < 0 ? `Pérdida ${money(acc.neta)}` : pct(acc.ventas ? acc.neta / acc.ventas : 0) }]}
              series={[{ name: "Acumulado", color: "#035AA6" }]} />
          </div>
        </Panel>
      </div>

      <Panel title="Ventas vs. costo total por mes" subtitle="Clic en un mes para ver su estado de resultados e IGV">
        <div ref={barsRef} className="bg-white">
          <PeriodBars data={rows.map((r) => ({ label: monthLabel(r.month), key: r.month, value: r.ventas, secondary: r.directo + r.gg }))}
            name="Ventas (valorizado)" secondaryName="Costo total" color="#0A9F4C" highlightLast={false} selected={mode === "mes" ? cur.month : null}
            onSelect={(k) => { set({ mes: k }); setMode("mes"); }} height={280} />
        </div>
      </Panel>

      {ig && (
        <Panel title={`Liquidación de impuestos · ${monthLong(ig.month)}`} subtitle={`${companyName} · régimen general · estimación por obra (la declaración la realiza el contador)`}>
          <div className="grid gap-6 2xl:grid-cols-[1.5fr_1fr]">
            <div className="scrollbar-thin overflow-x-auto rounded-2xl border border-line">
              <table className="w-full min-w-[560px] whitespace-nowrap text-sm">
                <thead><tr className="bg-navy-900 text-[11px] uppercase tracking-wide text-white">
                  <th className="px-4 py-2 text-left">Cálculo del impuesto</th><th className="px-3 py-2">Código</th><th className="px-3 py-2 text-right">Base</th><th className="px-3 py-2 text-right">IGV</th><th className="px-4 py-2 text-right">Total</th>
                </tr></thead>
                <tbody>
                  {[
                    ["Ventas 18%", "100", ig.ventasBase, ig.ventasIgv],
                    ["Descuentos", "102", 0, 0],
                    ["Ventas no gravadas", "109", 0, 0],
                  ].map(([l, c, b, i]) => <IgvRow key={c as string} label={l as string} code={c as string} base={b as number} igv={i as number} />)}
                  <IgvRow label="Total ventas" base={ig.ventasBase} igv={ig.ventasIgv} strong />
                  <IgvRow label="Compras nacionales 18%" code="107" base={-ig.comprasBase} igv={-ig.comprasIgv} />
                  <IgvRow label="Compras no gravadas" code="120" base={-ig.noGravadas} igv={0} />
                  <tr className="border-t-2 border-line bg-slate-50 font-semibold"><td className="px-4 py-2.5">Impuesto resultante</td><td /><td /><td className="num px-3 text-right">{money(ig.resultante)}</td><td /></tr>
                  <tr className="border-t border-line-soft"><td className="px-4 py-2.5">Saldo a favor del mes anterior</td><td /><td /><td className="num px-3 text-right">{money(ig.anterior)}</td><td /></tr>
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3">
              <div className={cn("rounded-2xl p-5", ig.porPagar > 0 ? "bg-[linear-gradient(135deg,#b7e4a0,#8fd06c)]" : "bg-cyan-100")}>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">{ig.porPagar > 0 ? "IGV por pagar" : "Crédito fiscal IGV"}</p>
                <p className="num mt-1 font-display text-3xl font-bold text-ink">{money(ig.porPagar > 0 ? ig.porPagar : ig.credito)}</p>
              </div>
              {ig.porPagar > 0 ? (
                <div className="rounded-2xl bg-[#fde9b0] p-5 text-center">
                  <p className="text-sm font-semibold text-ink">Se va a requerir <span className="num text-danger">{money(required)}</span> en compras para no pagar IGV</p>
                  <p className="mt-1 text-[11px] text-ink-soft">Compras gravadas con IGV incluido necesarias para compensar el débito del mes.</p>
                </div>
              ) : (
                <p className="rounded-2xl bg-cyan-50 p-4 text-sm text-cyan-900">El crédito fiscal de <b className="num">{money(ig.credito)}</b> se arrastra al mes siguiente.</p>
              )}
              <p className="flex items-start gap-2 text-[11px] text-ink-muted"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />Plataforma interna sin conexión a SUNAT: cifra referencial para planificar compras y caja.</p>
            </div>
          </div>
        </Panel>
      )}

      <Panel title="Detalle mensual" subtitle="Montos sin IGV" bodyClassName="p-0">
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[900px] whitespace-nowrap text-sm">
            <thead><tr className="bg-slate-50 text-[11px] uppercase tracking-wide text-ink-muted">
              {["Mes", "Ventas", "Costo directo", "Utilidad bruta", "Gastos generales", "Utilidad antes imp.", "Utilidad neta", "Margen"].map((h, i) => <th key={h} className={cn("px-4 py-2.5 font-semibold", i ? "text-right" : "text-left")}>{h}</th>)}
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month} onClick={() => { set({ mes: r.month }); setMode("mes"); }} className={cn("cursor-pointer border-t border-line-soft hover:bg-brand-blue-50/40", r.month === selected && mode === "mes" && "bg-brand-blue-50/60")}>
                  <td className="px-4 py-2.5 font-semibold">{monthLong(r.month)}</td>
                  {[r.ventas, r.directo, r.bruta, r.gg, r.uai, r.neta].map((v, i) => <td key={i} className={cn("num px-4 text-right", v < 0 && "text-danger", i === 5 && "font-semibold")}>{money(v)}</td>)}
                  <td className={cn("num px-4 text-right text-xs font-semibold", r.neta < 0 ? "text-danger" : "text-brand-green-700")}>{r.ventas ? pct(r.neta / r.ventas) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="border-t-2 border-navy-900 bg-brand-blue-50/60 font-semibold text-navy-900">
              <td className="px-4 py-2.5">Acumulado</td>
              {[acc.ventas, acc.directo, acc.bruta, acc.gg, acc.uai, acc.neta].map((v, i) => <td key={i} className={cn("num px-4 text-right", v < 0 && "text-danger")}>{money(v)}</td>)}
              <td className="num px-4 text-right text-xs">{acc.ventas ? pct(acc.neta / acc.ventas) : "—"}</td>
            </tr></tfoot>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function IgvRow({ label, code, base, igv, strong }: { label: string; code?: string; base: number; igv: number; strong?: boolean }) {
  const fmt = (n: number) => (Math.abs(n) < 0.005 ? money(0) : n < 0 ? `(${money(-n)})` : money(n));
  return (
    <tr className={cn("border-t border-line-soft", strong && "bg-slate-50 font-semibold")}>
      <td className="px-4 py-2.5">{label}</td>
      <td className="px-3 text-center text-xs text-ink-muted">{code ?? ""}</td>
      <td className={cn("num px-3 text-right", base < 0 && "text-danger")}>{fmt(base)}</td>
      <td className={cn("num px-3 text-right", igv < 0 && "text-danger")}>{fmt(igv)}</td>
      <td className="num px-4 text-right">{fmt(base + igv)}</td>
    </tr>
  );
}
