"use client";
import { AlertTriangle, ArrowRight, BellRing, CalendarDays, Info, Layers, OctagonAlert, Plus, Receipt, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Bar3DChart, DonutChart, Gauge, PeriodBars, SCurveChart, SERIES } from "@/components/charts";
import { BatteryBar, LevelBadge, Semaphore } from "@/components/ui/battery";
import { ExportMenu } from "@/components/ui/export-menu";
import { CountUp, FadeIn, Stagger, StaggerItem } from "@/components/ui/motion";
import { Badge, ButtonLink, Card, CardBody, CardHeader, PageHeader, cn } from "@/components/ui/primitives";
import { CONCILIATION_LABEL, PROJECT_STATUS, consumptionLevel, ratio, type Conciliation, type Totals, CONCILIATION_TONE } from "@/lib/calc";
import { date, money, moneyShort, pct, timeAgo } from "@/lib/format";
import { can, type Role } from "@/lib/permissions";
import type { ExportSheet } from "@/lib/export/types";

export type ExecutiveData = {
  project: { id: string; code: string; name: string; client: string | null; location: string; status: string; start: string | null; end: string | null; extended: string | null; contract: number; threshold: number; tc: number };
  company: string; companyCode: string; user: string; role: Role;
  totals: Totals; elapsed: number; valued: number; collected: number;
  curve: { label: string; date: string; projected: number; paid: number | null; declared: number | null }[];
  todayLabel: string;
  monthly: { key: string; label: string; value: number; secondary: number }[];
  phases: { id: string; code: string; name: string; color: string | null; budget: number; paid: number; sale: number; valued: number; cpi: number | null }[];
  generalBudget: number;
  costTypes: { name: string; value: number }[];
  level1: { id: string; code: string; name: string; budget: number; paid: number; declared: number; committed: number; state: Conciliation; leaves: number }[];
  critical: { id: string; code: string; name: string; budget: number; paid: number; r: number }[];
  alerts: { id: string; title: string; message: string | null; severity: string; alert_type: string; entity_id: string | null; created_at: string }[];
};

const STATE_TONE = CONCILIATION_TONE;
const TYPE_COLORS = [SERIES.proyectado, SERIES.pagado, SERIES.declarado, SERIES.comprometido, SERIES.extra, "#475569", "#0F4675", "#94A3B8"];

export function Executive({ data }: { data: ExecutiveData }) {
  const { project: p, totals: t } = data;
  const base = `/empresa/${data.companyCode}/obra/${p.code}`;
  const refs = { phase: useRef<HTMLDivElement>(null), donut: useRef<HTMLDivElement>(null), curve: useRef<HTMLDivElement>(null), month: useRef<HTMLDivElement>(null) };
  const [showDeclared, setShowDeclared] = useState(true);
  const consumption = ratio(t.paid, t.budget);
  const level = consumptionLevel(consumption, p.threshold);
  const saldo = t.budget - t.paid;
  const disponible = t.budget - t.paid - t.committed;
  const porEjecutar = p.contract - t.paid;
  const st = PROJECT_STATUS[p.status];
  const lastPaid = [...data.curve].reverse().find((c) => c.paid !== null);
  const desvio = lastPaid ? lastPaid.paid! - lastPaid.projected : 0;
  const daysLeft = p.extended ?? p.end ? Math.ceil((new Date(`${p.extended ?? p.end}T23:59:59`).getTime() - Date.now()) / 86400000) : null;

  const kpis = [
    { label: "Proyectado", hint: "Presupuesto aprobado (WBS)", value: t.budget, tone: "text-brand-blue", bar: null },
    { label: "Declarado por obra", hint: "Gastos informados con comprobante", value: t.declared, tone: "text-violet-700", bar: ratio(t.declared, t.budget) },
    { label: "Pagado por Contabilidad", hint: "Pagos registrados en Lima", value: t.paid, tone: "text-brand-green-700", bar: consumption },
    { label: "Comprometido", hint: "O/S y O/C emitidas por facturar", value: t.committed, tone: "text-[#9a5200]", bar: ratio(t.committed, t.budget) },
    { label: "Saldo disponible", hint: "Proyectado − pagado − comprometido", value: disponible, tone: disponible < 0 ? "text-danger" : "text-ink", bar: null },
    { label: "Valorizado al cliente", hint: `Cobrado ${moneyShort(data.collected)}`, value: data.valued, tone: "text-navy-900", bar: null },
  ];

  const exportSheets = (): ExportSheet[] => [
    {
      name: "Resumen ejecutivo", title: "Resumen ejecutivo de obra", subtitle: `${p.code} · Corte ${date(new Date())}`,
      summary: [
        { label: "Monto del contrato", value: money(p.contract), tone: "navy" as const },
        { label: "Proyectado (presupuesto)", value: money(t.budget), tone: "blue" as const },
        { label: "Pagado por Contabilidad", value: money(t.paid), tone: "green" as const },
        { label: "Saldo presupuestal", value: money(saldo), tone: saldo < 0 ? "red" as const : "navy" as const },
        { label: "Saldo por ejecutar", value: money(porEjecutar), tone: "amber" as const },
      ],
      columns: [
        { key: "code", header: "WBS", width: 14 }, { key: "name", header: "Partida / centro de costo", width: 44 },
        { key: "budget", header: "Proyectado", type: "money" as const }, { key: "declared", header: "Declarado obra", type: "money" as const },
        { key: "paid", header: "Pagado", type: "money" as const }, { key: "committed", header: "Comprometido", type: "money" as const },
        { key: "saldo", header: "Saldo", type: "money" as const }, { key: "pct", header: "% consumo", type: "pct" as const }, { key: "estado", header: "Conciliación", width: 18 },
      ],
      rows: data.level1.map((l) => ({ ...l, saldo: l.budget - l.paid, pct: ratio(l.paid, l.budget), estado: CONCILIATION_LABEL[l.state] })),
      totals: { budget: t.budget, declared: t.declared, paid: t.paid, committed: t.committed, saldo, pct: consumption },
    },
    {
      name: "Por fase", title: "Control por fase", subtitle: "Proyectado vs. real y CPI",
      columns: [
        { key: "name", header: "Fase", width: 44 }, { key: "budget", header: "Proyectado costo", type: "money" as const }, { key: "paid", header: "Costo real pagado", type: "money" as const },
        { key: "margin", header: "Saldo", type: "money" as const }, { key: "sale", header: "Monto contractual", type: "money" as const }, { key: "valued", header: "Valorizado", type: "money" as const }, { key: "cpi", header: "CPI", type: "number" as const },
      ],
      rows: data.phases.map((f) => ({ ...f, margin: f.budget - f.paid, cpi: f.cpi ?? "" })),
    },
    {
      name: "Gasto mensual", title: "Gasto pagado por mes", subtitle: "Pagado vs. declarado por obra",
      columns: [{ key: "label", header: "Mes", width: 14 }, { key: "value", header: "Pagado", type: "money" as const }, { key: "secondary", header: "Declarado", type: "money" as const }],
      rows: data.monthly, totals: { value: data.monthly.reduce((s, m) => s + m.value, 0), secondary: data.monthly.reduce((s, m) => s + m.secondary, 0) },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<span className="flex items-center gap-2">{p.code}<Badge tone={st.tone}>{st.label}</Badge></span>}
        title={p.name}
        description={`${p.client ?? ""} · ${p.location} · ${date(p.start)} → ${date(p.extended ?? p.end)}${p.extended ? " (ampliado)" : ""}`}
        actions={<>
          <ExportMenu label="Reporte ejecutivo" build={exportSheets}
            meta={() => ({ filename: `Resumen_ejecutivo_${p.code}`, company: data.company, project: `${p.code} · ${p.name}`, user: data.user,
              charts: [refs.phase.current, refs.donut.current, refs.curve.current, refs.month.current] })} />
          {can(data.role, "registerExpense") && <ButtonLink href={`${base}/gastos/nuevo`}><Plus className="h-4 w-4" />Registrar gasto</ButtonLink>}
        </>}
      />

      <div className="grid gap-4 xl:grid-cols-12">
        {/* Hero institucional */}
        <FadeIn className="xl:col-span-5">
          <div className="relative h-full overflow-hidden rounded-3xl bg-[radial-gradient(120%_120%_at_0%_0%,#0b5ba4_0%,#062a4d_60%,#041d36_100%)] p-6 text-white shadow-pop">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-green/15 blur-2xl" />
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">Presupuesto de la obra</p>
            <div className="mt-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs text-white/65">Monto del contrato (sin IGV)</p>
                <p className="font-display text-[26px] font-bold tracking-tight sm:text-3xl 2xl:text-4xl"><CountUp value={p.contract} /></p>
                <p className="mt-3 text-xs text-white/65">Saldo por ejecutar · contrato − gastado</p>
                <p className="font-display text-2xl font-semibold text-brand-green"><CountUp value={porEjecutar} /></p>
              </div>
              <div className="hidden shrink-0 rounded-2xl bg-white p-2 sm:block"><Gauge value={consumption} threshold={p.threshold} label="Consumo" size={128} /></div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-sm">
              <div><p className="text-[11px] text-white/55">Presupuesto de costo</p><p className="num font-semibold">{money(t.budget)}</p></div>
              <div><p className="text-[11px] text-white/55">Saldo presupuestal</p><p className={cn("num font-semibold", saldo < 0 && "text-[#ff8a95]")}>{money(saldo)}</p></div>
              <div><p className="text-[11px] text-white/55">Margen proyectado</p><p className="num font-semibold">{money(p.contract - t.budget)} <span className="text-white/50">({pct(ratio(p.contract - t.budget, p.contract))})</span></p></div>
              <div><p className="text-[11px] text-white/55">Tipo de cambio ref.</p><p className="num font-semibold">S/ {p.tc.toFixed(2)}</p></div>
            </div>
            <div className="mt-5">
              <div className="mb-1.5 flex items-center justify-between text-[11px] text-white/65">
                <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />Plazo transcurrido</span>
                <span className="num font-semibold text-white">{pct(data.elapsed, 0)}{daysLeft !== null && daysLeft > 0 ? ` · faltan ${daysLeft} días` : daysLeft !== null ? " · plazo vencido" : ""}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-brand-green to-[#7ee2a8]" style={{ width: `${data.elapsed * 100}%` }} /></div>
            </div>
          </div>
        </FadeIn>

        {/* KPIs */}
        <Stagger className="grid gap-3 sm:grid-cols-2 xl:col-span-7 xl:grid-cols-3">
          {kpis.map((k) => (
            <StaggerItem key={k.label}>
              <Card className="h-full p-4">
                <p className="text-xs font-semibold text-ink-soft">{k.label}</p>
                <p className={cn("mt-1 font-display text-[22px] font-semibold tracking-tight", k.tone)}><CountUp value={k.value} /></p>
                <p className="mt-0.5 text-[11px] text-ink-muted">{k.hint}</p>
                {k.bar !== null && <BatteryBar className="mt-3" size="sm" showLabel={false} value={k.bar} total={1} threshold={p.threshold} />}
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-brand-blue/15 bg-brand-blue-50/70 px-4 py-3 text-[13px] text-ink-soft">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue" />
        <p><b className="text-ink">Lectura rápida:</b> Proyectado = presupuesto aprobado · Declarado = gastos informados por Obra · Pagado = pagos registrados por Contabilidad · Saldo = proyectado − pagado. La barra de cada WBS se actualiza sola cuando Contabilidad registra el pago.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader title="Control por fase" subtitle="Proyectado vs. costo real pagado vs. saldo de cada fase" icon={<Layers className="h-4 w-4" />}
            actions={<Badge tone={level === "peligro" ? "red" : level === "alerta" ? "amber" : "green"}>{pct(consumption)} consumido</Badge>} />
          <CardBody>
            <div ref={refs.phase} className="bg-white">
              <Bar3DChart height={330}
                series={[{ name: "Proyectado", color: SERIES.proyectado }, { name: "Real pagado", color: SERIES.pagado }, { name: "Saldo", color: SERIES.extra }]}
                categories={[
                  ...data.phases.map((f) => ({ label: f.code, sub: f.name.split("·")[1]?.trim().slice(0, 22), values: [f.budget, f.paid, Math.max(f.budget - f.paid, 0)] })),
                  ...(data.generalBudget > 0 ? [{ label: "General", sub: "Partidas transversales", values: [data.generalBudget, data.level1.length ? t.paid - data.phases.reduce((s, f) => s + f.paid, 0) : 0, Math.max(data.generalBudget - (t.paid - data.phases.reduce((s, f) => s + f.paid, 0)), 0)] }] : []),
                ]} />
            </div>
          </CardBody>
        </Card>
        <Card className="xl:col-span-5">
          <CardHeader title="Gasto pagado por tipo de costo" subtitle="Composición del gasto real" icon={<Receipt className="h-4 w-4" />} />
          <CardBody>
            <div ref={refs.donut} className="bg-white">
              {data.costTypes.length ? <DonutChart centerLabel="Pagado" data={data.costTypes.map((c, i) => ({ ...c, color: TYPE_COLORS[i % TYPE_COLORS.length] }))} />
                : <div className="flex h-64 flex-col items-center justify-center text-center"><Receipt className="h-8 w-8 text-ink-muted/50" /><p className="mt-2 text-sm font-semibold text-ink">Aún no hay gasto pagado</p><p className="text-xs text-ink-muted">La composición aparecerá cuando Contabilidad registre los primeros pagos.</p></div>}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Línea de vida de la obra · Curva S" subtitle="Costo acumulado proyectado vs. real pagado vs. declarado por obra, por quincena" icon={<TrendingUp className="h-4 w-4" />}
          actions={lastPaid && (
            <Badge tone={desvio > 0 ? "red" : "green"}>{desvio > 0 ? "Gasto adelantado" : "Gasto por debajo"} {moneyShort(Math.abs(desvio))} vs. curva</Badge>
          )} />
        <CardBody>
          <div ref={refs.curve} className="bg-white"><SCurveChart data={data.curve} todayLabel={data.todayLabel} budget={t.budget} height={320} /></div>
          <div className="mt-2 flex flex-wrap justify-center gap-4 text-[11px] font-medium text-ink-soft">
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed border-brand-blue" />Proyectado (curva S)</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-3 rounded-sm bg-brand-green-600/60" />Real pagado</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-violet-600" />Declarado por obra</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-0.5 bg-danger-500" />Hoy</span>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader title="Gasto por mes" subtitle="Pagado por Contabilidad (verde) frente a lo declarado por la obra (azul)"
            actions={<button onClick={() => setShowDeclared(!showDeclared)} className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-ink-soft hover:text-ink">{showDeclared ? "Ocultar declarado" : "Comparar declarado"}</button>} />
          <CardBody>
            <div ref={refs.month} className="bg-white">
              <PeriodBars data={data.monthly} height={260} name="Pagado" secondaryName={showDeclared ? "Declarado" : undefined} />
            </div>
          </CardBody>
        </Card>
        <Card className="xl:col-span-5">
          <CardHeader title="Partidas con mayor consumo" subtitle="WBS de último nivel ordenados por % pagado" icon={<AlertTriangle className="h-4 w-4" />} />
          <CardBody className="space-y-4">
            {data.critical.map((c, i) => (
              <Link key={c.id} href={`${base}/presupuesto/${c.id}`} className="block rounded-xl p-2 transition hover:bg-slate-50">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="truncate text-[13px] font-semibold text-ink"><span className="text-ink-muted">{c.code}</span> · {c.name}</p>
                  <Semaphore level={consumptionLevel(c.r, p.threshold)} threshold={p.threshold} />
                </div>
                <BatteryBar value={c.paid} total={c.budget} threshold={p.threshold} elapsed={p.status === "ejecucion" ? data.elapsed : undefined} delay={i * 0.08} />
              </Link>
            ))}
          </CardBody>
        </Card>
      </div>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Centros de costo (WBS)</h2>
            <p className="text-xs text-ink-muted">Proyectado, declarado por obra, pagado por Contabilidad y estado de conciliación</p>
          </div>
          <Link href={`${base}/presupuesto`} className="flex items-center gap-1 text-sm font-semibold text-brand-blue hover:underline">Ver árbol completo <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <Stagger className="grid gap-4 lg:grid-cols-2">
          {data.level1.map((l) => (
            <StaggerItem key={l.id}>
              <Link href={`${base}/presupuesto/${l.id}`} className="group block h-full">
                <Card className="h-full overflow-hidden transition group-hover:border-brand-blue/30 group-hover:shadow-pop">
                  <div className="flex items-center justify-between gap-3 border-b border-line-soft bg-slate-50/70 px-5 py-3">
                    <p className="min-w-0 truncate font-display text-[15px] font-semibold text-navy-900">{l.code} · {l.name}</p>
                    <Badge tone={STATE_TONE[l.state]}>{CONCILIATION_LABEL[l.state]}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 px-5 pt-4 2xl:grid-cols-4">
                    {[["Proyectado", l.budget, ""], ["Declarado obra", l.declared, "text-violet-700"], ["Pagado", l.paid, "text-brand-green-700"], ["Saldo", l.budget - l.paid, l.budget - l.paid < 0 ? "text-danger" : ""]].map(([k, v, c]) => (
                      <div key={k as string} className="rounded-xl border border-line-soft p-2.5">
                        <p className="text-[10.5px] text-ink-muted">{k}</p>
                        <p className={cn("num truncate text-sm font-semibold", c as string)}>{money(v)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-3 px-5 pb-4 pt-3 sm:grid-cols-2">
                    <BatteryBar value={l.declared} total={l.budget} threshold={p.threshold} size="sm" label="Declarado / Proyectado" />
                    <BatteryBar value={l.paid} total={l.budget} threshold={p.threshold} size="sm" label="Pagado / Proyectado" />
                  </div>
                  {l.state !== "conciliado" && l.state !== "sin_movimiento" && (
                    <p className={cn("border-t border-line-soft px-5 py-2 text-[11.5px] font-semibold", l.state === "por_conciliar" ? "text-danger" : "text-[#9a5200]")}>
                      Diferencia: {money(Math.abs(l.paid - l.declared))} · {l.state === "por_conciliar" ? "Falta pagar respecto a lo declarado" : "Pagado sin declarar por la obra"}
                    </p>
                  )}
                </Card>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader title="Rendimiento por fase (CPI)" subtitle="Valorizado al cliente ÷ costo real pagado" />
          <CardBody className="space-y-3">
            {data.phases.map((f) => (
              <div key={f.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line-soft p-3">
                <span className="h-9 w-1.5 rounded-full" style={{ background: f.color ?? SERIES.proyectado }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{f.name}</p>
                  <p className="text-[11px] text-ink-muted">Valorizado {money(f.valued)} · Pagado {money(f.paid)} · Contractual {money(f.sale)}</p>
                </div>
                {f.cpi !== null ? (
                  <div className="text-right">
                    <p className={cn("num font-display text-xl font-semibold", f.cpi >= 1 ? "text-brand-green-700" : "text-danger")}>{f.cpi.toFixed(2)}</p>
                    <p className="text-[10.5px] text-ink-muted">Por cada S/ 1 gastado se reciben S/ {f.cpi.toFixed(2)}</p>
                  </div>
                ) : <Badge tone="gray">Sin gasto</Badge>}
              </div>
            ))}
          </CardBody>
        </Card>
        <Card className="xl:col-span-5">
          <CardHeader title="Alertas de la obra" subtitle="Semáforo de consumo, ritmo y vencimientos" icon={<BellRing className="h-4 w-4" />}
            actions={<Link href={`/empresa/${data.companyCode}/alertas`} className="text-xs font-semibold text-brand-blue hover:underline">Ver todas</Link>} />
          <CardBody className="space-y-2">
            {data.alerts.map((a) => (
              <Link key={a.id} href={a.alert_type.match(/consumo|sobrecosto|ritmo|diferencia/) && a.entity_id ? `${base}/presupuesto/${a.entity_id}` : a.alert_type === "vencimiento" && a.entity_id ? `${base}/gastos/${a.entity_id}` : a.alert_type === "orden_excedida" && a.entity_id ? `${base}/ordenes/${a.entity_id}` : a.alert_type === "fondos" ? `${base}/caja` : `/empresa/${data.companyCode}/alertas`}
                className="flex gap-3 rounded-xl border border-line-soft p-3 transition hover:bg-slate-50">
                {a.severity === "danger" ? <OctagonAlert className="h-5 w-5 shrink-0 text-danger-500" /> : a.severity === "warning" ? <AlertTriangle className="h-5 w-5 shrink-0 text-warn-500" /> : <Info className="h-5 w-5 shrink-0 text-brand-blue" />}
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold leading-snug text-ink">{a.title}</p>
                  <p className="line-clamp-2 text-xs text-ink-muted">{a.message}</p>
                  <p className="mt-0.5 text-[10px] text-ink-muted/80">{timeAgo(a.created_at)}</p>
                </div>
              </Link>
            ))}
            {!data.alerts.length && <div className="flex flex-col items-center py-8 text-center"><LevelBadge ratio={0} /><p className="mt-2 text-sm text-ink-muted">Sin alertas activas en esta obra.</p></div>}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
