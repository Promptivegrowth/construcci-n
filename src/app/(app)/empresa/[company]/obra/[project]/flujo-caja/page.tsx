import type { Metadata } from "next";
import { ArrowDownRight, ArrowUpRight, Landmark, Scale } from "lucide-react";
import { KpiCard } from "@/components/ui/cont-kit";
import { FilterBar, UrlSegment } from "@/components/ui/filters";
import { PageHeader } from "@/components/ui/primitives";
import { monthLabel, toNum, todayISO } from "@/lib/format";
import { getProjectContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { CashFlowView, type FlowPeriod, type ValuationBlock } from "./_components/cashflow-view";

export const metadata: Metadata = { title: "Flujo de caja" };

function mondayOf(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export default async function FlujoCajaPage({ params, searchParams }: { params: Promise<{ company: string; project: string }>; searchParams: Promise<{ vista?: string }> }) {
  const { company, project } = await params;
  const vista = (await searchParams).vista === "semana" ? "semana" : "mes";
  const ctx = await getProjectContext(company, project);
  const sb = await supabaseServer();
  const pid = ctx.project.id;

  const [{ data: colls }, { data: pays }] = await Promise.all([
    sb.from("collections").select("amount, collected_at, operation_number, valuation:valuations(number, invoice_number)").eq("project_id", pid).order("collected_at").limit(2000),
    sb.from("payments").select("amount_pen, paid_at, expense:expenses(category, description, doc_type, supplier:suppliers(name))").eq("project_id", pid).eq("voided", false).order("paid_at").limit(5000),
  ]);

  const ins = (colls ?? []).map((c) => ({ date: c.collected_at, amount: toNum(c.amount), val: (c.valuation as unknown as { number: number; invoice_number: string | null } | null) }));
  const outs = (pays ?? []).map((p) => {
    const e = p.expense as unknown as { category: string | null; description: string; doc_type: string; supplier: { name: string } | null } | null;
    const cat = e?.doc_type === "PL" ? (e.category?.includes("STAFF") ? "Planilla staff" : "Planilla de obreros") : e?.supplier?.name ?? e?.category ?? "Otros";
    return { date: p.paid_at, amount: toNum(p.amount_pen), cat };
  });

  const keyOf = (d: string) => (vista === "semana" ? mondayOf(d) : d.slice(0, 7));
  const keys = new Set<string>([...ins.map((x) => keyOf(x.date)), ...outs.map((x) => keyOf(x.date))]);
  const sorted = [...keys].sort();
  let acc = 0;
  const periods: FlowPeriod[] = sorted.map((k) => {
    const i = ins.filter((x) => keyOf(x.date) === k).reduce((s, x) => s + x.amount, 0);
    const o = outs.filter((x) => keyOf(x.date) === k).reduce((s, x) => s + x.amount, 0);
    acc += i - o;
    return { key: k, label: vista === "semana" ? `Sem ${ddmm(k)}` : monthLabel(k), ingresos: Math.round(i * 100) / 100, egresos: Math.round(o * 100) / 100, neto: Math.round((i - o) * 100) / 100, saldo: Math.round(acc * 100) / 100 };
  });

  // Cuadro por valorización (hoja DATA del cliente)
  const blocks: ValuationBlock[] = [];
  let prev = "0000-00-00";
  let balance = 0;
  for (const c of ins) {
    const period = outs.filter((o) => o.date > prev && o.date <= c.date);
    const byCat = new Map<string, number>();
    period.forEach((o) => byCat.set(o.cat, (byCat.get(o.cat) ?? 0) + o.amount));
    const items = [...byCat.entries()].map(([label, amount]) => ({ label, amount: Math.round(amount * 100) / 100 })).sort((a, b) => b.amount - a.amount);
    const egresos = items.reduce((s, x) => s + x.amount, 0);
    balance += c.amount - egresos;
    blocks.push({ date: c.date, number: c.val?.number ?? null, invoice: c.val?.invoice_number ?? null, ingreso: c.amount, items, egresos, saldo: Math.round(balance * 100) / 100, from: prev === "0000-00-00" ? null : prev });
    prev = c.date;
  }

  const totIn = ins.reduce((s, x) => s + x.amount, 0);
  const totOut = outs.reduce((s, x) => s + x.amount, 0);
  const month = todayISO().slice(0, 7);
  const monthNet = ins.filter((x) => x.date.startsWith(month)).reduce((s, x) => s + x.amount, 0) - outs.filter((x) => x.date.startsWith(month)).reduce((s, x) => s + x.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`${ctx.project.code} · Contabilidad`} title="Flujo de caja de la obra"
        description="Ingresos por cobro de valorizaciones (con IGV) contra egresos pagados por Contabilidad, con el saldo en cuenta acumulado. Caja independiente por obra." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Ingresos cobrados" value={totIn} tone="green" icon={<ArrowDownRight className="h-4 w-4" />} sub={`${ins.length} abonos de valorizaciones`} />
        <KpiCard label="Egresos pagados" value={totOut} tone="amber" icon={<ArrowUpRight className="h-4 w-4" />} sub={`${outs.length} pagos registrados`} />
        <KpiCard label="Saldo en cuenta" value={totIn - totOut} tone={totIn - totOut >= 0 ? "blue" : "red"} icon={<Landmark className="h-4 w-4" />} sub="Cobrado − pagado acumulado" />
        <KpiCard label="Neto del mes" value={monthNet} tone={monthNet >= 0 ? "navy" : "red"} icon={<Scale className="h-4 w-4" />} sub="Ingresos − egresos del mes en curso" />
      </div>
      <FilterBar>
        <UrlSegment name="vista" options={[{ value: "mes", label: "Por mes" }, { value: "semana", label: "Por semana" }]} />
        <span className="text-xs text-ink-muted">{periods.length} periodos con movimiento</span>
      </FilterBar>
      <CashFlowView periods={periods} blocks={blocks} vista={vista}
        meta={{ filename: `flujo-caja-${ctx.project.code}`, company: ctx.company.legal_name ?? ctx.company.name, project: `${ctx.project.code} · ${ctx.project.name}`, user: ctx.profile.full_name }} />
    </div>
  );
}
