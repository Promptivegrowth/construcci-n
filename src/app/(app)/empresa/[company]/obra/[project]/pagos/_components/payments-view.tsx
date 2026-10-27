"use client";
import { motion } from "framer-motion";
import { Ban, Banknote, Building, CheckCircle2, LoaderCircle, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/dialog";
import { Badge, Button, Card, Field, Input, Select, Textarea, cn } from "@/components/ui/primitives";
import { EXPENSE_STATUS } from "@/lib/calc";
import { DOC_TYPE_LABEL, date, docRef, money, pct, todayISO } from "@/lib/format";
import { registerPaymentAction, voidPaymentAction } from "../actions";

export type PendingRow = {
  id: string; seq: number; doc_type: string; series: string | null; doc_number: string | null; description: string; issue_date: string; due_date: string;
  payable: number; paid: number; balance: number; retention: number; origin: string; status: string; supplier_id: string | null; supplier: string; ruc: string;
  bank: string | null; account: string | null; wbs_id: string | null; wbs_code: string; wbs_name: string; phase: string; payments: number;
};
export type PayRow = {
  id: string; paid_at: string; amount: number; percentage: number; method: string; bank: string | null; operation_number: string | null; notes: string | null;
  voided: boolean; void_reason: string | null; registrar: string; doc_type: string; series: string | null; doc_number: string | null; description: string;
  supplier: string; ruc: string; supplier_id: string; wbs_id: string; wbs_code: string;
};
type Ref = { company: string; project: string };
type Meta = { company: string; project: string; user: string };

export const METHODS = [
  { value: "transferencia", label: "Transferencia bancaria" },
  { value: "cheque", label: "Cheque" },
  { value: "efectivo", label: "Efectivo" },
  { value: "detraccion", label: "Detracción (Banco de la Nación)" },
  { value: "caja", label: "Caja de obra" },
];
export const BANKS = ["BCP", "BBVA", "Interbank", "Scotiabank", "Banco de la Nación", "BanBif", "Pichincha"];

function daysBetween(a: string, b: string) {
  return Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86400000);
}

export function AgingChip({ due, today }: { due: string; today: string }) {
  const d = daysBetween(today, due);
  if (d < 0) return <Badge tone="red">Vencido hace {-d} d</Badge>;
  if (d === 0) return <Badge tone="amber">Vence hoy</Badge>;
  if (d <= 7) return <Badge tone="amber">Vence en {d} d</Badge>;
  return <Badge tone="gray">En {d} días</Badge>;
}

export function PendingPayments({ rows, canPay, refx, today, meta, initialId }: { rows: PendingRow[]; canPay: boolean; refx: Ref; today: string; meta: Meta; initialId?: string }) {
  // ?gasto=<id> abre directamente el registro de pago (enlace desde el detalle del comprobante)
  const [sel, setSel] = useState<PendingRow | null>(() => (canPay && initialId ? rows.find((r) => r.id === initialId) ?? null : null));
  const base = `/empresa/${refx.company}/obra/${refx.project}`;
  const columns: Column<PendingRow>[] = useMemo(() => [
    { key: "due_date", header: "Vence", type: "date", className: "whitespace-nowrap", cell: (r) => (
      <div className="space-y-1"><p className="num text-[13px] font-semibold text-ink">{date(r.due_date)}</p><AgingChip due={r.due_date} today={today} /></div>
    ) },
    { key: "doc", header: "Comprobante", value: (r) => `${DOC_TYPE_LABEL[r.doc_type]} ${docRef(r)}`, cell: (r) => (
      <Link href={`${base}/gastos/${r.id}`} onClick={(e) => e.stopPropagation()} className="block hover:text-brand-blue">
        <p className="num font-semibold text-ink">{docRef(r)}</p>
        <p className="text-[11px] text-ink-muted">{DOC_TYPE_LABEL[r.doc_type]} · N° {r.seq}{r.origin === "lima" ? " · Lima" : ""}</p>
      </Link>
    ) },
    { key: "supplier", header: "Proveedor", cell: (r) => (
      <div className="max-w-[220px]"><p className="truncate font-medium text-ink">{r.supplier}</p><p className="truncate text-[11px] text-ink-muted">RUC {r.ruc} · {r.description}</p></div>
    ) },
    { key: "wbs_code", header: "WBS", hideSm: true, value: (r) => `${r.wbs_code} ${r.wbs_name}`, cell: (r) => (
      <div className="max-w-[170px]"><p className="text-xs font-semibold text-ink-soft">{r.wbs_code}</p><p className="truncate text-[11px] text-ink-muted">{r.wbs_name}</p></div>
    ) },
    { key: "payable", header: "A pagar", type: "money", total: true, hideSm: true, className: "whitespace-nowrap" },
    { key: "paid", header: "Pagado", type: "money", total: true, hideSm: true, cell: (r) => (
      <div className="whitespace-nowrap"><p className="num">{money(r.paid)}</p>{r.payments > 0 && <p className="text-[10px] text-ink-muted">{r.payments} amortiz. · {pct(r.payable ? r.paid / r.payable : 0, 0)}</p>}</div>
    ) },
    { key: "balance", header: "Saldo", type: "money", total: true, className: "whitespace-nowrap", cell: (r) => <span className="num font-bold text-navy-900">{money(r.balance)}</span> },
    { key: "status", header: "Estado", value: (r) => EXPENSE_STATUS[r.status]?.label, cell: (r) => <Badge tone={EXPENSE_STATUS[r.status]?.tone}>{EXPENSE_STATUS[r.status]?.label}</Badge> },
    ...(canPay ? [{ key: "act", header: "", sortable: false, exportable: false, cell: (r: PendingRow) => (
      <Button size="sm" variant="success" onClick={(e) => { e.stopPropagation(); setSel(r); }}><Banknote className="h-3.5 w-3.5" />Pagar</Button>
    ) } as Column<PendingRow>] : []),
  ], [base, canPay, today]);

  return (
    <Card>
      <DataTable rows={rows} columns={columns} pageSize={15} searchPlaceholder="Comprobante, proveedor, RUC, WBS…"
        initialSort={{ key: "due_date", dir: "asc" }}
        onRowClick={canPay ? (r) => setSel(r) : undefined}
        rowClassName={(r) => (r.due_date < today ? "bg-danger-50/30" : undefined)}
        exportSheet={{ name: "Por pagar", title: "Comprobantes por pagar", subtitle: "Aprobados por Gerencia, ordenados por vencimiento" }}
        exportMeta={{ filename: `por-pagar-${refx.project}`, ...meta }}
        empty={<span className="inline-flex items-center gap-2 text-brand-green-700"><CheckCircle2 className="h-4 w-4" />No hay comprobantes pendientes de pago con estos filtros.</span>} />
      {sel && <PayModal row={sel} refx={refx} onClose={() => setSel(null)} />}
    </Card>
  );
}

function PayModal({ row, refx, onClose }: { row: PendingRow; refx: Ref; onClose: () => void }) {
  const router = useRouter();
  const [amount, setAmount] = useState(row.balance.toFixed(2));
  const [paidAt, setPaidAt] = useState(todayISO());
  const [method, setMethod] = useState("transferencia");
  const [bank, setBank] = useState(row.bank ?? "BCP");
  const [op, setOp] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const n = Number(amount) || 0;
  const after = row.paid + n;
  const over = n > row.balance + 0.01;

  const submit = async () => {
    if (n <= 0) return toast.warning("Ingresa un monto mayor a cero");
    setBusy(true);
    const res = await registerPaymentAction({ ...refx, expenseId: row.id, amount: n, paid_at: paidAt, method, bank, operation_number: op, notes });
    setBusy(false);
    if (!res.ok) return toast.error("No se registró el pago", { description: res.error });
    toast.success(res.data?.status === "pagado" ? "Comprobante cancelado al 100%" : "Amortización registrada", {
      description: `${money(n)} a ${row.supplier}. La barra de consumo de ${row.wbs_code} se actualizó automáticamente.`,
    });
    onClose();
    router.refresh();
  };

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Registrar pago" size="md"
      description={`${DOC_TYPE_LABEL[row.doc_type]} ${docRef(row)} · ${row.supplier}`}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="success" onClick={submit} disabled={busy || over}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}Registrar {money(n)}</Button>
      </>}>
      <div className="space-y-5">
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><p className="text-[11px] text-ink-muted">Monto a pagar</p><p className="num font-display font-semibold">{money(row.payable)}</p></div>
            <div><p className="text-[11px] text-ink-muted">Ya pagado</p><p className="num font-display font-semibold text-brand-green-700">{money(row.paid)}</p></div>
            <div><p className="text-[11px] text-ink-muted">Saldo</p><p className="num font-display font-semibold text-navy-900">{money(row.balance)}</p></div>
          </div>
          <div className="relative mt-4 h-3 overflow-hidden rounded-full bg-white ring-1 ring-line">
            <div className="absolute inset-y-0 left-0 bg-brand-green-600" style={{ width: `${Math.min(1, row.paid / (row.payable || 1)) * 100}%` }} />
            <motion.div className="hatch absolute inset-y-0 bg-brand-blue" style={{ left: `${Math.min(1, row.paid / (row.payable || 1)) * 100}%` }}
              animate={{ width: `${Math.max(0, Math.min(1 - row.paid / (row.payable || 1), n / (row.payable || 1))) * 100}%` }} />
          </div>
          <p className="mt-2 text-center text-[11px] text-ink-muted">Después de este pago: <b className="num text-ink">{pct(row.payable ? after / row.payable : 0)}</b> del comprobante · WBS {row.wbs_code}</p>
          {row.retention > 0 && <p className="mt-1 text-center text-[11px] text-[#9a5200]">Fondo de garantía retenido: {money(row.retention)} (no forma parte del monto a pagar)</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Monto del pago (S/)" required error={over ? `Excede el saldo (${money(row.balance)})` : null}>
            <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="num text-right text-base font-semibold" autoFocus />
          </Field>
          <div role="group" aria-label="Porcentaje del comprobante">
            <span className="mb-1.5 block text-xs font-semibold text-ink-soft">Porcentaje del comprobante</span>
            <div className="flex gap-1.5">
              {[0.25, 0.5, 1].map((p) => (
                <button key={p} type="button" onClick={() => setAmount(Math.min(row.balance, Math.round(row.payable * p * 100) / 100).toFixed(2))}
                  className={cn("h-10 flex-1 rounded-xl border text-xs font-bold transition", Math.abs(n - Math.min(row.balance, row.payable * p)) < 0.01 ? "border-brand-blue bg-brand-blue-50 text-brand-blue" : "border-line text-ink-soft hover:border-brand-blue/40")}>
                  {p === 1 ? "Saldo" : `${p * 100}%`}
                </button>
              ))}
              <span className="num grid h-10 min-w-16 place-items-center rounded-xl bg-navy-900 px-2 text-xs font-bold text-white">{pct(row.payable ? n / row.payable : 0, 0)}</span>
            </div>
          </div>
          <Field label="Fecha de pago" required><Input type="date" value={paidAt} max={todayISO()} onChange={(e) => setPaidAt(e.target.value)} /></Field>
          <Field label="Medio de pago" required>
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</Select>
          </Field>
          <Field label="Banco"><Select value={bank} onChange={(e) => setBank(e.target.value)}>{BANKS.map((b) => <option key={b}>{b}</option>)}</Select></Field>
          <Field label="N° de operación" hint="Constancia de la transferencia o cheque"><Input value={op} onChange={(e) => setOp(e.target.value)} placeholder="Ej. 00458712" /></Field>
        </div>
        {row.account && (
          <p className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs text-ink-soft"><Building className="h-4 w-4 text-ink-muted" />Cuenta del proveedor: <b className="num">{row.bank} {row.account}</b></p>
        )}
        <Field label="Notas"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej. Pago 50% según acuerdo, saldo contra entrega de guía." /></Field>
      </div>
    </Modal>
  );
}

export function PaymentsHistory({ rows, canVoid, refx, meta }: { rows: PayRow[]; canVoid: boolean; refx: Ref; meta: Meta }) {
  const router = useRouter();
  const [voiding, setVoiding] = useState<PayRow | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const columns: Column<PayRow>[] = useMemo(() => [
    { key: "paid_at", header: "Fecha", type: "date", cell: (r) => <span className="num font-semibold">{date(r.paid_at)}</span> },
    { key: "doc", header: "Comprobante", value: (r) => docRef(r), cell: (r) => (
      <div><p className="num font-semibold text-ink">{docRef(r)}</p><p className="text-[11px] text-ink-muted">{DOC_TYPE_LABEL[r.doc_type]}</p></div>
    ) },
    { key: "supplier", header: "Proveedor", cell: (r) => <div className="max-w-[240px]"><p className="truncate font-medium">{r.supplier}</p><p className="truncate text-[11px] text-ink-muted">{r.description}</p></div> },
    { key: "wbs_code", header: "WBS", hideSm: true },
    { key: "amount", header: "Monto", type: "money", total: true, className: "whitespace-nowrap", value: (r) => (r.voided ? 0 : r.amount), cell: (r) => <span className={cn("num font-semibold", r.voided && "text-ink-muted line-through")}>{money(r.amount)}</span> },
    { key: "percentage", header: "%", type: "number", hideSm: true, cell: (r) => <span className="num">{r.percentage.toFixed(0)}%</span> },
    { key: "method", header: "Medio", hideSm: true, value: (r) => METHODS.find((m) => m.value === r.method)?.label ?? r.method, cell: (r) => (
      <div><p className="text-xs font-medium capitalize">{r.method}</p><p className="num text-[11px] text-ink-muted">{[r.bank, r.operation_number].filter(Boolean).join(" · ")}</p></div>
    ) },
    { key: "registrar", header: "Registrado por", hideSm: true },
    { key: "estado", header: "Estado", value: (r) => (r.voided ? "Anulado" : "Vigente"), cell: (r) => r.voided
      ? <span title={r.void_reason ?? ""}><Badge tone="red">Anulado</Badge></span> : <Badge tone="green">Vigente</Badge> },
    ...(canVoid ? [{ key: "act", header: "", sortable: false, exportable: false, cell: (r: PayRow) => !r.voided && (
      <button onClick={(e) => { e.stopPropagation(); setVoiding(r); setReason(""); }} className="rounded-lg p-1.5 text-ink-muted transition hover:bg-danger-50 hover:text-danger" title="Anular pago"><Ban className="h-4 w-4" /></button>
    ) } as Column<PayRow>] : []),
  ], [canVoid]);

  const submit = async () => {
    if (!voiding) return;
    setBusy(true);
    const res = await voidPaymentAction({ ...refx, paymentId: voiding.id, reason });
    setBusy(false);
    if (!res.ok) return toast.error("No se anuló el pago", { description: res.error });
    toast.success("Pago anulado", { description: "El saldo del comprobante y la barra del WBS se recalcularon. La anulación queda en la auditoría." });
    setVoiding(null);
    router.refresh();
  };

  return (
    <Card>
      <DataTable rows={rows} columns={columns} pageSize={15}
        searchPlaceholder="Proveedor, comprobante, operación…" initialSort={{ key: "paid_at", dir: "desc" }}
        rowClassName={(r) => (r.voided ? "opacity-60" : undefined)}
        exportSheet={{ name: "Pagos", title: "Pagos registrados por Contabilidad", subtitle: "Amortizaciones vigentes y anuladas (anuladas con monto 0)" }}
        exportMeta={{ filename: `pagos-${refx.project}`, ...meta }}
        empty={<span className="inline-flex items-center gap-2"><Wallet className="h-4 w-4" />Sin pagos en el periodo.</span>} />
      {voiding && (
        <Modal open onOpenChange={(o) => !o && setVoiding(null)} title="Anular pago" size="sm"
          description={`${money(voiding.amount)} · ${voiding.supplier} · ${date(voiding.paid_at)}`}
          footer={<><Button variant="ghost" onClick={() => setVoiding(null)}>Cancelar</Button>
            <Button variant="danger" onClick={submit} disabled={busy || reason.trim().length < 5}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}Anular pago</Button></>}>
          <p className="mb-3 text-sm text-ink-soft">Las anulaciones no borran el registro: quedan visibles con su motivo para auditoría.</p>
          <Field label="Motivo de la anulación" required hint="Mínimo 5 caracteres"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. Transferencia rechazada por el banco." autoFocus /></Field>
        </Modal>
      )}
    </Card>
  );
}
