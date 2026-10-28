import type { Metadata } from "next";
import { ArrowLeft, Banknote, Building2, CalendarDays, CircleCheck, FilePlus2, FileX2, HardHat, Link2, MapPin, MessageSquareWarning, Scale, Send, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BatteryBar } from "@/components/ui/battery";
import { FadeIn } from "@/components/ui/motion";
import { Badge, ButtonLink, Card, CardBody, CardHeader, cn, PageHeader, Stat } from "@/components/ui/primitives";
import { CONCILIATION_LABEL, CONCILIATION_TONE, conciliation, EXPENSE_STATUS, LABOR_LABEL } from "@/lib/calc";
import { date, dateTime, DOC_TYPE_LABEL, docRef, money, pct, toNum } from "@/lib/format";
import { can, type Role, canView } from "@/lib/permissions";
import { getProjectContext } from "@/lib/session";
import { signedUrls } from "@/lib/storage";
import { supabaseServer } from "@/lib/supabase/server";
import { EvidenceViewer } from "./evidence-viewer";
import { ExpenseActions } from "./expense-actions";
import { NoAccess } from "@/components/ui/no-access";

export const metadata: Metadata = { title: "Detalle del comprobante" };

type Event = { at: string; title: string; detail?: string; who?: string | null; tone: "blue" | "green" | "violet" | "amber" | "red" | "gray" | "navy"; icon: "reg" | "send" | "ok" | "obs" | "void" | "pay" | "conc" };

export default async function GastoDetallePage({ params }: { params: Promise<{ company: string; project: string; id: string }> }) {
  const { company, project, id } = await params;
  const ctx = await getProjectContext(company, project);
  if (!canView(ctx.role, "finance")) return <NoAccess role={ctx.role} area="finance" back={`/empresa/${company}/obra/${project}`} backLabel="Volver a la obra" />;
  const sb = await supabaseServer();
  const base = `/empresa/${company}/obra/${project}`;

  const { data: e } = await sb.from("expenses")
    .select("*, supplier:suppliers(name, ruc, kind, bank, account_number), wbs:wbs_nodes(id, code, name), phase:phases(code, name), ord:orders(id, number, title, subtotal_pen)")
    .eq("id", id).eq("project_id", ctx.project.id).maybeSingle();
  if (!e) notFound();

  const [{ data: alloc }, { data: files }, { data: pays }, { data: audit }, { data: payroll }] = await Promise.all([
    sb.from("expense_allocations").select("id, amount_pen, wbs:wbs_nodes(id, code, name)").eq("expense_id", id),
    sb.from("expense_files").select("*").eq("expense_id", id).order("created_at"),
    sb.from("payments").select("*").eq("expense_id", id).order("paid_at"),
    sb.from("audit_log").select("action, old_data, new_data, changed_by, changed_at").eq("table_name", "expenses").eq("record_id", id).order("changed_at"),
    sb.from("payrolls").select("id, period_label, week, payroll_lines(category, workers, days, amount)").eq("expense_id", id).maybeSingle(),
  ]);
  const wbsIds = [...new Set((alloc ?? []).map((a) => (a.wbs as unknown as { id: string }).id))];
  const { data: stats } = await sb.from("v_wbs_stats").select("wbs_id, budget, declared, paid, registered").in("wbs_id", wbsIds.length ? wbsIds : ["00000000-0000-0000-0000-000000000000"]);

  const actorIds = [e.created_by, e.approved_by, e.voided_by, ...(pays ?? []).map((p) => p.registered_by), ...(audit ?? []).map((a) => a.changed_by)].filter(Boolean) as string[];
  const { data: people } = await sb.from("profiles").select("id, full_name").in("id", actorIds.length ? [...new Set(actorIds)] : ["00000000-0000-0000-0000-000000000000"]);
  const who = (pid: string | null | undefined) => (pid ? people?.find((p) => p.id === pid)?.full_name ?? "Usuario" : null);
  const urls = await signedUrls((files ?? []).map((f) => f.file_path));

  const supplier = e.supplier as unknown as { name: string; ruc: string; kind: string; bank: string | null; account_number: string | null } | null;
  const wbs = e.wbs as unknown as { id: string; code: string; name: string } | null;
  const phase = e.phase as unknown as { code: string; name: string } | null;
  const ord = e.ord as unknown as { id: string; number: string; title: string; subtotal_pen: number } | null;
  const livePays = (pays ?? []).filter((p) => !p.voided);
  const paid = livePays.reduce((s, p) => s + toNum(p.amount_pen), 0);
  const payable = toNum(e.payable_pen);
  const st = EXPENSE_STATUS[e.status];

  // Línea de tiempo: registro → declaración → aprobación/observación → pagos → conciliación
  const events: Event[] = [{ at: e.created_at, title: e.origin === "lima" ? "Registrado en Lima (pago central)" : e.origin === "campo" ? "Registrado desde la app de campo" : "Registrado por la obra", who: who(e.created_by), tone: "navy", icon: "reg" }];
  // Hitos desde los campos del comprobante + observaciones/re-declaraciones desde la auditoría
  if (e.declared_at && e.status !== "borrador") events.push({ at: e.declared_at, title: "Declarado y enviado a aprobación", tone: "violet", icon: "send", who: who(e.created_by) });
  let observed = false;
  for (const a of (audit ?? []).filter((x) => x.action === "UPDATE")) {
    const o = a.old_data as { status?: string }, n = a.new_data as { status: string; observation?: string };
    if (o?.status === n.status) continue;
    if (n.status === "observado") { observed = true; events.push({ at: a.changed_at, title: "Observado por Gerencia", tone: "amber", icon: "obs", who: who(a.changed_by), detail: n.observation }); }
    else if (n.status === "declarado" && observed) events.push({ at: a.changed_at, title: "Corregido y declarado nuevamente", tone: "violet", icon: "send", who: who(a.changed_by) });
  }
  if (!observed && e.status === "observado") events.push({ at: e.updated_at, title: "Observado por Gerencia", tone: "amber", icon: "obs", detail: e.observation ?? undefined });
  if (e.approved_at) events.push({ at: e.approved_at, title: "Aprobado por Gerencia · pasa a Contabilidad", tone: "green", icon: "ok", who: who(e.approved_by) });
  if (e.voided_at) events.push({ at: e.voided_at, title: "Anulado", tone: "red", icon: "void", who: who(e.voided_by), detail: e.void_reason ?? undefined });
  for (const p of pays ?? []) {
    events.push({ at: p.created_at && p.created_at > p.paid_at ? p.created_at : `${p.paid_at}T12:00:00`, title: p.voided ? `Pago anulado · ${money(p.amount_pen)}` : `Pago registrado por Contabilidad · ${money(p.amount_pen)} (${pct(toNum(p.percentage) / 100, 0)})`,
      detail: `${p.method}${p.bank ? ` · ${p.bank}` : ""}${p.operation_number ? ` · Op. ${p.operation_number}` : ""} · ${date(p.paid_at)}`, who: who(p.registered_by), tone: p.voided ? "red" : "blue", icon: "pay" });
  }
  if (e.status === "pagado") events.push({ at: livePays.at(-1)?.created_at ?? e.updated_at, title: "Conciliado · declarado = pagado", detail: "La barra de consumo del WBS refleja el pago completo.", tone: "green", icon: "conc" });
  events.sort((a, b) => (a.at < b.at ? -1 : 1));

  const statRow = (stats ?? []).find((s) => s.wbs_id === wbs?.id);
  const conc = statRow ? conciliation(toNum(statRow.declared), toNum(statRow.paid)) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${ctx.project.code} · Comprobante N° ${e.seq}`}
        title={<span className="flex flex-wrap items-center gap-3">{DOC_TYPE_LABEL[e.doc_type]} {docRef(e)} <Badge tone={st?.tone}>{st?.label}</Badge></span>}
        description={`${supplier?.name ?? "—"} · RUC ${supplier?.ruc ?? "—"}`}
        actions={
          <>
            <ButtonLink href={`${base}/gastos`} variant="ghost"><ArrowLeft className="h-4 w-4" />Gastos</ButtonLink>
            <ExpenseActions companyCode={company} projectCode={project} id={id} status={e.status} docType={e.doc_type}
              canApprove={can(ctx.role, "approveExpense")} canRegister={can(ctx.role, "registerExpense")} canPay={can(ctx.role as Role, "registerPayment")}
              hasFiles={(files?.length ?? 0) > 0} hasPayments={livePays.length > 0} />
          </>
        }
      />

      {e.status === "observado" && e.observation && (
        <div className="flex gap-3 rounded-2xl border border-warn/30 bg-warn-50 p-4 text-sm text-[#7a4300]">
          <MessageSquareWarning className="h-5 w-5 shrink-0" /><div><p className="font-semibold">Observación de Gerencia</p><p>{e.observation}</p></div>
        </div>
      )}
      {e.status === "anulado" && (
        <div className="flex gap-3 rounded-2xl border border-danger/20 bg-danger-50 p-4 text-sm text-danger">
          <FileX2 className="h-5 w-5 shrink-0" /><div><p className="font-semibold">Comprobante anulado el {dateTime(e.voided_at)} por {who(e.voided_by)}</p><p>{e.void_reason}</p></div>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <FadeIn>
            <Card>
              <CardHeader title="Importes" subtitle={e.currency === "USD" ? `Comprobante en dólares · TC ${toNum(e.exchange_rate).toFixed(3)}` : "Comprobante en soles"} />
              <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Stat label={`Total ${e.currency === "USD" ? "(US$)" : ""}`} value={e.currency === "USD" ? `US$ ${toNum(e.total).toLocaleString("es-PE", { minimumFractionDigits: 2 })}` : money(e.total)} />
                <Stat label="Base imponible" value={money(toNum(e.subtotal) * toNum(e.exchange_rate))} />
                <Stat label="IGV" value={money(toNum(e.igv) * toNum(e.exchange_rate))} />
                <Stat label="Costo cargado al presupuesto" value={<span className="text-brand-blue">{money(e.cost_pen)}</span>} />
                <Stat label={`Fondo de garantía (${toNum(e.retention_pct)}%)`} value={money(e.retention_pen)} />
                <Stat label="Monto a pagar" value={money(payable)} />
              </CardBody>
              <div className="border-t border-line-soft px-5 py-4">
                <BatteryBar value={paid} total={payable} label={`Pagado ${money(paid)} de ${money(payable)} · saldo ${money(Math.max(0, payable - paid))}`} threshold={1.01} />
              </div>
            </Card>
          </FadeIn>

          <FadeIn delay={0.05}>
            <Card>
              <CardHeader title="Datos del comprobante" />
              <CardBody className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                <Info icon={<Building2 className="h-4 w-4" />} label="Proveedor" value={supplier?.name} sub={`RUC ${supplier?.ruc}${supplier?.bank ? ` · ${supplier.bank} ${supplier.account_number ?? ""}` : ""}`} />
                <Info icon={<CalendarDays className="h-4 w-4" />} label="Fechas" value={`Emisión ${date(e.issue_date)}`} sub={`Recepción ${date(e.reception_date)} · Vence ${date(e.due_date)} · Semana de obra ${e.week ?? "—"}`} />
                <Info icon={<HardHat className="h-4 w-4" />} label="Fase y WBS" value={`${phase?.code ?? "—"} · ${wbs?.code ?? ""} ${wbs?.name ?? ""}`} sub={phase?.name} />
                <Info icon={<Link2 className="h-4 w-4" />} label="Orden asociada" value={ord ? <Link href={`${base}/ordenes/${ord.id}`} className="text-brand-blue hover:underline">{ord.number} · {ord.title}</Link> : "Sin orden"} sub={e.order_override ? "Exceso autorizado por Gerencia" : undefined} />
                <Info icon={<FilePlus2 className="h-4 w-4" />} label="Tipo de gasto" value={e.category ?? "—"} sub={`Origen: ${e.origin === "lima" ? "Lima (central)" : e.origin === "campo" ? "App de campo" : "Obra"} · ${e.tax_condition === "gravado" ? "Gravado" : e.tax_condition === "exonerado" ? "Exonerado" : "No gravado"}`} />
                <Info icon={<MapPin className="h-4 w-4" />} label="Ubicación del registro" value={e.lat ? <a className="text-brand-blue hover:underline" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${e.lat},${e.lng}`}>{Number(e.lat).toFixed(5)}, {Number(e.lng).toFixed(5)}</a> : "—"} />
                <div className="sm:col-span-2">
                  <p className="text-[11px] font-medium text-ink-muted">Descripción</p>
                  <p className="mt-0.5 text-ink">{e.description}</p>
                  {e.exceeds_budget && <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-danger-50 px-2.5 py-1 text-xs font-semibold text-danger">Deja el WBS en negativo · requiere aprobación de Gerencia</p>}
                </div>
              </CardBody>
            </Card>
          </FadeIn>

          <FadeIn delay={0.1}>
            <Card>
              <CardHeader title="Distribución en el presupuesto" subtitle={(alloc?.length ?? 0) > 1 ? "Comprobante distribuido entre subcategorías (sin duplicar)" : "Costo cargado al WBS"} icon={<Scale className="h-4 w-4" />}
                actions={conc && <Badge tone={CONCILIATION_TONE[conc]}>{CONCILIATION_LABEL[conc]}</Badge>} />
              <CardBody className="space-y-4">
                {(alloc ?? []).map((a) => {
                  const w = a.wbs as unknown as { id: string; code: string; name: string };
                  const s = (stats ?? []).find((x) => x.wbs_id === w.id);
                  return (
                    <div key={a.id}>
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                        <Link href={`${base}/presupuesto/${w.id}`} className="font-semibold text-ink hover:text-brand-blue"><span className="text-brand-blue">{w.code}</span> {w.name}</Link>
                        <span className="num font-semibold">{money(a.amount_pen)}</span>
                      </div>
                      {s && <BatteryBar value={toNum(s.paid)} total={toNum(s.budget)} size="sm" label={`Pagado ${money(s.paid)} de ${money(s.budget)} · declarado ${money(s.declared)}`} />}
                    </div>
                  );
                })}
              </CardBody>
            </Card>
          </FadeIn>

          {payroll && (
            <Card>
              <CardHeader title={`Resumen de planilla · ${payroll.period_label}`} subtitle="Distribución del costo por categoría (registro de costo)" />
              <CardBody className="space-y-2">
                {((payroll.payroll_lines ?? []) as { category: string; workers: number; days: number | null; amount: number }[]).map((l) => (
                  <div key={l.category} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                    <span className="font-semibold">{LABOR_LABEL[l.category] ?? l.category} <span className="font-normal text-ink-muted">· {l.workers} trabajador(es)</span></span>
                    <span className="num font-semibold">{money(l.amount)}</span>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <FadeIn>
            <EvidenceViewer files={(files ?? []).map((f) => ({ id: f.id, url: urls.get(f.file_path) ?? null, name: f.file_name ?? "Sustento", mime: f.mime ?? "image/jpeg", lat: f.lat, lng: f.lng, captured_at: f.captured_at ?? f.created_at, size: f.size_bytes }))}
              isPayroll={e.doc_type === "PL"} />
          </FadeIn>

          <FadeIn delay={0.05}>
            <Card>
              <CardHeader title="Pagos y amortizaciones" subtitle={`${livePays.length} pago(s) · ${pct(payable ? paid / payable : 0, 0)} del monto a pagar`} icon={<Banknote className="h-4 w-4" />} />
              <CardBody className="space-y-2">
                {(pays ?? []).map((p) => (
                  <div key={p.id} className={cn("flex items-center justify-between gap-3 rounded-xl border border-line-soft px-3 py-2.5", p.voided && "opacity-50 line-through")}>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{date(p.paid_at)} · {p.method}{p.bank ? ` · ${p.bank}` : ""}</p>
                      <p className="truncate text-[11px] text-ink-muted">Op. {p.operation_number ?? "—"} · {who(p.registered_by)}</p>
                    </div>
                    <div className="text-right"><p className="num font-semibold">{money(p.amount_pen)}</p><p className="text-[11px] text-ink-muted">{pct(toNum(p.percentage) / 100, 0)}</p></div>
                  </div>
                ))}
                {!pays?.length && <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-ink-muted">{["aprobado", "pagado_parcial"].includes(e.status) ? "Aprobado: pendiente de pago en Contabilidad." : "Sin pagos registrados."}</p>}
              </CardBody>
            </Card>
          </FadeIn>

          <FadeIn delay={0.1}>
            <Card>
              <CardHeader title="Trazabilidad" subtitle="Registro → aprobación → pago(s) → conciliación" icon={<ShieldCheck className="h-4 w-4" />} />
              <CardBody>
                <ol className="relative space-y-5 border-l-2 border-line-soft pl-6">
                  {events.map((ev, i) => (
                    <li key={i} className="relative">
                      <span className={cn("absolute -left-[33px] grid h-6 w-6 place-items-center rounded-full ring-4 ring-white", {
                        navy: "bg-navy-900 text-white", violet: "bg-violet-600 text-white", green: "bg-brand-green-600 text-white", amber: "bg-warn-500 text-white",
                        red: "bg-danger-500 text-white", blue: "bg-brand-blue text-white", gray: "bg-slate-400 text-white",
                      }[ev.tone])}>
                        {ev.icon === "pay" ? <Banknote className="h-3 w-3" /> : ev.icon === "ok" || ev.icon === "conc" ? <CircleCheck className="h-3 w-3" /> : ev.icon === "send" ? <Send className="h-3 w-3" /> : ev.icon === "obs" ? <MessageSquareWarning className="h-3 w-3" /> : ev.icon === "void" ? <FileX2 className="h-3 w-3" /> : <FilePlus2 className="h-3 w-3" />}
                      </span>
                      <p className="text-sm font-semibold text-ink">{ev.title}</p>
                      <p className="text-[11px] text-ink-muted">{dateTime(ev.at)}{ev.who ? ` · ${ev.who}` : ""}</p>
                      {ev.detail && <p className="mt-1 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-ink-soft">{ev.detail}</p>}
                    </li>
                  ))}
                </ol>
              </CardBody>
            </Card>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}

function Info({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-ink-soft">{icon}</span>
      <div className="min-w-0"><p className="text-[11px] font-medium text-ink-muted">{label}</p><p className="font-semibold text-ink">{value ?? "—"}</p>{sub && <p className="text-[11px] text-ink-muted">{sub}</p>}</div>
    </div>
  );
}
