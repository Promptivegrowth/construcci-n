"use client";
import { AlertTriangle, Building2, Trophy } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { Bar3DChart, BudgetBars, DonutChart, SERIES } from "@/components/charts";
import { BatteryBar, Semaphore } from "@/components/ui/battery";
import { DataTable } from "@/components/ui/data-table";
import { ExportMenu } from "@/components/ui/export-menu";
import { CountUp, Stagger, StaggerItem } from "@/components/ui/motion";
import { Badge, Card, CardBody, CardHeader, PageHeader, cn } from "@/components/ui/primitives";
import { consumptionLevel, ratio } from "@/lib/calc";
import type { ExportSheet } from "@/lib/export/types";
import { money, moneyShort, pct } from "@/lib/format";

type Row = { id: string; code: string; name: string; company: string; companyName: string; status: string; statusLabel: string; contract: number; budget: number; paid: number; declared: number;
  committed: number; elapsed: number; threshold: number; danger: number; warning: number; collected: number };

const CO_COLORS = [SERIES.proyectado, SERIES.pagado, SERIES.declarado, SERIES.comprometido];

export function HoldingView({ rows, companies, user, alertsByCompany }: { rows: Row[]; companies: { id: string; code: string; name: string; color: string }[]; user: string; alertsByCompany: Record<string, number> }) {
  const r3d = useRef<HTMLDivElement>(null);
  const rdon = useRef<HTMLDivElement>(null);
  const sum = (list: Row[], k: keyof Row) => list.reduce((s, r) => s + Number(r[k]), 0);
  const byCo = companies.map((c) => {
    const list = rows.filter((r) => r.company === c.code);
    return { ...c, n: list.length, active: list.filter((r) => r.status === "ejecucion").length, contract: sum(list, "contract"), budget: sum(list, "budget"), paid: sum(list, "paid"), committed: sum(list, "committed"), collected: sum(list, "collected") };
  });
  const tot = { contract: sum(rows, "contract"), budget: sum(rows, "budget"), paid: sum(rows, "paid"), committed: sum(rows, "committed"), collected: sum(rows, "collected") };
  const ranking = [...rows].filter((r) => r.budget > 0).sort((a, b) => ratio(b.paid, b.budget) - ratio(a.paid, a.budget));
  const inAlert = rows.filter((r) => r.danger > 0 || consumptionLevel(ratio(r.paid, r.budget), r.threshold) !== "normal");

  const sheets = (): ExportSheet[] => [{
    name: "Holding", title: "Consolidado del holding", subtitle: "Comparativo de empresas y obras",
    summary: [
      { label: "Contratado", value: money(tot.contract), tone: "navy" }, { label: "Presupuesto", value: money(tot.budget), tone: "blue" },
      { label: "Pagado", value: money(tot.paid), tone: "green" }, { label: "Comprometido", value: money(tot.committed), tone: "amber" }, { label: "Cobrado", value: money(tot.collected), tone: "navy" },
    ],
    columns: [
      { key: "companyName", header: "Empresa", width: 26 }, { key: "code", header: "Obra", width: 11 }, { key: "name", header: "Nombre", width: 30 }, { key: "statusLabel", header: "Estado", width: 14 },
      { key: "contract", header: "Contrato", type: "money" }, { key: "budget", header: "Presupuesto", type: "money" }, { key: "paid", header: "Pagado", type: "money" },
      { key: "committed", header: "Comprometido", type: "money" }, { key: "pct", header: "% consumo", type: "pct" }, { key: "elapsed", header: "% plazo", type: "pct" },
    ],
    rows: rows.map((r) => ({ ...r, pct: ratio(r.paid, r.budget) })),
    totals: { contract: tot.contract, budget: tot.budget, paid: tot.paid, committed: tot.committed },
  }];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Gerencia General · Grupo Cruz Holding" title="Vista consolidada del holding"
        description="Indicadores por empresa y obra: presupuesto, ejecutado, comprometido y saldo; ranking de consumo y obras en alerta."
        actions={<ExportMenu label="Reporte consolidado" build={sheets} meta={() => ({ filename: "Holding_consolidado", company: "Grupo Cruz Holding", user, charts: [r3d.current, rdon.current] })} />} />

      <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[["Monto contratado", tot.contract, "text-navy-900"], ["Presupuesto asignado", tot.budget, "text-brand-blue"], ["Pagado", tot.paid, "text-brand-green-700"], ["Comprometido", tot.committed, "text-[#9a5200]"], ["Cobrado a clientes", tot.collected, "text-ink"]].map(([k, v, c]) => (
          <StaggerItem key={k as string}><Card className="h-full p-4"><p className="text-xs text-ink-muted">{k}</p><p className={cn("mt-1 font-display text-xl font-semibold sm:text-2xl", c as string)}><CountUp value={v as number} format="moneyShort" /></p></Card></StaggerItem>
        ))}
      </Stagger>

      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {byCo.map((c) => (
          <StaggerItem key={c.id}>
            <Link href={`/empresa/${c.code}`} className="block h-full">
              <Card className="relative h-full overflow-hidden p-5 transition hover:-translate-y-0.5 hover:shadow-pop">
                <div className="absolute inset-x-0 top-0 h-1" style={{ background: c.color }} />
                <div className="flex items-center justify-between">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-navy-900 font-display text-sm font-bold text-white">{c.code}</span>
                  {alertsByCompany[c.code] > 0 && <Badge tone="amber">{alertsByCompany[c.code]} alertas</Badge>}
                </div>
                <p className="mt-3 font-display font-semibold">{c.name}</p>
                <p className="text-xs text-ink-muted">{c.n ? `${c.n} obras · ${c.active} en ejecución` : "Sin proyectos"}</p>
                <BatteryBar className="mt-4" value={c.paid} total={c.budget} label={c.n ? `${moneyShort(c.paid)} de ${moneyShort(c.budget)}` : "S/ 0.00"} />
              </Card>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader title="Comparativo por empresa" subtitle="Presupuesto vs. pagado vs. comprometido" icon={<Building2 className="h-4 w-4" />} />
          <CardBody><div ref={r3d} className="bg-white">
            <Bar3DChart height={320} series={[{ name: "Presupuesto", color: SERIES.proyectado }, { name: "Pagado", color: SERIES.pagado }, { name: "Comprometido", color: SERIES.extra }]}
              categories={byCo.map((c) => ({ label: `Empresa ${c.code}`, sub: c.name.slice(0, 24), values: [c.budget, c.paid, c.committed] }))} />
          </div></CardBody>
        </Card>
        <Card className="xl:col-span-5">
          <CardHeader title="Contratos por empresa" subtitle="Participación en el monto contratado" />
          <CardBody><div ref={rdon} className="bg-white">
            <DonutChart centerLabel="Contratado" data={byCo.filter((c) => c.contract > 0).map((c, i) => ({ name: `${c.code} · ${c.name}`, value: c.contract, color: CO_COLORS[i] }))} />
          </div></CardBody>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader title="Ranking de obras por consumo" subtitle="Pagado ÷ presupuesto (comprometido rayado)" icon={<Trophy className="h-4 w-4" />} />
          <CardBody>
            <BudgetBars rows={ranking.map((r) => ({ key: r.id, label: `${r.code} · ${r.name}`, sub: r.companyName, budget: r.budget, paid: r.paid, committed: r.committed, href: `/empresa/${r.company}/obra/${r.code}` }))} />
          </CardBody>
        </Card>
        <Card className="xl:col-span-5">
          <CardHeader title="Obras en alerta" subtitle="Consumo ≥ umbral, sobrecostos o alertas críticas" icon={<AlertTriangle className="h-4 w-4" />} />
          <CardBody className="space-y-3">
            {inAlert.map((r) => (
              <Link key={r.id} href={`/empresa/${r.company}/obra/${r.code}`} className="flex items-center gap-3 rounded-xl border border-line-soft p-3 transition hover:bg-slate-50">
                <Semaphore level={consumptionLevel(ratio(r.paid, r.budget), r.threshold)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{r.code} · {r.name}</p>
                  <p className="text-[11px] text-ink-muted">{r.companyName} · consumo {pct(ratio(r.paid, r.budget))} · plazo {pct(r.elapsed, 0)}</p>
                </div>
                {r.danger > 0 && <Badge tone="red">{r.danger} críticas</Badge>}
              </Link>
            ))}
            {!inAlert.length && <p className="py-6 text-center text-sm text-ink-muted">Ninguna obra en alerta.</p>}
          </CardBody>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="Todas las obras del holding" />
        <div className="mt-3">
          <DataTable rows={rows as (Row & Record<string, unknown>)[]} rowHref={(r) => `/empresa/${r.company}/obra/${r.code}`}
            exportSheet={{ name: "Obras_holding", title: "Obras del holding" }} exportMeta={{ filename: "Obras_holding", company: "Grupo Cruz Holding", user }}
            columns={[
              { key: "companyName", header: "Empresa", value: (r) => r.companyName, hideSm: true },
              { key: "code", header: "Obra", value: (r) => `${r.code} ${r.name}`, cell: (r) => <span><b>{r.code}</b><span className="block text-xs text-ink-muted">{r.name}</span></span> },
              { key: "statusLabel", header: "Estado", value: (r) => r.statusLabel, hideSm: true },
              { key: "contract", header: "Contrato", type: "money", value: (r) => r.contract, total: true, hideSm: true },
              { key: "budget", header: "Presupuesto", type: "money", value: (r) => r.budget, total: true },
              { key: "paid", header: "Pagado", type: "money", value: (r) => r.paid, total: true },
              { key: "pct", header: "Consumo", type: "pct", value: (r) => ratio(r.paid, r.budget), cell: (r) => <div className="w-32"><BatteryBar size="sm" value={r.paid} total={r.budget} threshold={r.threshold} label={pct(ratio(r.paid, r.budget))} /></div> },
            ]} />
        </div>
      </Card>
    </div>
  );
}
