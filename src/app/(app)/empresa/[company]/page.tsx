import type { Metadata } from "next";
import { AlertTriangle, Building2, CalendarDays, FolderPlus, MapPin, Plus } from "lucide-react";
import Link from "next/link";
import { BudgetBars, DonutChart } from "@/components/charts";
import { SERIES } from "@/lib/series";
import { BatteryBar, Semaphore } from "@/components/ui/battery";
import { UrlSegment } from "@/components/ui/filters";
import { CountUp, Stagger, StaggerItem } from "@/components/ui/motion";
import { Badge, ButtonLink, Card, CardBody, CardHeader, EmptyState, PageHeader, cn } from "@/components/ui/primitives";
import { consumptionLevel, elapsed, PROJECT_STATUS, ratio } from "@/lib/calc";
import { dateShort, money, moneyShort, pct } from "@/lib/format";
import { can } from "@/lib/permissions";
import { getProjectsSummary } from "@/lib/queries";
import { getCompanyContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { CompanyExport } from "./company-export";

export const metadata: Metadata = { title: "Obras" };

const PALETTE = [SERIES.proyectado, SERIES.pagado, SERIES.declarado, SERIES.comprometido, SERIES.extra, "#64748B", "#0F4675"];

export default async function CompanyPage({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<{ estado?: string }> }) {
  const { company: code } = await params;
  const { estado } = await searchParams;
  const ctx = await getCompanyContext(code);
  const sb = await supabaseServer();
  const [{ data: projectsRaw }, { data: alerts }] = await Promise.all([
    sb.from("projects").select("*").eq("company_id", ctx.company.id).order("code"),
    sb.from("alerts").select("project_id, severity").eq("company_id", ctx.company.id).eq("resolved", false),
  ]);
  const all = projectsRaw ?? [];
  const summary = await getProjectsSummary(all.map((p) => p.id));
  const projects = estado ? all.filter((p) => p.status === estado) : all;
  const base = `/empresa/${code}`;

  const rows = projects.map((p) => {
    const t = summary.get(p.id)!;
    const a = (alerts ?? []).filter((x) => x.project_id === p.id);
    return { p, t, el: elapsed(p), danger: a.filter((x) => x.severity === "danger").length, warn: a.filter((x) => x.severity === "warning").length };
  });
  const tot = rows.reduce((s, r) => ({
    contract: s.contract + Number(r.p.contract_amount), budget: s.budget + r.t.budget, paid: s.paid + r.t.paid,
    committed: s.committed + r.t.committed, declared: s.declared + r.t.declared,
  }), { contract: 0, budget: 0, paid: 0, committed: 0, declared: 0 });
  const inAlert = rows.filter((r) => consumptionLevel(ratio(r.t.paid, r.t.budget), r.p.alert_threshold / 100) !== "normal" || r.danger > 0).length;

  const kpis = [
    { label: "Monto contratado", value: tot.contract, sub: `${all.length} obras · sin IGV`, tone: "text-navy-900" },
    { label: "Presupuesto asignado", value: tot.budget, sub: "Costo meta por WBS", tone: "text-brand-blue" },
    { label: "Pagado por Contabilidad", value: tot.paid, sub: `${pct(ratio(tot.paid, tot.budget))} del presupuesto`, tone: "text-brand-green-700" },
    { label: "Comprometido", value: tot.committed, sub: "O/S y O/C por facturar", tone: "text-[#9a5200]" },
    { label: "Saldo disponible", value: tot.budget - tot.paid - tot.committed, sub: `${pct(ratio(tot.budget - tot.paid - tot.committed, tot.budget))} libre`, tone: "text-ink" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Empresa ${ctx.company.code} · ${ctx.company.legal_name}`}
        title={`Obras de ${ctx.company.tagline}`}
        description="Presupuesto asignado, pagado y saldo de cada obra en tiempo real. Selecciona una obra para ver su resumen ejecutivo."
        actions={<>
          {all.length > 0 && <CompanyExport company={ctx.company.tagline ?? ctx.company.name} user={ctx.profile.full_name}
            rows={rows.map((r) => ({ code: r.p.code, name: r.p.name, status: PROJECT_STATUS[r.p.status].label, contract: Number(r.p.contract_amount), budget: r.t.budget, declared: r.t.declared, paid: r.t.paid, committed: r.t.committed, saldo: r.t.budget - r.t.paid, pct: ratio(r.t.paid, r.t.budget), plazo: r.el }))} />}
          {can(ctx.role, "createProject") && <ButtonLink href={`${base}/obras/nueva`}><Plus className="h-4 w-4" />Nueva obra</ButtonLink>}
        </>}
      />

      {!all.length ? (
        <EmptyState icon={<FolderPlus className="h-7 w-7" />} title="Sin proyectos"
          description="Esta empresa aún no tiene obras registradas. Los indicadores se mostrarán en S/ 0.00 hasta crear la primera obra."
          action={can(ctx.role, "createProject") ? <ButtonLink href={`${base}/obras/nueva`}><Plus className="h-4 w-4" />Crear la primera obra</ButtonLink> : undefined} />
      ) : (
        <>
          <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {kpis.map((k) => (
              <StaggerItem key={k.label}>
                <Card className="h-full p-5">
                  <p className="text-xs font-medium text-ink-muted">{k.label}</p>
                  <p className={cn("mt-1.5 font-display text-2xl font-semibold tracking-tight", k.tone)}><CountUp value={k.value} format="moneyShort" /></p>
                  <p className="mt-1 text-[11px] text-ink-muted">{k.sub}</p>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>

          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader title="Presupuesto vs. ejecutado por obra" subtitle="Clic en una obra para abrir su tablero" icon={<Building2 className="h-4 w-4" />} />
              <CardBody>
                <BudgetBars rows={rows.map((r) => ({ key: r.p.id, label: `${r.p.code} · ${r.p.short_name ?? r.p.name}`, sub: `${moneyShort(r.t.paid)} de ${moneyShort(r.t.budget)}`, budget: r.t.budget, paid: r.t.paid, committed: r.t.committed, href: `${base}/obra/${r.p.code}` }))} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Distribución del gasto pagado" subtitle="Participación de cada obra en lo pagado" />
              <CardBody>
                <DonutChart centerLabel="Pagado" data={rows.filter((r) => r.t.paid > 0).map((r, i) => ({ name: `${r.p.code} · ${r.p.short_name}`, value: r.t.paid, color: PALETTE[i % PALETTE.length] }))} />
              </CardBody>
            </Card>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <UrlSegment name="estado" options={[
              { value: "", label: "Todas", count: all.length },
              ...["ejecucion", "preparacion", "paralizada", "cancelada", "cerrada"].filter((s) => all.some((p) => p.status === s))
                .map((s) => ({ value: s, label: PROJECT_STATUS[s].label, count: all.filter((p) => p.status === s).length })),
            ]} />
            {inAlert > 0 && <Badge tone="amber"><AlertTriangle className="h-3 w-3" />{inAlert} obra(s) requieren atención</Badge>}
          </div>

          <Stagger className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3" delay={0.06}>
            {rows.map(({ p, t, el, danger, warn }) => {
              const r = ratio(t.paid, t.budget);
              const level = consumptionLevel(r, p.alert_threshold / 100);
              const st = PROJECT_STATUS[p.status];
              return (
                <StaggerItem key={p.id}>
                  <Link href={`${base}/obra/${p.code}`} className="group block h-full">
                    <Card className="relative h-full overflow-hidden p-5 transition duration-300 group-hover:-translate-y-0.5 group-hover:border-brand-blue/30 group-hover:shadow-pop">
                      <div className={cn("absolute inset-x-0 top-0 h-1", level === "peligro" ? "bg-danger-500" : level === "alerta" ? "bg-warn-500" : "bg-gradient-to-r from-brand-blue to-brand-green")} />
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="rounded-lg bg-navy-900 px-2 py-0.5 font-display text-xs font-bold text-white">{p.code}</span>
                            <Badge tone={st.tone}>{st.label}</Badge>
                          </div>
                          <h3 className="mt-2.5 line-clamp-2 font-display text-[15px] font-semibold leading-snug text-ink group-hover:text-brand-blue">{p.name}</h3>
                          <p className="mt-1 flex items-center gap-1 text-xs text-ink-muted"><MapPin className="h-3 w-3" />{p.location}, {p.region} · {p.client_name}</p>
                        </div>
                        <Semaphore level={level} threshold={p.alert_threshold / 100} />
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-3">
                        <div><p className="text-[11px] text-ink-muted">Presupuesto</p><p className="num text-sm font-semibold">{moneyShort(t.budget)}</p></div>
                        <div><p className="text-[11px] text-ink-muted">Pagado</p><p className="num text-sm font-semibold text-brand-green-700">{moneyShort(t.paid)}</p></div>
                        <div><p className="text-[11px] text-ink-muted">Saldo</p><p className={cn("num text-sm font-semibold", t.budget - t.paid < 0 && "text-danger")}>{moneyShort(t.budget - t.paid)}</p></div>
                      </div>
                      <BatteryBar className="mt-4" value={t.paid} total={t.budget} elapsed={p.status === "ejecucion" ? el : undefined} threshold={p.alert_threshold / 100}
                        label={`Consumo ${p.status === "ejecucion" ? `· plazo ${pct(el, 0)}` : ""}`} />
                      <div className="mt-4 flex items-center justify-between border-t border-line-soft pt-3 text-[11px] text-ink-muted">
                        <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{dateShort(p.start_date)} → {dateShort(p.extended_end_date ?? p.end_date)}</span>
                        <span className="flex items-center gap-2">
                          {danger > 0 && <span className="font-semibold text-danger">{danger} críticas</span>}
                          {warn > 0 && <span className="font-semibold text-[#9a5200]">{warn} alertas</span>}
                          {!danger && !warn && <span>Contrato {money(p.contract_amount, { decimals: false })}</span>}
                        </span>
                      </div>
                    </Card>
                  </Link>
                </StaggerItem>
              );
            })}
          </Stagger>
        </>
      )}
    </div>
  );
}
