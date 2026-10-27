import type { Metadata } from "next";
import { Percent, Receipt, TrendingDown, TrendingUp } from "lucide-react";
import { KpiCard } from "@/components/ui/cont-kit";
import { PageHeader } from "@/components/ui/primitives";
import { monthsBetween } from "@/lib/calc";
import { pct, toNum, todayISO } from "@/lib/format";
import { getProjectContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { ResultsView, type IgvMonth, type MonthResult } from "./_components/results-view";

export const metadata: Metadata = { title: "Estado de resultados" };

const VALUED = ["aprobada", "facturada", "cobrada_parcial", "cobrada"];
const INVOICED = ["facturada", "cobrada_parcial", "cobrada"];
const TAX = 0.295;
const r2 = (n: number) => Math.round(n * 100) / 100;

export default async function ResultadosPage({ params, searchParams }: { params: Promise<{ company: string; project: string }>; searchParams: Promise<{ mes?: string }> }) {
  const { company, project } = await params;
  const sp = await searchParams;
  const ctx = await getProjectContext(company, project);
  const sb = await supabaseServer();
  const pid = ctx.project.id;

  const [{ data: vals }, { data: exps }] = await Promise.all([
    sb.from("valuations").select("approved_amount, period_end, invoice_date, status").eq("project_id", pid),
    sb.from("expenses").select("issue_date, cost_pen, subtotal, igv, exchange_rate, doc_type, tax_condition, wbs:wbs_nodes(cost_type)")
      .eq("project_id", pid).not("status", "in", "(borrador,anulado)").limit(5000),
  ]);

  const today = todayISO();
  const start = ctx.project.start_date ?? today;
  const end = today < start ? start : today;
  const months = monthsBetween(start, end);

  const rows: MonthResult[] = months.map((m) => {
    const ventas = (vals ?? []).filter((v) => VALUED.includes(v.status) && (v.period_end ?? "").startsWith(m)).reduce((s, v) => s + toNum(v.approved_amount), 0);
    let directo = 0, gg = 0;
    (exps ?? []).filter((e) => e.issue_date.startsWith(m)).forEach((e) => {
      const ct = (e.wbs as unknown as { cost_type: string | null } | null)?.cost_type;
      if (ct === "gastos_generales") gg += toNum(e.cost_pen); else directo += toNum(e.cost_pen);
    });
    const bruta = ventas - directo;
    const uai = bruta - gg;
    const imp = Math.max(0, uai) * TAX;
    return { month: m, ventas: r2(ventas), directo: r2(directo), bruta: r2(bruta), gg: r2(gg), uai: r2(uai), impuesto: r2(imp), neta: r2(uai - imp) };
  });

  // Liquidación mensual estimada de IGV (régimen general · referencial por obra)
  let carry = 0;
  const igv: IgvMonth[] = months.map((m) => {
    const ventasBase = (vals ?? []).filter((v) => INVOICED.includes(v.status) && (v.invoice_date ?? "").startsWith(m)).reduce((s, v) => s + toNum(v.approved_amount), 0);
    let comprasBase = 0, comprasIgv = 0, noGravadas = 0;
    (exps ?? []).filter((e) => e.issue_date.startsWith(m) && e.doc_type !== "PL").forEach((e) => {
      const tc = toNum(e.exchange_rate) || 1;
      if (e.doc_type === "FT" && e.tax_condition === "gravado") { comprasBase += toNum(e.subtotal) * tc; comprasIgv += toNum(e.igv) * tc; }
      else noGravadas += toNum(e.cost_pen);
    });
    const ventasIgv = ventasBase * 0.18;
    const resultante = ventasIgv - comprasIgv;
    const anterior = carry;
    const saldo = resultante - anterior;
    carry = saldo < 0 ? -saldo : 0;
    return { month: m, ventasBase: r2(ventasBase), ventasIgv: r2(ventasIgv), comprasBase: r2(comprasBase), comprasIgv: r2(comprasIgv), noGravadas: r2(noGravadas),
      resultante: r2(resultante), anterior: r2(anterior), porPagar: r2(Math.max(0, saldo)), credito: r2(Math.max(0, -saldo)) };
  });

  const acc = rows.reduce((a, r) => ({ ventas: a.ventas + r.ventas, directo: a.directo + r.directo, gg: a.gg + r.gg }), { ventas: 0, directo: 0, gg: 0 });
  const uai = acc.ventas - acc.directo - acc.gg;
  const neta = uai - Math.max(0, uai) * TAX;
  const selected = sp.mes && months.includes(sp.mes) ? sp.mes : months[months.length - 1];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`${ctx.project.code} · Contabilidad`} title="Estado de resultados de la obra"
        description="Ventas (valorizado aprobado) menos el costo directo y los gastos generales cargados a la obra, por mes y acumulado. Impuesto a la renta (29.5%) e IGV estimados con fines de gestión." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Ventas acumuladas" value={acc.ventas} tone="blue" icon={<Receipt className="h-4 w-4" />} sub="Valorizado aprobado sin IGV" />
        <KpiCard label="Costo total (directo + GG)" value={acc.directo + acc.gg} tone="amber" icon={<TrendingDown className="h-4 w-4" />} sub={`GG: ${pct(acc.directo + acc.gg ? acc.gg / (acc.directo + acc.gg) : 0)} del costo`} />
        <KpiCard label="Utilidad neta estimada" value={neta} tone={neta >= 0 ? "green" : "red"} icon={<TrendingUp className="h-4 w-4" />} sub={`Antes de impuestos: S/ ${uai.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
        <KpiCard label="Margen neto" value={acc.ventas ? neta / acc.ventas : 0} format="pct" tone={neta >= 0 ? "navy" : "red"} icon={<Percent className="h-4 w-4" />} sub={`Margen bruto ${pct(acc.ventas ? (acc.ventas - acc.directo) / acc.ventas : 0)}`} />
      </div>
      <ResultsView rows={rows} igv={igv} selected={selected} companyName={ctx.company.legal_name ?? ctx.company.name}
        meta={{ filename: `estado-resultados-${ctx.project.code}`, company: ctx.company.legal_name ?? ctx.company.name, project: `${ctx.project.code} · ${ctx.project.name}`, user: ctx.profile.full_name }} />
    </div>
  );
}
