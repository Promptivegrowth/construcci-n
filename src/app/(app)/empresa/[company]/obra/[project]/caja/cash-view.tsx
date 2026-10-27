"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Banknote, Check, CircleCheck, HandCoins, Hourglass, Landmark, LoaderCircle, Plus, Receipt, Send, Trash2, Wallet, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PeriodBars } from "@/components/charts";
import { KpiCard } from "@/components/ui/adm-kpi";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/dialog";
import { Stagger, StaggerItem } from "@/components/ui/motion";
import { Badge, Button, Card, CardBody, CardHeader, cn, EmptyState, Field, Input, Textarea } from "@/components/ui/primitives";
import { FUND_STATUS, monthsBetween } from "@/lib/calc";
import { date, dateTime, money, monthLabel, todayISO, addDaysISO } from "@/lib/format";
import { createBox, decideFunds, depositFunds, renderFunds, requestFunds } from "./actions";

export type FundRow = {
  id: string; seq: number; amount: number; reason: string; status: string; needed_by: string | null; created_at: string; requested_by: string;
  approved_by: string | null; approved_at: string | null; approval_note: string | null; deposited_by: string | null; deposited_at: string | null;
  deposit_operation: string | null; rendered_amount: number | null; rendered_at: string | null; mine: boolean;
};
export type MovementRow = { id: string; type: string; amount: number; date: string; concept: string; expense_id: string | null; request: string };
export type RenderCandidate = { id: string; date: string; description: string; total: number; ref: string; supplier: string; origin: string };
type Perms = { request: boolean; approve: boolean; deposit: boolean; render: boolean; createBox: boolean };

const STEPS = ["pendiente", "aprobada", "depositada", "rendida"] as const;
const STEP_LABEL = { pendiente: "Solicitada", aprobada: "Aprobada", depositada: "Depositada", rendida: "Rendida" };

export function CashView({ companyCode, projectCode, box, funds, movements, render, perms, meta }: {
  companyCode: string; projectCode: string; box: { id: string; name: string; responsible: string; income: number; outcome: number; balance: number } | null;
  funds: FundRow[]; movements: MovementRow[]; render: RenderCandidate[]; perms: Perms; meta: { company: string; project: string; user: string };
}) {
  const router = useRouter();
  const base = `/empresa/${companyCode}/obra/${projectCode}`;
  const [modal, setModal] = useState<null | { kind: "request" } | { kind: "decide"; f: FundRow; approve: boolean } | { kind: "deposit"; f: FundRow } | { kind: "render"; f: FundRow }>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ amount: "", reason: "", needed_by: addDaysISO(todayISO(), 3), note: "", operation: "", date: todayISO() });
  const [pickedExp, setPickedExp] = useState<Set<string>>(new Set());
  const [extras, setExtras] = useState<{ key: string; concept: string; amount: string; date: string }[]>([]);
  const [filter, setFilter] = useState<string>("activas");

  const close = () => { setModal(null); setForm((f) => ({ ...f, amount: "", reason: "", note: "", operation: "" })); setPickedExp(new Set()); setExtras([]); };
  const exec = async (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => {
    setBusy(true);
    try {
      const r = await fn();
      if (!r.ok) return toast.error("No se pudo completar", { description: r.error });
      toast.success(r.message ?? "Listo");
      close();
      router.refresh();
    } catch {
      toast.error("Se perdió la conexión", { description: "Actualiza para ver el estado real." });
    } finally { setBusy(false); }
  };

  const pending = funds.filter((f) => f.status === "pendiente");
  const toDeposit = funds.filter((f) => f.status === "aprobada");
  const toRender = funds.filter((f) => f.status === "depositada");
  const shown = funds.filter((f) => filter === "todas" ? true : filter === "activas" ? ["pendiente", "aprobada", "depositada"].includes(f.status) : f.status === filter);

  const chart = useMemo(() => {
    if (!movements.length) return [];
    const dates = movements.map((m) => m.date).sort();
    return monthsBetween(dates[0], dates[dates.length - 1]).map((m) => ({
      key: m, label: monthLabel(m),
      value: movements.filter((x) => x.type === "egreso" && x.date.startsWith(m)).reduce((s, x) => s + x.amount, 0),
      secondary: movements.filter((x) => x.type === "ingreso" && x.date.startsWith(m)).reduce((s, x) => s + x.amount, 0),
    }));
  }, [movements]);

  if (!box) {
    return (
      <EmptyState icon={<Wallet className="h-6 w-6" />} title="Esta obra aún no tiene caja" description="Abre la caja chica / fondo de obra para gestionar solicitudes, depósitos y rendiciones."
        action={perms.createBox ? <Button disabled={busy} onClick={() => exec(() => createBox(companyCode, projectCode, "Caja chica de obra"))}><Plus className="h-4 w-4" />Abrir caja de obra</Button> : <p className="text-xs text-ink-muted">Solicita a Gerencia o Contabilidad que abra la caja.</p>} />
    );
  }

  const movCols: Column<MovementRow>[] = [
    { key: "date", header: "Fecha", type: "date", value: (r) => r.date, cell: (r) => <span className="num text-xs">{date(r.date)}</span> },
    { key: "type", header: "Tipo", value: (r) => (r.type === "ingreso" ? "Ingreso" : "Egreso"), cell: (r) => r.type === "ingreso"
      ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-green-700"><ArrowDownLeft className="h-3.5 w-3.5" />Ingreso</span>
      : <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#9a5200]"><ArrowUpRight className="h-3.5 w-3.5" />Egreso</span> },
    { key: "concept", header: "Concepto", value: (r) => r.concept, cell: (r) => <div className="max-w-[360px]"><p className="truncate text-sm">{r.concept}</p>{r.expense_id && <Link onClick={(e) => e.stopPropagation()} href={`${base}/gastos/${r.expense_id}`} className="text-[11px] font-semibold text-brand-blue hover:underline">Ver comprobante</Link>}</div> },
    { key: "request", header: "Solicitud", value: (r) => r.request, hideSm: true },
    { key: "in", header: "Ingreso", type: "money", total: true, value: (r) => (r.type === "ingreso" ? r.amount : 0), cell: (r) => r.type === "ingreso" ? <span className="num text-brand-green-700">{money(r.amount)}</span> : <span className="text-ink-muted">—</span> },
    { key: "out", header: "Egreso", type: "money", total: true, value: (r) => (r.type === "egreso" ? r.amount : 0), cell: (r) => r.type === "egreso" ? <span className="num">{money(r.amount)}</span> : <span className="text-ink-muted">—</span> },
  ];

  const renderTotal = render.filter((e) => pickedExp.has(e.id)).reduce((s, e) => s + e.total, 0) + extras.reduce((s, x) => s + (Number(x.amount) || 0), 0);

  return (
    <div className="space-y-6">
      <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StaggerItem><KpiCard label={`Saldo · ${box.name}`} value={box.balance} icon={<Wallet className="h-4 w-4" />} tone="navy" sub={`Responsable: ${box.responsible}`} /></StaggerItem>
        <StaggerItem><KpiCard label="Ingresos (depósitos)" value={box.income} format="moneyShort" icon={<Landmark className="h-4 w-4" />} tone="green" sub={`${funds.filter((f) => ["depositada", "rendida"].includes(f.status)).length} depósitos`} /></StaggerItem>
        <StaggerItem><KpiCard label="Egresos rendidos" value={box.outcome} format="moneyShort" icon={<Receipt className="h-4 w-4" />} tone="amber" sub={`${movements.filter((m) => m.type === "egreso").length} egresos con sustento`} /></StaggerItem>
        <StaggerItem><KpiCard label="Solicitudes en curso" value={pending.length + toDeposit.length + toRender.length} format="int" icon={<Hourglass className="h-4 w-4" />} tone="violet"
          sub={`${pending.length} por aprobar · ${toDeposit.length} por depositar · ${toRender.length} por rendir`} /></StaggerItem>
      </Stagger>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Solicitudes de fondos" icon={<HandCoins className="h-4 w-4" />}
            subtitle="Solicita → aprueba Gerencia → deposita Contabilidad → rinde la obra"
            actions={perms.request && <Button size="sm" onClick={() => setModal({ kind: "request" })}><Plus className="h-4 w-4" />Solicitar fondos</Button>} />
          <CardBody className="space-y-3">
            <div className="flex flex-wrap gap-1">
              {[["activas", "En curso"], ["rendida", "Rendidas"], ["rechazada", "Rechazadas"], ["todas", "Todas"]].map(([k, l]) => (
                <button key={k} onClick={() => setFilter(k)} className={cn("h-8 rounded-lg px-3 text-xs font-semibold", filter === k ? "bg-navy-900 text-white" : "bg-slate-100 text-ink-soft")}>{l}</button>
              ))}
            </div>
            <AnimatePresence initial={false}>
              {shown.map((f) => {
                const idx = STEPS.indexOf(f.status as (typeof STEPS)[number]);
                return (
                  <motion.div key={f.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-2xl border border-line p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-ink">N° {f.seq} · <span className="num">{money(f.amount)}</span></p>
                        <p className="text-xs text-ink-soft">{f.reason}</p>
                        <p className="mt-0.5 text-[11px] text-ink-muted">{f.requested_by} · {dateTime(f.created_at)}{f.needed_by ? ` · para el ${date(f.needed_by)}` : ""}</p>
                      </div>
                      <Badge tone={FUND_STATUS[f.status]?.tone}>{FUND_STATUS[f.status]?.label}</Badge>
                    </div>
                    {f.status !== "rechazada" ? (
                      <div className="mt-3 grid grid-cols-4 gap-1">
                        {STEPS.map((s, i) => (
                          <div key={s} className="min-w-0">
                            <div className={cn("h-1.5 rounded-full", i <= idx ? "bg-brand-green-600" : "bg-slate-200")} />
                            <p className={cn("mt-1 truncate text-[10px] font-semibold", i <= idx ? "text-brand-green-700" : "text-ink-muted")}>{STEP_LABEL[s]}</p>
                          </div>
                        ))}
                      </div>
                    ) : <p className="mt-2 rounded-lg bg-danger-50 px-2.5 py-1.5 text-xs text-danger">Rechazada por {f.approved_by}: {f.approval_note}</p>}
                    {(f.deposit_operation || f.rendered_amount !== null) && (
                      <p className="mt-2 text-[11px] text-ink-muted">
                        {f.deposit_operation && <>Depósito op. {f.deposit_operation} · {date(f.deposited_at)} · {f.deposited_by}</>}
                        {f.rendered_amount !== null && <> · Rendido <b className="text-ink">{money(f.rendered_amount)}</b> ({money(f.amount - f.rendered_amount)} {f.amount - f.rendered_amount >= 0 ? "queda en caja" : "a reembolsar"})</>}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      {f.status === "pendiente" && perms.approve && <>
                        <Button size="sm" variant="outline" onClick={() => setModal({ kind: "decide", f, approve: false })}><XCircle className="h-3.5 w-3.5 text-danger" />Rechazar</Button>
                        <Button size="sm" variant="success" onClick={() => setModal({ kind: "decide", f, approve: true })}><CircleCheck className="h-3.5 w-3.5" />Aprobar</Button>
                      </>}
                      {f.status === "aprobada" && perms.deposit && <Button size="sm" onClick={() => setModal({ kind: "deposit", f })}><Landmark className="h-3.5 w-3.5" />Registrar depósito</Button>}
                      {f.status === "depositada" && perms.render && <Button size="sm" variant="navy" onClick={() => setModal({ kind: "render", f })}><Receipt className="h-3.5 w-3.5" />Rendir</Button>}
                      {f.status === "depositada" && !perms.render && f.mine && <p className="text-[11px] text-ink-muted">Entrega tus comprobantes al administrador para la rendición.</p>}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {!shown.length && <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-ink-muted">Sin solicitudes en esta vista.</p>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Movimiento mensual de caja" subtitle="Ingresos (depósitos) vs. egresos rendidos" icon={<Banknote className="h-4 w-4" />} />
          <CardBody>
            {chart.length ? (
              <>
                <PeriodBars data={chart} height={260} color="#E07B00" name="Egresos" secondaryName="Ingresos" highlightLast={false} />
                <div className="mt-1 flex justify-center gap-4 text-[11px] font-medium text-ink-soft">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand-blue" />Ingresos (depósitos)</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#E07B00]" />Egresos rendidos</span>
                </div>
              </>
            ) : <p className="py-10 text-center text-sm text-ink-muted">Sin movimientos aún.</p>}
            <div className="mt-4 rounded-2xl bg-[linear-gradient(135deg,#062a4d,#035aa6)] p-4 text-white">
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/60">Saldo disponible en caja</p>
              <p className="num font-display text-2xl font-semibold">{money(box.balance)}</p>
              <p className="text-xs text-white/60">Ingresos {money(box.income)} − egresos {money(box.outcome)}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="Movimientos de caja" subtitle="Cada egreso enlaza a su comprobante" />
        <div className="mt-2">
          <DataTable rows={movements} columns={movCols} searchPlaceholder="Buscar concepto, solicitud…" pageSize={12}
            exportSheet={{ name: "Caja", title: `Movimientos de caja · ${box.name}`, subtitle: `Saldo ${money(box.balance)}`,
              summary: [{ label: "Ingresos", value: money(box.income), tone: "green" }, { label: "Egresos", value: money(box.outcome), tone: "amber" }, { label: "Saldo", value: money(box.balance), tone: "navy" }] }}
            exportMeta={{ filename: `Caja-${meta.project.split(" ")[0]}`, company: meta.company, project: meta.project, user: meta.user }} />
        </div>
      </Card>

      {/* Modales del flujo */}
      <Modal open={modal?.kind === "request"} onOpenChange={(o) => !o && close()} size="sm" title="Solicitar fondos" description="Gerencia recibirá la solicitud para su aprobación."
        footer={<><Button variant="ghost" onClick={close}>Cancelar</Button><Button disabled={busy} onClick={() => exec(() => requestFunds(companyCode, projectCode, { box_id: box.id, amount: Number(form.amount), reason: form.reason, needed_by: form.needed_by }))}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Enviar solicitud</Button></>}>
        <div className="space-y-4">
          <Field label="Monto (S/)" required><Input type="number" min="0" step="0.01" className="num text-right" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} autoFocus /></Field>
          <Field label="Motivo" required><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Ej.: Pasajes del personal obrero y compra de agua para la semana" /></Field>
          <Field label="Se requiere para el"><Input type="date" value={form.needed_by} onChange={(e) => setForm({ ...form, needed_by: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={modal?.kind === "decide"} onOpenChange={(o) => !o && close()} size="sm"
        title={modal?.kind === "decide" ? `${modal.approve ? "Aprobar" : "Rechazar"} solicitud N° ${modal.f.seq}` : ""}
        description={modal?.kind === "decide" ? `${money(modal.f.amount)} · ${modal.f.reason}` : ""}
        footer={modal?.kind === "decide" && <><Button variant="ghost" onClick={close}>Cancelar</Button>
          <Button variant={modal.approve ? "success" : "danger"} disabled={busy} onClick={() => exec(() => decideFunds(companyCode, projectCode, modal.f.id, modal.approve, form.note))}>{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{modal.approve ? "Aprobar" : "Rechazar"}</Button></>}>
        <Field label={modal?.kind === "decide" && !modal.approve ? "Motivo del rechazo" : "Comentario (opcional)"} required={modal?.kind === "decide" && !modal.approve}>
          <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </Field>
      </Modal>

      <Modal open={modal?.kind === "deposit"} onOpenChange={(o) => !o && close()} size="sm"
        title={modal?.kind === "deposit" ? `Depositar solicitud N° ${modal.f.seq}` : ""} description={modal?.kind === "deposit" ? `${money(modal.f.amount)} a la ${box.name}` : ""}
        footer={modal?.kind === "deposit" && <><Button variant="ghost" onClick={close}>Cancelar</Button>
          <Button disabled={busy} onClick={() => exec(() => depositFunds(companyCode, projectCode, modal.f.id, { operation: form.operation, date: form.date }))}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Landmark className="h-4 w-4" />}Registrar depósito</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="N° de operación" required><Input value={form.operation} onChange={(e) => setForm({ ...form, operation: e.target.value })} autoFocus /></Field>
          <Field label="Fecha del depósito"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={modal?.kind === "render"} onOpenChange={(o) => !o && close()} size="lg"
        title={modal?.kind === "render" ? `Rendición de la solicitud N° ${modal.f.seq}` : ""}
        description={modal?.kind === "render" ? `Depositado ${money(modal.f.amount)} · selecciona los comprobantes que sustentan el gasto` : ""}
        footer={modal?.kind === "render" && <>
          <span className={cn("mr-auto self-center text-sm font-semibold", renderTotal > modal.f.amount ? "text-danger" : "text-ink")}>Rendido {money(renderTotal)} de {money(modal.f.amount)}</span>
          <Button variant="ghost" onClick={close}>Cancelar</Button>
          <Button disabled={busy || renderTotal <= 0} onClick={() => exec(() => renderFunds(companyCode, projectCode, modal.f.id, {
            expenseIds: [...pickedExp], extras: extras.map((x) => ({ concept: x.concept, amount: Number(x.amount) || 0, date: x.date })) }))}>
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Registrar rendición</Button></>}>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold text-ink-soft">Comprobantes registrados en la obra (no rendidos)</p>
            <div className="scrollbar-thin max-h-72 space-y-1 overflow-y-auto rounded-xl border border-line p-1.5">
              {render.slice(0, 120).map((e) => (
                <label key={e.id} className={cn("flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 transition hover:bg-slate-50", pickedExp.has(e.id) && "bg-brand-blue-50")}>
                  <input type="checkbox" checked={pickedExp.has(e.id)} onChange={() => setPickedExp((s) => { const n = new Set(s); if (n.has(e.id)) n.delete(e.id); else n.add(e.id); return n; })} className="h-4 w-4 accent-[#035aa6]" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{e.supplier}</span><span className="block truncate text-[11px] text-ink-muted">{date(e.date)} · {e.ref} · {e.description}</span></span>
                  {e.origin === "campo" && <Badge tone="cyan">Campo</Badge>}
                  <span className="num text-sm font-semibold">{money(e.total)}</span>
                </label>
              ))}
              {!render.length && <p className="p-4 text-center text-xs text-ink-muted">No hay comprobantes menores pendientes de rendir.</p>}
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-ink-soft">Otros egresos (gastos menores sin comprobante formal)</p>
              <Button size="sm" variant="subtle" onClick={() => setExtras((s) => [...s, { key: crypto.randomUUID(), concept: "", amount: "", date: todayISO() }])}><Plus className="h-3.5 w-3.5" />Agregar</Button>
            </div>
            {extras.map((x) => (
              <div key={x.key} className="mb-2 grid grid-cols-[minmax(0,1fr)_110px_140px_36px] gap-2">
                <Input value={x.concept} placeholder="Concepto" onChange={(e) => setExtras((s) => s.map((y) => y.key === x.key ? { ...y, concept: e.target.value } : y))} />
                <Input type="number" className="num text-right" value={x.amount} placeholder="0.00" onChange={(e) => setExtras((s) => s.map((y) => y.key === x.key ? { ...y, amount: e.target.value } : y))} />
                <Input type="date" value={x.date} onChange={(e) => setExtras((s) => s.map((y) => y.key === x.key ? { ...y, date: e.target.value } : y))} />
                <button onClick={() => setExtras((s) => s.filter((y) => y.key !== x.key))} className="grid place-items-center rounded-lg text-danger hover:bg-danger-50" aria-label="Quitar"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
