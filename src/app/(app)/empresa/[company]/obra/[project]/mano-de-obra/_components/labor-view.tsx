"use client";
import { AlertTriangle, CalendarRange, HardHat, Plus, SlidersHorizontal, TrendingDown, TrendingUp, Users, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Bar3DChart, SERIES } from "@/components/charts";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/dialog";
import { ExportMenu } from "@/components/ui/export-menu";
import { DateRangeFilter, FilterBar, UrlSelect } from "@/components/ui/filters";
import { CountUp, FadeIn, Stagger, StaggerItem } from "@/components/ui/motion";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Input, PageHeader, Select, Textarea, cn } from "@/components/ui/primitives";
import { EXPENSE_STATUS, LABOR_LABEL } from "@/lib/calc";
import { date, money, moneyShort, number, pct } from "@/lib/format";
import type { ExportSheet } from "@/lib/export/types";
import { registerPayroll, saveLaborProjections, type PayrollInput } from "../actions";

export type LaborLine = { category: string; workers: number; days: number | null; amount: number };
export type LaborPayroll = {
  id: string; week: number | null; type: string; label: string; start: string | null; end: string | null;
  phase_id: string | null; phase_code: string; wbs: string; total: number; status: string; paid: number; paidRatio: number;
  notes: string | null; lines: LaborLine[];
};
type Phase = { id: string; code: string; name: string; start: string | null; end: string | null };
type Wbs = { id: string; code: string; name: string; phase_id: string | null; cost_type: string | null };

const CATS = ["capataz", "operario", "oficial", "peon"] as const;
type Cat = (typeof CATS)[number];

function Kpi({ label, value, sub, icon, tone = "blue", format = "money" }: { label: string; value: number; sub?: React.ReactNode; icon: React.ReactNode; tone?: "blue" | "green" | "red" | "amber" | "navy"; format?: "money" | "int" | "moneyShort" }) {
  const ring = { blue: "bg-brand-blue-50 text-brand-blue", green: "bg-ok-50 text-brand-green-700", red: "bg-danger-50 text-danger", amber: "bg-warn-50 text-[#9a5200]", navy: "bg-navy-900 text-white" }[tone];
  return (
    <Card className="h-full p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", ring)}>{icon}</span>
      </div>
      <p className={cn("mt-2 font-display text-2xl font-semibold tracking-tight", tone === "red" ? "text-danger" : "text-ink")}><CountUp value={value} format={format} /></p>
      {sub && <p className="mt-1 text-[11px] text-ink-muted">{sub}</p>}
    </Card>
  );
}

export function LaborView(props: {
  companyCode: string; projectCode: string; projectName: string; companyName: string; userName: string; projectStart: string | null;
  payrolls: LaborPayroll[]; projections: { phase_id: string | null; category: string; amount: number; workers: number | null }[];
  phases: Phase[]; wbs: Wbs[]; nextWeek: number; canRegister: boolean; canEditProjection: boolean; isConta: boolean; filtered: boolean;
}) {
  const { payrolls, projections, phases } = props;
  const [cat, setCat] = useState<"" | Cat>("");
  const [openReg, setOpenReg] = useState(false);
  const [openProj, setOpenProj] = useState(false);
  const chartPhase = useRef<HTMLDivElement>(null);
  const chartCat = useRef<HTMLDivElement>(null);

  const obreros = payrolls.filter((p) => p.type === "obreros");
  const staff = payrolls.filter((p) => p.type !== "obreros");

  const calc = useMemo(() => {
    const projByCat = Object.fromEntries(CATS.map((c) => [c, 0])) as Record<Cat, number>;
    const projByPhase: Record<string, number> = {};
    const projMatrix: Record<string, number> = {};
    projections.forEach((p) => {
      const c = p.category as Cat;
      projByCat[c] = (projByCat[c] ?? 0) + p.amount;
      if (p.phase_id) {
        projByPhase[p.phase_id] = (projByPhase[p.phase_id] ?? 0) + p.amount;
        projMatrix[`${p.phase_id}|${c}`] = p.amount;
      }
    });
    const realByCat = Object.fromEntries(CATS.map((c) => [c, 0])) as Record<Cat, number>;
    const paidByCat = Object.fromEntries(CATS.map((c) => [c, 0])) as Record<Cat, number>;
    const realByPhase: Record<string, number> = {};
    const realMatrix: Record<string, number> = {};
    let workersSum = 0;
    obreros.forEach((p) => {
      p.lines.forEach((l) => {
        const c = l.category as Cat;
        if (!CATS.includes(c)) return;
        realByCat[c] += l.amount;
        paidByCat[c] += l.amount * p.paidRatio;
        if (p.phase_id) {
          realByPhase[p.phase_id] = (realByPhase[p.phase_id] ?? 0) + l.amount;
          realMatrix[`${p.phase_id}|${c}`] = (realMatrix[`${p.phase_id}|${c}`] ?? 0) + l.amount;
        }
      });
      workersSum += p.lines.reduce((s, l) => s + l.workers, 0);
    });
    const projTotal = CATS.reduce((s, c) => s + projByCat[c], 0);
    const realTotal = CATS.reduce((s, c) => s + realByCat[c], 0);
    const paidTotal = CATS.reduce((s, c) => s + paidByCat[c], 0);
    return { projByCat, projByPhase, projMatrix, realByCat, paidByCat, realByPhase, realMatrix, projTotal, realTotal, paidTotal, avgWorkers: obreros.length ? workersSum / obreros.length : 0 };
  }, [projections, obreros]);

  const phaseCats = phases.filter((ph) => (calc.projByPhase[ph.id] ?? 0) > 0 || (calc.realByPhase[ph.id] ?? 0) > 0);
  const deficits = CATS.filter((c) => calc.realByCat[c] > calc.projByCat[c] && calc.projByCat[c] > 0);
  const saldo = calc.projTotal - calc.realTotal;
  const staffTotal = staff.reduce((s, p) => s + p.total, 0);

  const catLabel = (c: string) => LABOR_LABEL[c] ?? c;
  const line = (p: LaborPayroll, c: string) => p.lines.find((l) => l.category === c);

  const weekCols: Column<LaborPayroll & Record<string, unknown>>[] = [
    { key: "week", header: "Semana", value: (r) => r.week ?? 0, type: "int", align: "left", cell: (r) => <span className="font-display font-semibold text-ink">S{String(r.week).padStart(2, "0")}</span> },
    { key: "end", header: "Cierre", value: (r) => r.end ?? "", type: "date", cell: (r) => <span className="text-ink-soft">{date(r.end)}</span> },
    { key: "phase_code", header: "Fase", value: (r) => r.phase_code, hideSm: true, cell: (r) => <Badge tone="navy" dot={false}>{r.phase_code}</Badge> },
    ...CATS.filter((c) => !cat || c === cat).map((c) => ({
      key: c, header: catLabel(c), type: "money" as const, total: true, className: "whitespace-nowrap", value: (r: LaborPayroll) => line(r, c)?.amount ?? 0,
      cell: (r: LaborPayroll) => {
        const l = line(r, c);
        return l ? <span className="whitespace-nowrap leading-tight"><span className="block font-semibold text-ink">{money(l.amount)}</span><span className="text-[11px] text-ink-muted">{l.workers} trab.</span></span> : <span className="text-ink-muted">—</span>;
      },
    })),
    { key: "workers", header: "N° trab.", type: "int", hideSm: true, value: (r) => r.lines.reduce((s, l) => s + l.workers, 0) },
    ...(!cat ? [{ key: "total", header: "Total semana", type: "money" as const, total: true, className: "whitespace-nowrap", value: (r: LaborPayroll) => r.total, cell: (r: LaborPayroll) => <span className="font-semibold text-navy-900">{money(r.total)}</span> }] : []),
    { key: "status", header: "Estado de pago", value: (r) => EXPENSE_STATUS[r.status]?.label ?? r.status, cell: (r) => <Badge tone={EXPENSE_STATUS[r.status]?.tone ?? "gray"}>{EXPENSE_STATUS[r.status]?.label ?? r.status}</Badge> },
  ];

  const staffCols: Column<LaborPayroll & Record<string, unknown>>[] = [
    { key: "end", header: "Fecha", type: "date", value: (r) => r.end ?? "", cell: (r) => date(r.end) },
    { key: "label", header: "Concepto", value: (r) => r.label, cell: (r) => <span className="font-medium text-ink">{r.label}</span> },
    { key: "type", header: "Tipo", value: (r) => r.type, cell: (r) => <Badge tone={r.type === "staff" ? "blue" : "violet"}>{{ staff: "Mensual", cts: "CTS", gratificacion: "Gratificación", liquidacion: "Liquidación" }[r.type] ?? r.type}</Badge> },
    { key: "wbs", header: "WBS", value: (r) => r.wbs, hideSm: true },
    { key: "total", header: "Monto", type: "money", total: true, value: (r) => r.total },
    { key: "status", header: "Estado", value: (r) => EXPENSE_STATUS[r.status]?.label ?? r.status, cell: (r) => <Badge tone={EXPENSE_STATUS[r.status]?.tone ?? "gray"}>{EXPENSE_STATUS[r.status]?.label ?? r.status}</Badge> },
  ];

  const meta = { filename: `ManoDeObra_${props.projectCode}`, company: props.companyName, project: `${props.projectCode} · ${props.projectName}`, user: props.userName, charts: [chartPhase.current, chartCat.current] };

  const buildExport = (): ExportSheet[] => [
    {
      name: "Resumen M.O.", title: "Control de mano de obra", subtitle: "Proyectado vs. costo real por categoría y fase",
      summary: [
        { label: "Proyectado M.O.", value: money(calc.projTotal), tone: "blue" as const },
        { label: "Costo registrado", value: money(calc.realTotal), tone: "navy" as const },
        { label: "Pagado", value: money(calc.paidTotal), tone: "green" as const },
        { label: saldo >= 0 ? "Saldo" : "Déficit", value: money(saldo), tone: saldo >= 0 ? ("green" as const) : ("red" as const) },
      ],
      columns: [
        { key: "cat", header: "Categoría" },
        ...phaseCats.flatMap((ph) => [{ key: `${ph.id}p`, header: `${ph.code} proyectado`, type: "money" as const }, { key: `${ph.id}r`, header: `${ph.code} real`, type: "money" as const }]),
        { key: "proj", header: "Total proyectado", type: "money" as const }, { key: "real", header: "Total real", type: "money" as const },
        { key: "saldo", header: "Saldo / déficit", type: "money" as const }, { key: "avance", header: "% consumido", type: "pct" as const },
      ],
      rows: CATS.map((c) => ({
        cat: catLabel(c),
        ...Object.fromEntries(phaseCats.flatMap((ph) => [[`${ph.id}p`, calc.projMatrix[`${ph.id}|${c}`] ?? 0], [`${ph.id}r`, calc.realMatrix[`${ph.id}|${c}`] ?? 0]])),
        proj: calc.projByCat[c], real: calc.realByCat[c], saldo: calc.projByCat[c] - calc.realByCat[c], avance: calc.projByCat[c] ? calc.realByCat[c] / calc.projByCat[c] : 0,
      })),
      totals: { cat: "TOTAL", proj: calc.projTotal, real: calc.realTotal, saldo },
    },
    {
      name: "Planillas semanales", title: "Planillas semanales de obreros", subtitle: "Costo por categoría y semana",
      columns: [{ key: "week", header: "Semana", type: "int" as const }, { key: "end", header: "Cierre", type: "date" as const }, { key: "fase", header: "Fase" },
        ...CATS.flatMap((c) => [{ key: c, header: catLabel(c), type: "money" as const }, { key: `${c}_n`, header: `N° ${catLabel(c).toLowerCase()}`, type: "int" as const }]),
        { key: "total", header: "Total", type: "money" as const }, { key: "estado", header: "Estado" }],
      rows: obreros.map((p) => ({ week: p.week, end: p.end, fase: p.phase_code, total: p.total, estado: EXPENSE_STATUS[p.status]?.label,
        ...Object.fromEntries(CATS.flatMap((c) => [[c, line(p, c)?.amount ?? 0], [`${c}_n`, line(p, c)?.workers ?? 0]])) })),
      totals: { ...Object.fromEntries(CATS.map((c) => [c, calc.realByCat[c]])), total: calc.realTotal },
    },
    {
      name: "Staff", title: "Planilla staff y beneficios", columns: [{ key: "end", header: "Fecha", type: "date" as const }, { key: "label", header: "Concepto" }, { key: "total", header: "Monto", type: "money" as const }, { key: "estado", header: "Estado" }],
      rows: staff.map((p) => ({ end: p.end, label: p.label, total: p.total, estado: EXPENSE_STATUS[p.status]?.label })), totals: { total: staffTotal },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`${props.projectCode} · Mano de obra`} title="Planillas por categoría"
        description="Registro de costo de mano de obra (no cálculo de planilla): proyectado vs. real por categoría y fase, con el estado de pago de cada semana."
        actions={<>
          <ExportMenu build={buildExport} meta={() => ({ ...meta, charts: [chartPhase.current, chartCat.current] })} />
          {props.canEditProjection && <Button variant="outline" onClick={() => setOpenProj(true)}><SlidersHorizontal className="h-4 w-4" />Proyección</Button>}
          {props.canRegister && <Button onClick={() => setOpenReg(true)}><Plus className="h-4 w-4" />Registrar planilla</Button>}
        </>} />

      <FilterBar>
        <DateRangeFilter />
        <UrlSelect name="fase" placeholder="Todas las fases" options={phases.map((p) => ({ value: p.id, label: `${p.code} · ${p.name.split("·")[1]?.trim() ?? p.name}` }))} />
        <div className="ml-auto inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
          {(["", ...CATS] as const).map((c) => (
            <button key={c || "all"} onClick={() => setCat(c)} className={cn("h-8 rounded-lg px-3 text-xs font-semibold transition", cat === c ? "bg-white text-navy-900 shadow-sm" : "text-ink-muted hover:text-ink")}>
              {c ? catLabel(c) : "Todas"}
            </button>
          ))}
        </div>
      </FilterBar>

      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StaggerItem><Kpi label="Proyectado M.O. obreros" value={cat ? calc.projByCat[cat] : calc.projTotal} icon={<HardHat className="h-4 w-4" />} sub="Matriz de distribución por fase" /></StaggerItem>
        <StaggerItem><Kpi label="Costo registrado" value={cat ? calc.realByCat[cat] : calc.realTotal} tone="navy" icon={<Wallet className="h-4 w-4" />}
          sub={`${pct((cat ? calc.realByCat[cat] / (calc.projByCat[cat] || 1) : calc.realTotal / (calc.projTotal || 1)))} del proyectado`} /></StaggerItem>
        <StaggerItem><Kpi label="Pagado por Contabilidad" value={cat ? calc.paidByCat[cat] : calc.paidTotal} tone="green" icon={<TrendingUp className="h-4 w-4" />}
          sub={`Pendiente S/ ${number((cat ? calc.realByCat[cat] - calc.paidByCat[cat] : calc.realTotal - calc.paidTotal), 0)}`} /></StaggerItem>
        <StaggerItem>{(() => {
          const s = cat ? calc.projByCat[cat] - calc.realByCat[cat] : saldo;
          return <Kpi label={s >= 0 ? "Saldo por ejecutar" : "Déficit"} value={Math.abs(s)} tone={s >= 0 ? "green" : "red"} icon={s >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            sub={s >= 0 ? "Proyectado − registrado" : "Se pagó más de lo proyectado"} />;
        })()}</StaggerItem>
        <StaggerItem><Kpi label="Semanas registradas" value={obreros.length} format="int" icon={<CalendarRange className="h-4 w-4" />} tone="amber"
          sub={<><Users className="mr-1 inline h-3 w-3" />{number(calc.avgWorkers, 0)} trabajadores promedio</>} /></StaggerItem>
      </Stagger>

      {!payrolls.length ? (
        <EmptyState icon={<HardHat className="h-6 w-6" />} title={props.filtered ? "Sin planillas en el filtro" : "Aún no hay planillas registradas"}
          description="Registra la planilla semanal de obreros por categoría para comparar contra la proyección." action={props.canRegister ? <Button onClick={() => setOpenReg(true)}><Plus className="h-4 w-4" />Registrar planilla</Button> : undefined} />
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <FadeIn>
              <Card className="h-full">
                <CardHeader title="Control de mano de obra por fase" subtitle="Proyectado costo M.O. · costo real · margen estimado" icon={<HardHat className="h-4 w-4" />} />
                <CardBody>
                  <div ref={chartPhase} className="bg-white">
                    {phaseCats.length ? (
                      <Bar3DChart height={320}
                        series={[{ name: "Proyectado costo M.O.", color: SERIES.proyectado }, { name: "Costo real M.O.", color: SERIES.pagado }, { name: "Margen estimado", color: SERIES.saldo }]}
                        categories={phaseCats.map((ph) => {
                          const pj = calc.projByPhase[ph.id] ?? 0, rl = calc.realByPhase[ph.id] ?? 0;
                          return { label: ph.code === "F1" ? "FASE 1" : ph.code === "F2" ? "FASE 2" : ph.code === "F3" ? "FASE 3" : ph.code === "F4" ? "FASE 4" : ph.code, sub: pj ? pct(rl / pj, 0) : undefined, values: [pj, rl, Math.max(pj - rl, 0)] };
                        })} />
                    ) : <p className="py-16 text-center text-sm text-ink-muted">Define la proyección por fase para comparar.</p>}
                  </div>
                </CardBody>
              </Card>
            </FadeIn>
            <FadeIn delay={0.08}>
              <Card className="h-full">
                <CardHeader title="Control gasto M.O. por categoría" subtitle="Costo proyectado · costo gastado · saldo" icon={<Users className="h-4 w-4" />} />
                <CardBody>
                  <div ref={chartCat} className="bg-white">
                    <Bar3DChart height={320}
                      series={[{ name: "Costo proyectado", color: SERIES.proyectado }, { name: "Costo gastado", color: SERIES.pagado }, { name: "Saldo", color: SERIES.saldo }]}
                      categories={(["operario", "oficial", "peon", "capataz"] as Cat[]).filter((c) => calc.projByCat[c] > 0 || calc.realByCat[c] > 0).map((c) => ({
                        label: catLabel(c).toUpperCase(), sub: calc.projByCat[c] ? pct(calc.realByCat[c] / calc.projByCat[c], 0) : undefined,
                        values: [calc.projByCat[c], calc.realByCat[c], Math.max(calc.projByCat[c] - calc.realByCat[c], 0)],
                      }))} />
                  </div>
                  {deficits.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {deficits.map((c) => (
                        <div key={c} className="flex items-start gap-3 rounded-xl bg-danger-50 p-3 text-sm">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                          <p className="text-ink-soft">
                            <b className="text-danger">{catLabel(c)}: déficit de {money(calc.realByCat[c] - calc.projByCat[c])}.</b> Proyectado {money(calc.projByCat[c])} vs. registrado {money(calc.realByCat[c])}
                            {" "}({pct(calc.realByCat[c] / calc.projByCat[c], 0)}). Revisar si la obra se extendió o hubo horas adicionales.
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            </FadeIn>
          </div>

          <FadeIn>
            <Card>
              <CardHeader title="Matriz de distribución de costo M.O." subtitle="¿Cuánto se pagó por categoría en cada fase? Proyectado / real / saldo" />
              <CardBody className="pt-3">
                <div className="scrollbar-thin overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wide text-ink-muted">
                        <th className="px-3 py-2 text-left">Categoría</th>
                        {phaseCats.map((ph) => <th key={ph.id} className="px-3 py-2 text-right">{ph.code}</th>)}
                        <th className="px-3 py-2 text-right">Total proyectado</th><th className="px-3 py-2 text-right">Total real</th><th className="px-3 py-2 text-right">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CATS.map((c) => {
                        const s = calc.projByCat[c] - calc.realByCat[c];
                        return (
                          <tr key={c} className={cn("border-t border-line-soft", cat === c && "bg-brand-blue-50/50")}>
                            <td className="px-3 py-3 font-semibold text-ink">{catLabel(c)}</td>
                            {phaseCats.map((ph) => {
                              const pj = calc.projMatrix[`${ph.id}|${c}`] ?? 0, rl = calc.realMatrix[`${ph.id}|${c}`] ?? 0;
                              return (
                                <td key={ph.id} className="num px-3 py-3 text-right">
                                  <span className="block text-[11px] text-ink-muted">{moneyShort(pj)}</span>
                                  <span className={cn("block font-semibold", rl > pj && pj > 0 ? "text-danger" : "text-ink")}>{moneyShort(rl)}</span>
                                </td>
                              );
                            })}
                            <td className="num px-3 py-3 text-right text-ink-soft">{money(calc.projByCat[c])}</td>
                            <td className="num px-3 py-3 text-right font-semibold text-ink">{money(calc.realByCat[c])}</td>
                            <td className={cn("num px-3 py-3 text-right font-bold", s < 0 ? "text-danger" : "text-brand-green-700")}>{money(s)}</td>
                          </tr>
                        );
                      })}
                      <tr className="border-t-2 border-navy-900/70 bg-brand-blue-50/60 font-semibold text-navy-900">
                        <td className="px-3 py-3">Total</td>
                        {phaseCats.map((ph) => (
                          <td key={ph.id} className="num px-3 py-3 text-right">
                            <span className="block text-[11px] font-medium text-ink-muted">{moneyShort(calc.projByPhase[ph.id] ?? 0)}</span>
                            <span className="block">{moneyShort(calc.realByPhase[ph.id] ?? 0)}</span>
                          </td>
                        ))}
                        <td className="num px-3 py-3 text-right">{money(calc.projTotal)}</td>
                        <td className="num px-3 py-3 text-right">{money(calc.realTotal)}</td>
                        <td className={cn("num px-3 py-3 text-right", saldo < 0 ? "text-danger" : "text-brand-green-700")}>{money(saldo)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[11px] text-ink-muted">En cada fase: arriba el proyectado, abajo lo registrado (en rojo si supera lo proyectado).</p>
              </CardBody>
            </Card>
          </FadeIn>

          <Card>
            <CardHeader title="Planillas semanales de obreros" subtitle={cat ? `Mostrando solo ${catLabel(cat).toLowerCase()}s · total ${money(calc.realByCat[cat])} en ${obreros.filter((p) => line(p, cat)).length} semanas` : "Monto y número de trabajadores por categoría"} />
            <div className="mt-3">
              <DataTable rows={obreros as (LaborPayroll & Record<string, unknown>)[]} columns={weekCols} searchPlaceholder="Buscar semana, fase…" pageSize={12} dense
                initialSort={{ key: "week", dir: "desc" }}
                exportSheet={{ name: "Planillas", title: "Planillas semanales de obreros", subtitle: cat ? catLabel(cat) : "Todas las categorías" }} exportMeta={meta} />
            </div>
          </Card>

          {staff.length > 0 && (
            <Card>
              <CardHeader title="Planilla staff y beneficios" subtitle={`Costo cargado a gastos generales · ${money(staffTotal)}`} />
              <div className="mt-3">
                <DataTable rows={staff as (LaborPayroll & Record<string, unknown>)[]} columns={staffCols} pageSize={8} dense searchable={false}
                  initialSort={{ key: "end", dir: "desc" }} />
              </div>
            </Card>
          )}
        </>
      )}

      {props.canRegister && <RegisterPayrollModal open={openReg} onOpenChange={setOpenReg} {...props} />}
      {props.canEditProjection && <ProjectionModal open={openProj} onOpenChange={setOpenProj} {...props} />}
    </div>
  );
}

// ------------------------------------------------------------------ Registrar planilla
function RegisterPayrollModal({ open, onOpenChange, companyCode, projectCode, phases, wbs, nextWeek, projectStart, isConta }: {
  open: boolean; onOpenChange: (o: boolean) => void; companyCode: string; projectCode: string; phases: Phase[]; wbs: Wbs[]; nextWeek: number; projectStart: string | null; isConta: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [type, setType] = useState<PayrollInput["payroll_type"]>("obreros");
  const weekEnd = (w: number) => {
    if (!projectStart) return "";
    const d = new Date(`${projectStart}T12:00:00`);
    d.setDate(d.getDate() + 7 * w - 1);
    return d.toISOString().slice(0, 10);
  };
  const [week, setWeek] = useState(nextWeek);
  const [end, setEnd] = useState(weekEnd(nextWeek));
  const [startD, setStartD] = useState(() => { const e = weekEnd(nextWeek); if (!e) return ""; const d = new Date(`${e}T12:00:00`); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); });
  const phaseFor = (d: string) => [...phases].reverse().find((p) => p.start && d >= p.start)?.id ?? phases[0]?.id ?? "";
  const [phase, setPhase] = useState(() => phaseFor(weekEnd(nextWeek)));
  const moWbs = wbs.filter((w) => (type === "obreros" ? w.cost_type === "mano_obra" : true));
  const [wbsId, setWbsId] = useState("");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Record<string, { amount: string; workers: string; days: string }>>({
    capataz: { amount: "", workers: "1", days: "6" }, operario: { amount: "", workers: "", days: "6" }, oficial: { amount: "", workers: "", days: "6" }, peon: { amount: "", workers: "", days: "6" },
    staff: { amount: "", workers: "", days: "30" },
  });
  const cats = type === "obreros" ? CATS : (["staff"] as const);
  const total = cats.reduce((s, c) => s + (Number(lines[c].amount) || 0), 0);
  const suggestedWbs = moWbs.find((w) => w.phase_id === phase) ?? moWbs[0];
  const effWbs = wbsId || suggestedWbs?.id || "";

  const onWeek = (w: number) => {
    setWeek(w);
    const e = weekEnd(w);
    if (e) {
      setEnd(e);
      const d = new Date(`${e}T12:00:00`); d.setDate(d.getDate() - 6);
      setStartD(d.toISOString().slice(0, 10));
      setPhase(phaseFor(e));
    }
  };

  const submit = () => start(async () => {
    const res = await registerPayroll(companyCode, projectCode, {
      payroll_type: type, week: type === "obreros" ? week : null, label, period_start: startD, period_end: end, phase_id: phase, wbs_id: effWbs, notes,
      lines: cats.map((c) => ({ category: c, amount: Number(lines[c].amount) || 0, workers: Number(lines[c].workers) || 0, days: Number(lines[c].days) || null })),
    });
    if (!res.ok) return void toast.error("No se registró la planilla", { description: res.error });
    toast.success("Planilla registrada", { description: res.message });
    onOpenChange(false);
    router.refresh();
  });

  return (
    <Modal open={open} onOpenChange={onOpenChange} size="lg" title="Registrar planilla (costo)"
      description={isConta ? "Se registra aprobada y queda lista para pago en la bandeja de Contabilidad." : "Se registra como declarada por la obra y pasa a aprobación de Gerencia."}
      footer={<>
        <span className="mr-auto self-center text-sm text-ink-soft">Total: <b className="num text-navy-900">{money(total)}</b></span>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
        <Button onClick={submit} disabled={pending || total <= 0}>{pending ? "Registrando…" : "Registrar planilla"}</Button>
      </>}>
      <div className="space-y-5">
        <div className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
          {([["obreros", "Obreros (semanal)"], ["staff", "Staff (mensual)"], ["cts", "CTS"], ["gratificacion", "Gratificación"], ["liquidacion", "Liquidación"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => { setType(v); setWbsId(""); }} className={cn("h-8 rounded-lg px-3 text-xs font-semibold", type === v ? "bg-white text-navy-900 shadow-sm" : "text-ink-muted")}>{l}</button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {type === "obreros" ? (
            <Field label="Semana de obra" required><Input type="number" min={1} value={week} onChange={(e) => onWeek(Number(e.target.value))} /></Field>
          ) : (
            <Field label="Concepto / periodo" hint="Ej.: Octubre 2026"><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Octubre 2026" /></Field>
          )}
          <Field label="Inicio del periodo"><Input type="date" value={startD} onChange={(e) => setStartD(e.target.value)} /></Field>
          <Field label="Cierre del periodo" required><Input type="date" value={end} onChange={(e) => { setEnd(e.target.value); setPhase(phaseFor(e.target.value)); }} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fase" required>
            <Select value={phase} onChange={(e) => { setPhase(e.target.value); setWbsId(""); }}>
              {phases.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="WBS de mano de obra" required hint="Código de control al que se carga el costo">
            <Select value={effWbs} onChange={(e) => setWbsId(e.target.value)}>
              {moWbs.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}
            </Select>
          </Field>
        </div>
        <div className="overflow-hidden rounded-2xl border border-line">
          <div className="grid grid-cols-[1fr_1.2fr_0.8fr_0.7fr] gap-2 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            <span>Categoría</span><span className="text-right">Monto (S/)</span><span className="text-right">Trabajadores</span><span className="text-right">Días</span>
          </div>
          {cats.map((c) => (
            <div key={c} className="grid grid-cols-[1fr_1.2fr_0.8fr_0.7fr] items-center gap-2 border-t border-line-soft px-4 py-2">
              <span className="text-sm font-semibold text-ink">{LABOR_LABEL[c] ?? c}</span>
              <Input inputMode="decimal" className="h-9 text-right" placeholder="0.00" value={lines[c].amount} onChange={(e) => setLines({ ...lines, [c]: { ...lines[c], amount: e.target.value } })} />
              <Input inputMode="numeric" className="h-9 text-right" placeholder="0" value={lines[c].workers} onChange={(e) => setLines({ ...lines, [c]: { ...lines[c], workers: e.target.value } })} />
              <Input inputMode="numeric" className="h-9 text-right" value={lines[c].days} onChange={(e) => setLines({ ...lines, [c]: { ...lines[c], days: e.target.value } })} />
            </div>
          ))}
        </div>
        <Field label="Observaciones"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Horas extra, feriados, incidencias…" /></Field>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ Proyección
function ProjectionModal({ open, onOpenChange, companyCode, projectCode, phases, projections }: {
  open: boolean; onOpenChange: (o: boolean) => void; companyCode: string; projectCode: string; phases: Phase[];
  projections: { phase_id: string | null; category: string; amount: number; workers: number | null }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [grid, setGrid] = useState<Record<string, string>>(() =>
    Object.fromEntries(phases.flatMap((ph) => CATS.map((c) => [`${ph.id}|${c}`, String(projections.find((p) => p.phase_id === ph.id && p.category === c)?.amount ?? "")]))),
  );
  const colTotal = (ph: string) => CATS.reduce((s, c) => s + (Number(grid[`${ph}|${c}`]) || 0), 0);
  const total = phases.reduce((s, ph) => s + colTotal(ph.id), 0);
  const save = () => start(async () => {
    const res = await saveLaborProjections(companyCode, projectCode, phases.flatMap((ph) => CATS.map((c) => ({ phase_id: ph.id, category: c, amount: Number(grid[`${ph.id}|${c}`]) || 0, workers: null }))));
    if (!res.ok) return void toast.error("No se guardó", { description: res.error });
    toast.success(res.message ?? "Guardado");
    onOpenChange(false);
    router.refresh();
  });
  return (
    <Modal open={open} onOpenChange={onOpenChange} size="lg" title="Matriz de distribución de costo M.O." description="Monto proyectado por categoría y fase (sin IGV)."
      footer={<><span className="mr-auto self-center text-sm text-ink-soft">Total proyectado: <b className="num text-navy-900">{money(total)}</b></span>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={save} disabled={pending}>{pending ? "Guardando…" : "Guardar proyección"}</Button></>}>
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead><tr className="text-[11px] uppercase text-ink-muted"><th className="px-2 py-2 text-left">Categoría</th>{phases.map((p) => <th key={p.id} className="px-2 py-2 text-right">{p.code}</th>)}</tr></thead>
          <tbody>
            {CATS.map((c) => (
              <tr key={c} className="border-t border-line-soft">
                <td className="px-2 py-2 font-semibold">{LABOR_LABEL[c]}</td>
                {phases.map((ph) => (
                  <td key={ph.id} className="px-2 py-1.5"><Input inputMode="decimal" className="h-9 text-right" value={grid[`${ph.id}|${c}`]} onChange={(e) => setGrid({ ...grid, [`${ph.id}|${c}`]: e.target.value })} /></td>
                ))}
              </tr>
            ))}
            <tr className="border-t-2 border-navy-900/60 font-semibold text-navy-900"><td className="px-2 py-2">Total</td>{phases.map((ph) => <td key={ph.id} className="num px-2 py-2 text-right">{money(colTotal(ph.id))}</td>)}</tr>
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
