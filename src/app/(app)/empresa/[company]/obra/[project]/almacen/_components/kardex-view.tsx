"use client";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, Coins, PackageCheck, PackageX, TrendingUp } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { DonutChart, PeriodBars, SERIES } from "@/components/charts";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Drawer } from "@/components/ui/dialog";
import { ExportMenu } from "@/components/ui/export-menu";
import { CountUp, FadeIn, Stagger, StaggerItem } from "@/components/ui/motion";
import { Badge, ButtonLink, Card, CardBody, CardHeader, EmptyState, PageHeader, cn } from "@/components/ui/primitives";
import { date, money, monthLabel, number, pct } from "@/lib/format";
import type { ExportSheet } from "@/lib/export/types";
import type { Movement, StockRow } from "../_lib/data";
import { StockButtons, StockMovementModal, type FormCtx } from "./stock-forms";

const CAT_LABEL: Record<string, string> = { consumibles: "Consumibles", materiales: "Materiales", epp: "EPP", herramientas: "Herramientas", acero: "Acero", madera: "Madera", agregados: "Agregados" };
const LEVEL = {
  ok: { label: "Normal", tone: "green" as const },
  bajo: { label: "Bajo mínimo", tone: "amber" as const },
  critico: { label: "Crítico", tone: "red" as const },
  sin: { label: "Sin movimientos", tone: "gray" as const },
};
const PALETTE = [SERIES.proyectado, SERIES.pagado, SERIES.declarado, SERIES.comprometido, SERIES.extra, "#94A3B8"];

function Kpi({ label, value, sub, icon, tone, format = "money" }: { label: string; value: number; sub?: string; icon: React.ReactNode; tone: string; format?: "money" | "int" }) {
  return (
    <Card className="h-full p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        <span className={cn("grid h-9 w-9 place-items-center rounded-xl", tone)}>{icon}</span>
      </div>
      <p className="mt-2 font-display text-2xl font-semibold text-ink"><CountUp value={value} format={format} /></p>
      {sub && <p className="mt-1 text-[11px] text-ink-muted">{sub}</p>}
    </Card>
  );
}

export function KardexView({ stock, movements, canMove, meta, form }: {
  stock: StockRow[]; movements: Movement[]; canMove: boolean;
  meta: { companyName: string; projectLabel: string; userName: string }; form: FormCtx;
}) {
  const pathname = usePathname();
  const [cat, setCat] = useState("");
  const [open, setOpen] = useState<StockRow | null>(null);
  const [quick, setQuick] = useState<null | "ingreso" | "salida">(null);
  const chartTop = useRef<HTMLDivElement>(null);
  const chartMonth = useRef<HTMLDivElement>(null);
  const chartWbs = useRef<HTMLDivElement>(null);

  const used = stock.filter((s) => s.level !== "sin");
  const rows = used.filter((s) => !cat || s.category === cat);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthIn = movements.filter((m) => m.type === "ingreso" && m.date.startsWith(thisMonth)).reduce((s, m) => s + m.total, 0);
  const monthOut = movements.filter((m) => m.type === "salida" && m.date.startsWith(thisMonth)).reduce((s, m) => s + m.total, 0);
  const value = used.reduce((s, r) => s + Math.max(r.value, 0), 0);
  const critical = used.filter((s) => s.level === "critico" || s.level === "bajo");

  const charts = useMemo(() => {
    const top = [...used].sort((a, b) => b.costIn - a.costIn).slice(0, 6).map((s) => ({ label: s.code, key: s.id, value: s.costIn }));
    const months = new Map<string, { in: number; out: number }>();
    movements.forEach((m) => {
      const k = m.date.slice(0, 7);
      const v = months.get(k) ?? { in: 0, out: 0 };
      if (m.type === "ingreso") v.in += m.total;
      if (m.type === "salida") v.out += m.total;
      months.set(k, v);
    });
    const month = [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-8).map(([k, v]) => ({ label: monthLabel(k), key: k, value: v.out, secondary: v.in }));
    const byWbs = new Map<string, number>();
    movements.filter((m) => m.type === "salida").forEach((m) => byWbs.set(m.wbs ?? "Sin WBS", (byWbs.get(m.wbs ?? "Sin WBS") ?? 0) + m.total));
    const sorted = [...byWbs.entries()].sort((a, b) => b[1] - a[1]);
    const wbs = [...sorted.slice(0, 5), ...(sorted.length > 5 ? [["Otros WBS", sorted.slice(5).reduce((s, [, v]) => s + v, 0)] as [string, number]] : [])]
      .map(([name, v], i) => ({ name: name.split(" · ")[1] ? `${name.split(" · ")[0].replace("WBS-", "")} ${name.split(" · ")[1]}` : name, value: v, color: PALETTE[i] }));
    return { top, month, wbs };
  }, [used, movements]);

  const cols: Column<StockRow & Record<string, unknown>>[] = [
    { key: "code", header: "Código", cell: (r) => <span className="font-mono text-xs font-semibold text-brand-blue">{r.code}</span> },
    { key: "name", header: "Material", className: "min-w-[230px]", cell: (r) => <span className="leading-tight"><span className="block font-semibold text-ink">{r.name}</span><span className="text-[11px] text-ink-muted">{CAT_LABEL[r.category] ?? r.category}</span></span> },
    { key: "stock", header: "Stock", type: "number", value: (r) => r.stock, cell: (r) => <span className={cn("whitespace-nowrap font-semibold", r.level === "critico" ? "text-danger" : r.level === "bajo" ? "text-[#9a5200]" : "text-ink")}>{number(r.stock)} <span className="text-[11px] font-normal text-ink-muted">{r.unit}</span></span> },
    { key: "min_stock", header: "Mínimo", type: "number", hideSm: true, value: (r) => r.min_stock },
    { key: "avg", header: "Costo prom.", type: "money", value: (r) => r.avg },
    { key: "value", header: "Valor stock", type: "money", total: true, value: (r) => Math.max(r.value, 0) },
    { key: "qtyIn", header: "Ingresos", type: "number", hideSm: true, value: (r) => r.qtyIn },
    { key: "qtyOut", header: "Salidas", type: "number", hideSm: true, value: (r) => r.qtyOut },
    { key: "last", header: "Últ. mov.", type: "date", hideSm: true, value: (r) => r.last ?? "", cell: (r) => <span className="text-ink-soft">{date(r.last)}</span> },
    { key: "level", header: "Estado", value: (r) => LEVEL[r.level].label, cell: (r) => <Badge tone={LEVEL[r.level].tone}>{LEVEL[r.level].label}</Badge> },
  ];

  const buildExport = (): ExportSheet[] => [
    {
      name: "Kardex", title: "Kardex valorizado de almacén", subtitle: "Stock, costo promedio y valor por material",
      summary: [
        { label: "Valor del stock", value: money(value), tone: "navy" },
        { label: "Ingresos del mes", value: money(monthIn), tone: "green" },
        { label: "Consumo del mes", value: money(monthOut), tone: "blue" },
        { label: "Stock bajo/crítico", value: `${critical.length} materiales`, tone: critical.length ? "red" : "green" },
      ],
      columns: [
        { key: "code", header: "Código" }, { key: "name", header: "Material", width: 36 }, { key: "unit", header: "Unidad" }, { key: "stock", header: "Stock", type: "number" },
        { key: "min", header: "Mínimo", type: "number" }, { key: "avg", header: "Costo promedio", type: "money" }, { key: "value", header: "Valor", type: "money" },
        { key: "qin", header: "Ingresos", type: "number" }, { key: "qout", header: "Salidas", type: "number" }, { key: "estado", header: "Estado" },
      ],
      rows: rows.map((r) => ({ code: r.code, name: r.name, unit: r.unit, stock: r.stock, min: r.min_stock, avg: r.avg, value: Math.max(r.value, 0), qin: r.qtyIn, qout: r.qtyOut, estado: LEVEL[r.level].label })),
      totals: { value: rows.reduce((s, r) => s + Math.max(r.value, 0), 0) },
    },
    {
      name: "Precios", title: "Precio promedio de compra por material",
      columns: [{ key: "name", header: "Material", width: 36 }, { key: "unit", header: "Unidad" }, { key: "avg", header: "Promedio", type: "money" }, { key: "min", header: "Mínimo", type: "money" }, { key: "max", header: "Máximo", type: "money" }, { key: "last", header: "Último", type: "money" }, { key: "var", header: "Variación", type: "pct" }],
      rows: rows.filter((r) => r.qtyIn > 0).map((r) => ({ name: r.name, unit: r.unit, avg: r.avg, min: r.minPrice, max: r.maxPrice, last: r.lastPrice, var: r.minPrice ? (r.maxPrice - r.minPrice) / r.minPrice : 0 })),
    },
  ];

  const cats = [...new Set(used.map((s) => s.category))];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`${form.projectCode} · Almacén y logística`} title="Kardex valorizado"
        description="Stock por material con costo promedio de compra, valor en almacén y consumo cargado a cada WBS."
        actions={<>
          <ExportMenu build={buildExport} meta={() => ({ filename: `Kardex_${form.projectCode}`, company: meta.companyName, project: meta.projectLabel, user: meta.userName, charts: [chartTop.current, chartMonth.current, chartWbs.current] })} />
          <ButtonLink variant="outline" href={`${pathname}/movimientos`}>Ver movimientos</ButtonLink>
          {canMove && <StockButtons ctx={form} />}
        </>} />

      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StaggerItem><Kpi label="Valor del stock" value={value} sub={`${used.length} materiales con movimiento`} icon={<Boxes className="h-4 w-4" />} tone="bg-navy-900 text-white" /></StaggerItem>
        <StaggerItem><Kpi label="Ingresos del mes" value={monthIn} sub={`${movements.filter((m) => m.type === "ingreso" && m.date.startsWith(thisMonth)).length} guías registradas`} icon={<ArrowDownToLine className="h-4 w-4" />} tone="bg-ok-50 text-brand-green-700" /></StaggerItem>
        <StaggerItem><Kpi label="Consumo del mes" value={monthOut} sub="Salidas valorizadas a costo promedio" icon={<ArrowUpFromLine className="h-4 w-4" />} tone="bg-brand-blue-50 text-brand-blue" /></StaggerItem>
        <StaggerItem><Kpi label="Stock bajo o crítico" value={critical.length} format="int" sub={critical.slice(0, 2).map((c) => c.name.split(" ").slice(0, 3).join(" ")).join(" · ") || "Todo en orden"} icon={critical.length ? <PackageX className="h-4 w-4" /> : <PackageCheck className="h-4 w-4" />} tone={critical.length ? "bg-danger-50 text-danger" : "bg-ok-50 text-brand-green-700"} /></StaggerItem>
      </Stagger>

      {!used.length ? (
        <EmptyState icon={<Boxes className="h-6 w-6" />} title="Aún no hay movimientos de almacén" description="Registra el primer ingreso de materiales para iniciar el kardex de esta obra."
          action={canMove ? <div className="flex gap-2"><StockButtons ctx={form} /></div> : undefined} />
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-5">
            <FadeIn className="xl:col-span-3">
              <Card className="h-full">
                <CardHeader title="Consumo por mes" subtitle="Salidas valorizadas vs. ingresos (compras) por mes" icon={<TrendingUp className="h-4 w-4" />} />
                <CardBody><div ref={chartMonth} className="bg-white"><PeriodBars data={charts.month} color={SERIES.pagado} name="Consumo (salidas)" secondaryName="Ingresos (compras)" />
                  <div className="mt-2 flex justify-center gap-4 text-[11px] font-medium text-ink-soft"><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand-blue" />Ingresos (compras)</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand-green-600" />Consumo (salidas)</span></div></div></CardBody>
              </Card>
            </FadeIn>
            <FadeIn delay={0.06} className="xl:col-span-2">
              <Card className="h-full">
                <CardHeader title="Consumo por WBS" subtitle="¿A qué código de control se cargó el material?" />
                <CardBody><div ref={chartWbs} className="bg-white"><DonutChart data={charts.wbs} centerLabel="Consumido" height={200} /></div></CardBody>
              </Card>
            </FadeIn>
          </div>

          <div className="grid gap-4 xl:grid-cols-5">
            <FadeIn className="xl:col-span-2">
              <Card className="h-full">
                <CardHeader title="Top materiales por costo" subtitle="Compras acumuladas en la obra" icon={<Coins className="h-4 w-4" />} />
                <CardBody><div ref={chartTop} className="bg-white"><PeriodBars data={charts.top} color={SERIES.proyectado} name="Compras" highlightLast={false} height={260} /></div></CardBody>
              </Card>
            </FadeIn>
            <FadeIn delay={0.06} className="xl:col-span-3">
              <Card className="h-full">
                <CardHeader title="Precio promedio de compra" subtitle="Promedio ponderado, rango y último precio pagado" />
                <CardBody className="pt-3">
                  <div className="scrollbar-thin max-h-[300px] overflow-auto">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead className="sticky top-0 bg-white"><tr className="text-[11px] uppercase tracking-wide text-ink-muted"><th className="py-2 text-left">Material</th><th className="py-2 text-right">Promedio</th><th className="py-2 text-right">Rango</th><th className="py-2 text-right">Último</th><th className="py-2 text-right">Variación</th></tr></thead>
                      <tbody>
                        {[...used].filter((r) => r.qtyIn > 0).sort((a, b) => b.costIn - a.costIn).map((r) => {
                          const v = r.minPrice ? (r.lastPrice - r.avg) / r.avg : 0;
                          return (
                            <tr key={r.id} className="cursor-pointer border-t border-line-soft hover:bg-slate-50" onClick={() => setOpen(r)}>
                              <td className="py-2.5"><span className="font-medium text-ink">{r.name}</span> <span className="text-[11px] text-ink-muted">/ {r.unit}</span></td>
                              <td className="num py-2.5 text-right font-semibold">{money(r.avg)}</td>
                              <td className="num py-2.5 text-right text-ink-muted">{money(r.minPrice)} – {money(r.maxPrice)}</td>
                              <td className="num py-2.5 text-right">{money(r.lastPrice)}</td>
                              <td className={cn("num py-2.5 text-right font-semibold", v > 0.02 ? "text-danger" : v < -0.02 ? "text-brand-green-700" : "text-ink-muted")}>{v > 0 ? "▲" : v < 0 ? "▼" : ""} {pct(Math.abs(v))}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardBody>
              </Card>
            </FadeIn>
          </div>

          {critical.length > 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-warn/20 bg-warn-50 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warn" />
              <div className="text-sm">
                <p className="font-semibold text-[#9a5200]">{critical.length} materiales bajo el stock mínimo</p>
                <p className="mt-0.5 text-ink-soft">{critical.slice(0, 8).map((c) => `${c.name} (${number(c.stock)} ${c.unit})`).join(" · ")}{critical.length > 8 ? ` y ${critical.length - 8} más.` : ""}</p>
              </div>
            </div>
          )}

          <Card>
            <CardHeader title="Stock por material" subtitle="Haz clic en un material para ver su kardex movimiento a movimiento"
              actions={<div className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
                {["", ...cats].map((c) => <button key={c || "all"} onClick={() => setCat(c)} className={cn("h-7 rounded-lg px-2.5 text-[11px] font-semibold", cat === c ? "bg-white text-navy-900 shadow-sm" : "text-ink-muted")}>{c ? CAT_LABEL[c] ?? c : "Todos"}</button>)}
              </div>} />
            <div className="mt-3">
              <DataTable rows={rows as (StockRow & Record<string, unknown>)[]} columns={cols} onRowClick={(r) => setOpen(r)} pageSize={15} dense
                searchPlaceholder="Buscar material o código…" initialSort={{ key: "value", dir: "desc" }}
                exportSheet={{ name: "Stock", title: "Stock por material" }} exportMeta={{ filename: `Stock_${form.projectCode}`, company: meta.companyName, project: meta.projectLabel, user: meta.userName }} />
            </div>
          </Card>
        </>
      )}

      <KardexDrawer row={open} movements={movements} onClose={() => setOpen(null)} canMove={canMove} onMove={(k) => setQuick(k)} />
      {quick && open && <StockMovementModal open onOpenChange={(o) => !o && setQuick(null)} kind={quick} ctx={form} materialId={open.id} />}
    </div>
  );
}

function KardexDrawer({ row, movements, onClose, canMove, onMove }: { row: StockRow | null; movements: Movement[]; onClose: () => void; canMove: boolean; onMove: (k: "ingreso" | "salida") => void }) {
  const lines = useMemo(() => {
    if (!row) return [];
    let qty = 0, val = 0;
    return movements.filter((m) => m.material_id === row.id).map((m) => {
      const sign = m.type === "salida" ? -1 : 1;
      qty += sign * m.qty;
      val += sign * m.total;
      return { ...m, balQty: qty, balVal: val };
    }).reverse();
  }, [row, movements]);
  const pathname = usePathname();
  return (
    <Drawer open={!!row} onOpenChange={(o) => !o && onClose()} width="max-w-3xl"
      title={row ? <span>{row.name} <span className="font-mono text-sm text-brand-blue">{row.code}</span></span> : ""}
      description={row ? `Kardex valorizado · unidad: ${row.unit} · costo promedio ${money(row.avg)}` : undefined}
      footer={row && <>
        <ButtonLink variant="ghost" href={`${pathname}/movimientos?material=${row.id}`}>Ver en movimientos</ButtonLink>
        {canMove && <><button onClick={() => onMove("salida")} className="h-10 rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white">Salida</button>
          <button onClick={() => onMove("ingreso")} className="h-10 rounded-xl bg-brand-green-600 px-4 text-sm font-semibold text-white">Ingreso</button></>}
      </>}>
      {row && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["Stock", `${number(row.stock)} ${row.unit}`], ["Valor", money(Math.max(row.value, 0))], ["Ingresó", `${number(row.qtyIn)} ${row.unit}`], ["Salió", `${number(row.qtyOut)} ${row.unit}`]].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-ink-muted">{l}</p><p className="num font-display font-semibold text-ink">{v}</p></div>
            ))}
          </div>
          <div className="scrollbar-thin overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[620px] text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-ink-muted">
                <tr><th className="px-3 py-2 text-left">Fecha</th><th className="px-3 py-2 text-left">Movimiento</th><th className="px-3 py-2 text-right">Cantidad</th><th className="px-3 py-2 text-right">C. unit.</th><th className="px-3 py-2 text-right">Importe</th><th className="px-3 py-2 text-right">Saldo</th><th className="px-3 py-2 text-right">Valor</th></tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-t border-line-soft">
                    <td className="whitespace-nowrap px-3 py-2 text-ink-soft">{date(l.date)}</td>
                    <td className="px-3 py-2">
                      <span className={cn("font-semibold", l.type === "salida" ? "text-[#9a5200]" : "text-brand-green-700")}>{l.type === "salida" ? "Salida" : l.type === "ingreso" ? "Ingreso" : l.type}</span>
                      <span className="block max-w-[220px] truncate text-[11px] text-ink-muted">{l.type === "salida" ? `${l.wbs?.split(" · ")[0] ?? ""} · ${l.front ?? ""} · ${l.responsible ?? ""}` : `${l.supplier ?? ""} · ${l.document_ref ?? ""}`}</span>
                    </td>
                    <td className={cn("num px-3 py-2 text-right font-semibold", l.type === "salida" ? "text-[#9a5200]" : "text-brand-green-700")}>{l.type === "salida" ? "−" : "+"}{number(l.qty)}</td>
                    <td className="num px-3 py-2 text-right">{money(l.unit_cost)}</td>
                    <td className="num px-3 py-2 text-right">{money(l.total)}</td>
                    <td className="num px-3 py-2 text-right font-semibold text-ink">{number(l.balQty)}</td>
                    <td className="num px-3 py-2 text-right text-ink-soft">{money(Math.max(l.balVal, 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Drawer>
  );
}
