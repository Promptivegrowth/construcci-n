import type { Metadata } from "next";
import { COST_TYPE_LABEL, buildTree, conciliation, elapsed, flatten, fortnightOf, fortnightLabel, monthsBetween, projectEnd, ratio, sCurve, totals, VALUED_STATUS } from "@/lib/calc";
import { monthLabel, todayISO, toNum } from "@/lib/format";
import { getDeclaredSeries, getPaymentsSeries, getPhases, getWbsStats } from "@/lib/queries";
import { redirect } from "next/navigation";
import { canView } from "@/lib/permissions";
import { getProjectContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { Executive, type ExecutiveData } from "./_components/executive";

export async function generateMetadata({ params }: { params: Promise<{ project: string }> }): Promise<Metadata> {
  const { project } = await params;
  return { title: `Resumen ejecutivo ${decodeURIComponent(project)}` };
}

export default async function ProjectSummaryPage({ params }: { params: Promise<{ company: string; project: string }> }) {
  const { company, project: code } = await params;
  const ctx = await getProjectContext(company, code);
  // El resumen ejecutivo es financiero: Almacén entra directo a su kardex
  if (!canView(ctx.role, "finance")) redirect(`/empresa/${company}/obra/${code}/almacen`);
  const p = ctx.project;
  const sb = await supabaseServer();
  const [stats, phases, pays, declared, { data: vals }, { data: colls }, { data: alerts }] = await Promise.all([
    getWbsStats(p.id), getPhases(p.id), getPaymentsSeries(p.id), getDeclaredSeries(p.id),
    sb.from("valuations").select("number, approved_amount, presented_amount, status, phase_id").eq("project_id", p.id),
    sb.from("collections").select("amount, collected_at").eq("project_id", p.id),
    sb.from("alerts").select("id, title, message, severity, alert_type, entity_id, created_at").eq("project_id", p.id).eq("resolved", false)
      .order("severity").order("created_at", { ascending: false }).limit(8),
  ]);

  const t = totals(stats);
  const leaves = stats.filter((s) => s.is_leaf);
  const today = todayISO();
  const el = elapsed(p);
  const end = projectEnd(p) ?? today;
  const start = p.start_date ?? today;

  // Curva S por quincenas: proyectado (S) vs. real pagado vs. declarado por obra
  const fortnights: { key: string; endDate: string }[] = [];
  for (const m of monthsBetween(start, end)) {
    const [y, mo] = m.split("-").map(Number);
    const last = new Date(y, mo, 0).getDate();
    fortnights.push({ key: `${m}-Q1`, endDate: `${m}-15` }, { key: `${m}-Q2`, endDate: `${m}-${String(last).padStart(2, "0")}` });
  }
  const span = Math.max(1, new Date(`${end}T12:00:00`).getTime() - new Date(`${start}T12:00:00`).getTime());
  let accP = 0, accD = 0, iP = 0, iD = 0;
  const sortedPays = [...pays].sort((a, b) => (a.date < b.date ? -1 : 1));
  const sortedDecl = [...declared].sort((a, b) => (a.date < b.date ? -1 : 1));
  const curve = fortnights.map((f) => {
    while (iP < sortedPays.length && sortedPays[iP].date <= f.endDate) accP += sortedPays[iP++].cost;
    while (iD < sortedDecl.length && sortedDecl[iD].date <= f.endDate) { if (sortedDecl[iD].origin !== "lima") accD += sortedDecl[iD].cost; iD++; }
    const x = (new Date(`${f.endDate}T12:00:00`).getTime() - new Date(`${start}T12:00:00`).getTime()) / span;
    const past = f.endDate.slice(0, 7) <= today.slice(0, 7) && (f.endDate <= today || fortnightOf(today) === f.key);
    return { label: fortnightLabel(f.key), date: f.endDate, projected: Math.round(t.budget * sCurve(x)), paid: past ? Math.round(accP) : null, declared: past ? Math.round(accD) : null };
  });
  const todayLabel = fortnightLabel(fortnightOf(today));

  // Gasto pagado por mes
  const months = monthsBetween(start, today < end ? today : end);
  const byMonth = new Map<string, number>();
  pays.forEach((x) => byMonth.set(x.date.slice(0, 7), (byMonth.get(x.date.slice(0, 7)) ?? 0) + x.cost));
  const declByMonth = new Map<string, number>();
  declared.forEach((x) => declByMonth.set(x.date.slice(0, 7), (declByMonth.get(x.date.slice(0, 7)) ?? 0) + x.cost));
  const monthly = months.map((m) => ({ key: m, label: monthLabel(m), value: Math.round(byMonth.get(m) ?? 0), secondary: Math.round(declByMonth.get(m) ?? 0) }));

  // Control por fase
  const phaseRows = phases.map((ph) => {
    const ls = leaves.filter((l) => l.phase_id === ph.id);
    const budget = ls.reduce((s, l) => s + l.budget, 0);
    const paid = pays.filter((x) => x.phase_id === ph.id).reduce((s, x) => s + x.cost, 0);
    const valued = (vals ?? []).filter((v) => v.phase_id === ph.id && VALUED_STATUS.includes(v.status)).reduce((s, v) => s + toNum(v.approved_amount), 0);
    return { id: ph.id, code: ph.code, name: ph.name, color: ph.color, budget, paid, sale: ph.sale_amount, valued, cpi: paid > 0 ? valued / paid : null };
  });
  const unphased = leaves.filter((l) => !l.phase_id);
  const generalBudget = unphased.reduce((s, l) => s + l.budget, 0);

  // Gasto pagado por tipo de costo
  const byType = new Map<string, number>();
  leaves.forEach((l) => byType.set(l.cost_type ?? "otros", (byType.get(l.cost_type ?? "otros") ?? 0) + l.paid));

  // WBS de primer nivel con conciliación
  const tree = buildTree(stats);
  const level1 = tree.map((n) => ({
    id: n.wbs_id, code: n.code, name: n.name, budget: n.budget, paid: n.paid, declared: n.declared, committed: n.committed,
    state: conciliation(n.declared, n.paid), leaves: flatten(n.children).filter((c) => c.is_leaf).length || 1,
  }));
  const critical = leaves.filter((l) => l.budget > 0).map((l) => ({ id: l.wbs_id, code: l.code, name: l.name, budget: l.budget, paid: l.paid, r: ratio(l.paid, l.budget) }))
    .sort((a, b) => b.r - a.r).slice(0, 6);

  const valued = (vals ?? []).filter((v) => VALUED_STATUS.includes(v.status)).reduce((s, v) => s + toNum(v.approved_amount), 0);
  const collected = (colls ?? []).reduce((s, c) => s + toNum(c.amount), 0);

  const data: ExecutiveData = {
    project: { id: p.id, code: p.code, name: p.name, client: p.client_name, location: `${p.location}, ${p.region}`, status: p.status, start: p.start_date, end: p.end_date,
      extended: p.extended_end_date, contract: toNum(p.contract_amount), threshold: p.alert_threshold / 100, tc: toNum(p.exchange_rate) },
    company: ctx.company.tagline ?? ctx.company.name,
    companyCode: ctx.company.code,
    user: ctx.profile.full_name,
    role: ctx.role,
    totals: t, elapsed: el, valued, collected,
    curve, todayLabel, monthly,
    phases: phaseRows, generalBudget,
    costTypes: [...byType.entries()].filter(([, v]) => v > 0).map(([k, v]) => ({ name: COST_TYPE_LABEL[k] ?? k, value: v })).sort((a, b) => b.value - a.value),
    level1, critical,
    alerts: (alerts ?? []).map((a) => ({ ...a })),
  };
  return <Executive data={data} />;
}
