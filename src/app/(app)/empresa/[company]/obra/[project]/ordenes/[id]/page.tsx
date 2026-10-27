import type { Metadata } from "next";
import { ArrowLeft, CalendarRange, CircleCheck, ClipboardList, FilePlus2, Receipt, Send, XCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PeriodBars } from "@/components/charts";
import { KpiCard } from "@/components/ui/adm-kpi";
import { BatteryBar } from "@/components/ui/battery";
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion";
import { Badge, ButtonLink, Card, CardBody, CardHeader, cn, EmptyState, PageHeader } from "@/components/ui/primitives";
import { EXPENSE_STATUS, monthsBetween, ORDER_STATUS } from "@/lib/calc";
import { date, dateTime, docRef, money, monthLabel, pct, toNum } from "@/lib/format";
import { can } from "@/lib/permissions";
import { getProjectContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { FREQ_LABEL } from "../labels";
import { OrderActions } from "./order-actions";

export const metadata: Metadata = { title: "Detalle de orden" };

const PERIOD_DAYS: Record<string, number> = { semanal: 7, quincenal: 15, mensual: 30 };

export default async function OrdenDetallePage({ params }: { params: Promise<{ company: string; project: string; id: string }> }) {
  const { company, project, id } = await params;
  const ctx = await getProjectContext(company, project);
  const sb = await supabaseServer();
  const base = `/empresa/${company}/obra/${project}`;
  const { data: o } = await sb.from("orders").select("*, supplier:suppliers(name, ruc, bank, account_number), wbs:wbs_nodes(id, code, name), phase:phases(code, name)").eq("id", id).eq("project_id", ctx.project.id).maybeSingle();
  if (!o) notFound();
  const [{ data: items }, { data: inv }, { data: paidRows }, { data: audit }] = await Promise.all([
    sb.from("order_items").select("*").eq("order_id", id),
    sb.from("expenses").select("id, seq, issue_date, doc_type, series, doc_number, description, cost_pen, payable_pen, status, order_override").eq("order_id", id).order("issue_date"),
    sb.from("v_order_balance").select("invoiced_pen, paid_pen, invoices").eq("order_id", id).maybeSingle(),
    sb.from("audit_log").select("action, old_data, new_data, changed_by, changed_at").eq("table_name", "orders").eq("record_id", id).order("changed_at"),
  ]);
  const ids = [o.requested_by, o.approved_by, ...(audit ?? []).map((a) => a.changed_by)].filter(Boolean) as string[];
  const { data: people } = ids.length ? await sb.from("profiles").select("id, full_name").in("id", [...new Set(ids)]) : { data: [] };
  const who = (pid: string | null | undefined) => people?.find((p) => p.id === pid)?.full_name ?? null;

  const supplier = o.supplier as unknown as { name: string; ruc: string; bank: string | null; account_number: string | null } | null;
  const wbs = o.wbs as unknown as { id: string; code: string; name: string } | null;
  const amount = toNum(o.subtotal_pen);
  const invoiced = toNum(paidRows?.invoiced_pen);
  const paid = toNum(paidRows?.paid_pen);
  const live = (inv ?? []).filter((e) => e.status !== "anulado");
  const committed = o.status === "aprobada" ? Math.max(0, amount - invoiced) : 0;

  // Avance del plazo de la orden para comparar contra el consumo
  const s = o.start_date ? new Date(`${o.start_date}T00:00:00`).getTime() : null;
  const en = o.end_date ? new Date(`${o.end_date}T23:59:59`).getTime() : null;
  const elapsedFrac = s && en && en > s ? Math.min(1, Math.max(0, (Date.now() - s) / (en - s))) : undefined;
  const periods = o.start_date && o.end_date && PERIOD_DAYS[o.billing_frequency] ? Math.max(1, Math.round((en! - s!) / 86400000 / PERIOD_DAYS[o.billing_frequency])) : 1;
  const perPeriod = amount / periods;
  const months = o.start_date ? monthsBetween(o.start_date, o.end_date && o.end_date < new Date().toISOString().slice(0, 10) ? o.end_date : new Date().toISOString().slice(0, 10)) : [];
  const byMonth = months.map((m) => ({ key: m, label: monthLabel(m), value: live.filter((e) => e.issue_date.startsWith(m)).reduce((x, e) => x + toNum(e.cost_pen), 0) }));
  const st = ORDER_STATUS[o.status];
  const ratio = amount ? invoiced / amount : 0;

  const events: { at: string; title: string; who?: string | null; tone: string; detail?: string }[] = [
    { at: o.created_at, title: o.status === "solicitada" || o.approved_by !== o.requested_by ? "Orden solicitada" : "Orden emitida", who: who(o.requested_by), tone: "bg-violet-600" },
  ];
  if (o.approved_at) events.push({ at: o.approved_at, title: o.status === "rechazada" ? "Rechazada por Gerencia" : "Aprobada por Gerencia", who: who(o.approved_by), tone: o.status === "rechazada" ? "bg-danger-500" : "bg-brand-green-600" });
  for (const e of live) events.push({ at: `${e.issue_date}T12:00:00`, title: `Factura ${docRef(e)} · ${money(e.cost_pen)}`, tone: "bg-brand-blue", detail: e.order_override ? "Exceso autorizado por Gerencia" : e.description });
  for (const a of audit ?? []) {
    const n = a.new_data as { status?: string }, old = a.old_data as { status?: string } | null;
    if (a.action === "UPDATE" && n.status && n.status !== old?.status && ["cerrada", "anulada"].includes(n.status))
      events.push({ at: a.changed_at, title: n.status === "cerrada" ? "Orden cerrada" : "Orden anulada", who: who(a.changed_by), tone: n.status === "cerrada" ? "bg-slate-500" : "bg-danger-500" });
  }
  events.sort((a, b) => (a.at < b.at ? -1 : 1));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${ctx.project.code} · ${o.order_type === "OS" ? "Orden de servicio" : "Orden de compra"}`}
        title={<span className="flex flex-wrap items-center gap-3">{o.number} <Badge tone={st?.tone}>{st?.label}</Badge></span>}
        description={`${o.title} · ${supplier?.name ?? ""}`}
        actions={
          <>
            <ButtonLink href={`${base}/ordenes`} variant="ghost"><ArrowLeft className="h-4 w-4" />Órdenes</ButtonLink>
            {o.status === "aprobada" && can(ctx.role, "registerExpense") && <ButtonLink href={`${base}/gastos/nuevo?orden=${o.id}`} variant="outline"><FilePlus2 className="h-4 w-4" />Registrar factura</ButtonLink>}
            {can(ctx.role, "approveOrder") && <OrderActions companyCode={company} projectCode={project} id={o.id} status={o.status} hasInvoices={live.length > 0} />}
          </>
        } />

      <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StaggerItem><KpiCard label="Monto global (sin IGV)" value={amount} icon={<ClipboardList className="h-4 w-4" />} tone="navy" sub={`Total con IGV ${money(o.total)}`} /></StaggerItem>
        <StaggerItem><KpiCard label="Facturado" value={invoiced} icon={<Receipt className="h-4 w-4" />} tone="blue" sub={`${live.length} comprobante(s) · ${pct(ratio, 0)}`} /></StaggerItem>
        <StaggerItem><KpiCard label="Pagado por Contabilidad" value={paid} icon={<CircleCheck className="h-4 w-4" />} tone="green" sub={invoiced ? `${pct(paid / invoiced, 0)} de lo facturado` : "—"} /></StaggerItem>
        <StaggerItem><KpiCard label={o.status === "aprobada" ? "Saldo comprometido" : "Saldo de la orden"} value={Math.max(0, amount - invoiced)} icon={<CalendarRange className="h-4 w-4" />} tone="amber" sub={committed ? "Reservado del presupuesto del WBS" : "Sin compromiso vigente"} /></StaggerItem>
      </Stagger>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <FadeIn>
            <Card>
              <CardHeader title="Consumo de la orden" subtitle={`Facturación ${FREQ_LABEL[o.billing_frequency]?.toLowerCase()} · ${date(o.start_date)} → ${date(o.end_date)}`} />
              <CardBody className="space-y-4">
                <BatteryBar value={invoiced} total={amount} size="lg" threshold={0.8} elapsed={elapsedFrac} label={`${money(invoiced)} facturado de ${money(amount)}`} />
                <div className="grid gap-3 text-xs sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-3"><p className="text-ink-muted">Plazo transcurrido</p><p className="num mt-0.5 font-display text-base font-semibold">{elapsedFrac !== undefined ? pct(elapsedFrac, 0) : "—"}</p></div>
                  <div className="rounded-xl bg-slate-50 p-3"><p className="text-ink-muted">Consumo esperado por periodo</p><p className="num mt-0.5 font-display text-base font-semibold">{o.billing_frequency === "unica" ? "—" : money(perPeriod)}</p></div>
                  <div className={cn("rounded-xl p-3", elapsedFrac !== undefined && ratio > elapsedFrac + 0.1 ? "bg-warn-50" : "bg-ok-50")}>
                    <p className="text-ink-muted">Ritmo</p>
                    <p className="mt-0.5 font-display text-sm font-semibold">{elapsedFrac === undefined ? "—" : ratio > elapsedFrac + 0.1 ? "Consume más rápido que el plazo" : "Consumo acorde al plazo"}</p>
                  </div>
                </div>
                {byMonth.length > 1 && <PeriodBars data={byMonth} height={200} color="#035AA6" name="Facturado" />}
              </CardBody>
            </Card>
          </FadeIn>
          <FadeIn delay={0.05}>
            <Card className="overflow-hidden">
              <CardHeader title="Comprobantes vinculados" subtitle="Cada factura descuenta el saldo de la orden" />
              <div className="mt-3">
                {(inv ?? []).length ? (
                  <table className="w-full text-sm">
                    <thead><tr className="bg-slate-50 text-[11px] uppercase tracking-wide text-ink-muted"><th className="px-5 py-2 text-left">Comprobante</th><th className="px-3 py-2 text-left">Fecha</th><th className="px-3 py-2 text-right">Costo</th><th className="hidden px-3 py-2 text-left sm:table-cell">Estado</th></tr></thead>
                    <tbody>
                      {(inv ?? []).map((e) => (
                        <tr key={e.id} className={cn("border-t border-line-soft", e.status === "anulado" && "opacity-50")}>
                          <td className="px-5 py-2.5"><Link href={`${base}/gastos/${e.id}`} className="font-semibold text-brand-blue hover:underline">{docRef(e)}</Link><p className="max-w-[260px] truncate text-[11px] text-ink-muted">{e.description}</p></td>
                          <td className="num px-3 py-2.5 text-xs">{date(e.issue_date)}</td>
                          <td className="num px-3 py-2.5 text-right font-semibold">{money(e.cost_pen)}</td>
                          <td className="hidden px-3 py-2.5 sm:table-cell"><Badge tone={EXPENSE_STATUS[e.status]?.tone}>{EXPENSE_STATUS[e.status]?.label}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <div className="p-5"><EmptyState title="Sin facturas aún" description="El monto completo de la orden figura como comprometido en el WBS." /></div>}
              </div>
            </Card>
          </FadeIn>
        </div>

        <div className="space-y-5">
          <FadeIn>
            <Card>
              <CardHeader title="Detalle" />
              <CardBody className="space-y-3 text-sm">
                <Row k="Proveedor" v={<>{supplier?.name}<span className="block text-[11px] font-normal text-ink-muted">RUC {supplier?.ruc}{supplier?.bank ? ` · ${supplier.bank} ${supplier.account_number ?? ""}` : ""}</span></>} />
                <Row k="WBS" v={wbs ? <Link className="text-brand-blue hover:underline" href={`${base}/presupuesto/${wbs.id}`}>{wbs.code} · {wbs.name}</Link> : "—"} />
                <Row k="Fase" v={(o.phase as unknown as { name: string } | null)?.name ?? "—"} />
                <Row k="Moneda" v={o.currency === "USD" ? `Dólares · TC ${toNum(o.exchange_rate).toFixed(3)}` : `Soles${o.includes_igv ? " · afecto a IGV" : ""}`} />
                {o.description && <p className="rounded-xl bg-slate-50 p-3 text-xs text-ink-soft">{o.description}</p>}
                {o.notes && <p className="whitespace-pre-line rounded-xl bg-warn-50 p-3 text-xs text-[#7a4300]">{o.notes}</p>}
              </CardBody>
            </Card>
          </FadeIn>
          <FadeIn delay={0.05}>
            <Card>
              <CardHeader title="Ítems" />
              <CardBody className="space-y-2">
                {(items ?? []).map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-3 rounded-xl border border-line-soft px-3 py-2">
                    <div className="min-w-0"><p className="truncate text-sm font-semibold">{i.description}</p><p className="num text-[11px] text-ink-muted">{toNum(i.quantity).toLocaleString("es-PE")} {i.unit} × {money(i.unit_price)}</p></div>
                    <p className="num shrink-0 font-semibold">{money(i.total)}</p>
                  </div>
                ))}
              </CardBody>
            </Card>
          </FadeIn>
          <FadeIn delay={0.1}>
            <Card>
              <CardHeader title="Trazabilidad" icon={<Send className="h-4 w-4" />} />
              <CardBody>
                <ol className="relative space-y-4 border-l-2 border-line-soft pl-6">
                  {events.map((ev, i) => (
                    <li key={i} className="relative">
                      <span className={cn("absolute -left-[31px] h-4 w-4 rounded-full ring-4 ring-white", ev.tone)} />
                      <p className="text-sm font-semibold">{ev.title}</p>
                      <p className="text-[11px] text-ink-muted">{dateTime(ev.at)}{ev.who ? ` · ${ev.who}` : ""}</p>
                      {ev.detail && <p className="mt-0.5 text-xs text-ink-soft">{ev.detail}</p>}
                    </li>
                  ))}
                  {o.status === "rechazada" && <li className="relative"><span className="absolute -left-[31px] grid h-4 w-4 place-items-center rounded-full bg-danger-500 ring-4 ring-white"><XCircle className="h-3 w-3 text-white" /></span><p className="text-sm text-ink-muted">Sin compromiso presupuestal.</p></li>}
                </ol>
              </CardBody>
            </Card>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-4"><span className="shrink-0 text-ink-muted">{k}</span><span className="text-right font-semibold text-ink">{v}</span></div>;
}
