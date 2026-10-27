"use client";
import { CheckCheck, FilePlus2, FileText, HandCoins, LoaderCircle, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Bar3DChart, PeriodBars } from "@/components/charts";
import { Panel } from "@/components/ui/cont-kit";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/dialog";
import { ExportMenu } from "@/components/ui/export-menu";
import { Badge, Button, Card, Field, Input, Select, Textarea, cn } from "@/components/ui/primitives";
import { VALUATION_STATUS } from "@/lib/calc";
import type { ExportSheet } from "@/lib/export/types";
import { date, money, pct, todayISO } from "@/lib/format";
import { approveValuationAction, createValuationAction, invoiceValuationAction, registerCollectionAction } from "../actions";

export type ValRow = {
  id: string; number: number; period_start: string; period_end: string; phase_id: string | null; phase: string; presented: number; approved: number;
  invoice_number: string | null; invoice_date: string | null; status: string; notes: string | null; invoicedWithIgv: number; collected: number; receivable: number;
  collections: { amount: number; collected_at: string; operation_number: string | null }[]; last_collection: string | null;
};
export type PhaseRow = {
  id: string; code: string; name: string; color: string; sale: number; saleIgv: number; invoiced: number; invoicedIgv: number; pctInvoiced: number;
  pending: number; pendingIgv: number; pctPending: number; valued: number; spent: number; cpi: number;
};
type Ref = { company: string; project: string };
type Meta = { filename: string; company: string; project: string; user: string };
type Action = { kind: "new" } | { kind: "approve"; row: ValRow } | { kind: "invoice"; row: ValRow } | { kind: "collect"; row: ValRow };

const cpiText = (c: number) => `Por cada sol gastado se está recibiendo ${c.toFixed(2)} soles`;

export function ValuationsView({ rows, phases, refx, canManage, canCollect, meta }: {
  rows: ValRow[]; phases: PhaseRow[]; refx: Ref; canManage: boolean; canCollect: boolean; meta: Meta;
}) {
  const [action, setAction] = useState<Action | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const t = useMemo(() => phases.reduce((a, p) => ({ sale: a.sale + p.sale, inv: a.inv + p.invoiced, valued: a.valued + p.valued, spent: a.spent + p.spent }), { sale: 0, inv: 0, valued: 0, spent: 0 }), [phases]);

  const columns: Column<ValRow>[] = [
    { key: "number", header: "N°", type: "int", cell: (r) => <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy-900 font-display text-xs font-bold text-white">{r.number}</span> },
    { key: "period", header: "Periodo", value: (r) => r.period_end, cell: (r) => <div className="whitespace-nowrap"><p className="num text-[13px] font-semibold">{date(r.period_start)} – {date(r.period_end)}</p><p className="text-[11px] text-ink-muted">Fase {r.phase || "—"}</p></div> },
    { key: "presented", header: "Presentado", type: "money", total: true, hideSm: true, className: "whitespace-nowrap" },
    { key: "approved", header: "Aprobado (sin IGV)", type: "money", total: true, className: "whitespace-nowrap" },
    { key: "invoice", header: "Factura", value: (r) => r.invoice_number ?? "", hideSm: true, cell: (r) => r.invoice_number ? <div><p className="num text-xs font-semibold">{r.invoice_number}</p><p className="text-[11px] text-ink-muted">{date(r.invoice_date)}</p></div> : <span className="text-xs text-ink-muted">—</span> },
    { key: "collected", header: "Cobrado (con IGV)", type: "money", total: true, className: "whitespace-nowrap", cell: (r) => (
      <div><p className="num font-semibold text-brand-green-700">{money(r.collected)}</p>{r.last_collection && <p className="text-[11px] text-ink-muted">{r.collections.length} abono(s) · {date(r.last_collection)}</p>}</div>
    ) },
    { key: "receivable", header: "Por cobrar", type: "money", total: true, className: "whitespace-nowrap", cell: (r) => <span className={cn("num font-semibold", r.receivable > 0 ? "text-[#9a5200]" : "text-ink-muted")}>{money(r.receivable)}</span> },
    { key: "status", header: "Estado", value: (r) => VALUATION_STATUS[r.status]?.label, cell: (r) => <Badge tone={VALUATION_STATUS[r.status]?.tone}>{VALUATION_STATUS[r.status]?.label}</Badge> },
    { key: "act", header: "", sortable: false, exportable: false, cell: (r) => {
      if ((r.status === "presentada" || r.status === "observada") && canManage) return <Button size="sm" variant="subtle" onClick={() => setAction({ kind: "approve", row: r })}><CheckCheck className="h-3.5 w-3.5" />Aprobar</Button>;
      if (r.status === "aprobada" && canManage) return <Button size="sm" variant="subtle" onClick={() => setAction({ kind: "invoice", row: r })}><FileText className="h-3.5 w-3.5" />Facturar</Button>;
      if (["facturada", "cobrada_parcial"].includes(r.status) && canCollect) return <Button size="sm" variant="success" onClick={() => setAction({ kind: "collect", row: r })}><HandCoins className="h-3.5 w-3.5" />Cobro</Button>;
      return null;
    } },
  ];

  const sheets = (): ExportSheet[] => [
    {
      name: "Faseado facturas", title: "Faseado de facturas por fase", subtitle: "Presupuesto contractual vs. facturado y CPI",
      summary: [
        { label: "Presupuesto contractual", value: money(t.sale), tone: "navy" }, { label: "Facturado", value: money(t.inv), tone: "blue" },
        { label: "Por facturar", value: money(t.sale - t.inv), tone: "amber" }, { label: "CPI global", value: t.spent ? (t.valued / t.spent).toFixed(2) : "—", tone: t.spent && t.valued / t.spent >= 1 ? "green" : "red" },
      ],
      columns: [
        { key: "fase", header: "Fase", width: 34 }, { key: "sale", header: "Ppto. S/IGV", type: "money" }, { key: "saleIgv", header: "Ppto. C/IGV", type: "money" },
        { key: "invoiced", header: "Facturado S/IGV", type: "money" }, { key: "invoicedIgv", header: "Facturado C/IGV", type: "money" }, { key: "pctInvoiced", header: "% facturado", type: "pct" },
        { key: "pending", header: "Por facturar S/IGV", type: "money" }, { key: "valued", header: "Valorizado S/IGV", type: "money" }, { key: "spent", header: "Gastado (pagado)", type: "money" },
        { key: "cpi", header: "CPI", type: "number" }, { key: "interp", header: "Interpretación", width: 46 },
      ],
      rows: phases.map((p) => ({ ...p, fase: `${p.code} · ${p.name}`, interp: p.spent ? cpiText(p.cpi) : "Sin gasto registrado" })),
      totals: { sale: t.sale, saleIgv: t.sale * 1.18, invoiced: t.inv, invoicedIgv: t.inv * 1.18, pctInvoiced: t.sale ? t.inv / t.sale : 0, pending: t.sale - t.inv, valued: t.valued, spent: t.spent, cpi: t.spent ? t.valued / t.spent : 0 },
    },
    {
      name: "Valorizaciones", title: "Valorizaciones y cobros", subtitle: "Detalle por valorización",
      columns: [
        { key: "number", header: "N°", type: "int", width: 6 }, { key: "period_start", header: "Desde", type: "date" }, { key: "period_end", header: "Hasta", type: "date" }, { key: "phase", header: "Fase", width: 8 },
        { key: "presented", header: "Presentado", type: "money" }, { key: "approved", header: "Aprobado", type: "money" }, { key: "invoice_number", header: "Factura", width: 16 },
        { key: "invoice_date", header: "F. factura", type: "date" }, { key: "collected", header: "Cobrado c/IGV", type: "money" }, { key: "receivable", header: "Por cobrar", type: "money" }, { key: "estado", header: "Estado", width: 20 },
      ],
      rows: rows.map((r) => ({ ...r, estado: VALUATION_STATUS[r.status]?.label })),
      totals: { presented: rows.reduce((s, r) => s + r.presented, 0), approved: rows.reduce((s, r) => s + r.approved, 0), collected: rows.reduce((s, r) => s + r.collected, 0), receivable: rows.reduce((s, r) => s + r.receivable, 0) },
    },
  ];

  return (
    <div className="space-y-6">
      <Panel title="Faseado de facturas" subtitle="Presupuesto contractual por fase vs. facturado al cliente y eficiencia del gasto (CPI = valorizado ÷ gastado)"
        actions={<>
          <ExportMenu build={sheets} meta={() => ({ ...meta, charts: [chartRef.current] })} />
          {canManage && <Button onClick={() => setAction({ kind: "new" })}><FilePlus2 className="h-4 w-4" />Nueva valorización</Button>}
        </>} bodyClassName="p-0">
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[1080px] whitespace-nowrap text-sm">
            <thead>
              <tr className="bg-navy-900 text-[11px] uppercase tracking-wide text-white">
                <th rowSpan={2} className="px-4 py-2 text-left font-semibold">Fase</th>
                <th colSpan={2} className="border-l border-white/10 px-3 py-1.5 font-semibold">Presupuesto</th>
                <th colSpan={3} className="border-l border-white/10 px-3 py-1.5 font-semibold">Facturado</th>
                <th colSpan={2} className="border-l border-white/10 px-3 py-1.5 font-semibold">Por facturar</th>
                <th colSpan={3} className="border-l border-white/10 px-3 py-1.5 font-semibold">Eficiencia</th>
              </tr>
              <tr className="bg-navy-800 text-[10px] uppercase tracking-wide text-white/80">
                {["S/IGV", "C/IGV", "S/IGV", "C/IGV", "%", "S/IGV", "% pend.", "Valorizado", "Gastado", "CPI"].map((h, i) => (
                  <th key={i} className={cn("px-3 py-1.5 text-right font-semibold", [0, 2, 5, 7].includes(i) && "border-l border-white/10")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {phases.map((p) => (
                <tr key={p.id} className="border-t border-line-soft">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5"><span className="h-8 w-1.5 rounded-full" style={{ background: p.color }} />
                      <div className="min-w-0"><p className="font-semibold text-ink">{p.code}</p><p className="max-w-[220px] truncate text-[11px] text-ink-muted">{p.name}</p></div></div>
                  </td>
                  <td className="num px-3 text-right">{money(p.sale)}</td>
                  <td className="num px-3 text-right text-ink-muted">{money(p.saleIgv)}</td>
                  <td className="num border-l border-line-soft px-3 text-right font-semibold">{money(p.invoiced)}</td>
                  <td className="num px-3 text-right text-ink-muted">{money(p.invoicedIgv)}</td>
                  <td className="px-3 text-right">
                    <div className="ml-auto w-20"><p className="num text-xs font-bold">{pct(p.pctInvoiced)}</p><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-blue" style={{ width: `${Math.min(1, p.pctInvoiced) * 100}%` }} /></div></div>
                  </td>
                  <td className="num border-l border-line-soft px-3 text-right">{money(p.pending)}</td>
                  <td className="num px-3 text-right text-ink-muted">{pct(p.pctPending)}</td>
                  <td className="num border-l border-line-soft px-3 text-right">{money(p.valued)}</td>
                  <td className="num px-3 text-right">{money(p.spent)}</td>
                  <td className="px-3 py-2 text-right">
                    {p.spent > 0 ? (
                      <div className="flex flex-col items-end">
                        <span className={cn("num rounded-lg px-2 py-0.5 text-sm font-bold", p.cpi >= 1 ? "bg-ok-50 text-brand-green-700" : "bg-danger-50 text-danger")}>{p.cpi.toFixed(2)}</span>
                        <span className="mt-1 max-w-[190px] whitespace-normal text-right text-[10px] leading-tight text-ink-muted">{cpiText(p.cpi)}</span>
                      </div>
                    ) : <span className="text-xs text-ink-muted">Sin gasto</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-navy-900 bg-brand-blue-50/60 font-semibold text-navy-900">
                <td className="px-4 py-3">TOTAL</td>
                <td className="num px-3 text-right">{money(t.sale)}</td><td className="num px-3 text-right">{money(t.sale * 1.18)}</td>
                <td className="num border-l border-line px-3 text-right">{money(t.inv)}</td><td className="num px-3 text-right">{money(t.inv * 1.18)}</td>
                <td className="num px-3 text-right">{pct(t.sale ? t.inv / t.sale : 0)}</td>
                <td className="num border-l border-line px-3 text-right">{money(t.sale - t.inv)}</td><td className="num px-3 text-right">{pct(t.sale ? 1 - t.inv / t.sale : 0)}</td>
                <td className="num border-l border-line px-3 text-right">{money(t.valued)}</td><td className="num px-3 text-right">{money(t.spent)}</td>
                <td className="num px-3 text-right">{t.spent ? (t.valued / t.spent).toFixed(2) : "—"}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {t.spent > 0 && (
          <p className={cn("m-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm", t.valued / t.spent >= 1 ? "bg-ok-50 text-brand-green-700" : "bg-danger-50 text-danger")}>
            {t.valued / t.spent < 1 && <TriangleAlert className="h-4 w-4 shrink-0" />}
            <b>{cpiText(t.valued / t.spent)}</b> en la obra.
          </p>
        )}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Presupuesto contractual vs. valorizado vs. gastado" subtitle="Por fase · sin IGV">
          <div ref={chartRef} className="bg-white">
            <Bar3DChart categories={phases.map((p) => ({ label: p.code, sub: `CPI ${p.spent ? p.cpi.toFixed(2) : "—"}`, values: [p.sale, p.valued, p.spent] }))}
              series={[{ name: "Presupuesto contractual", color: "#035AA6" }, { name: "Valorizado", color: "#0A9F4C" }, { name: "Gastado (pagado)", color: "#E07B00" }]} height={300} />
          </div>
        </Panel>
        <Panel title="Valorizado y cobrado por valorización" subtitle="Aprobado sin IGV vs. abonos recibidos (sin IGV)">
          <PeriodBars data={rows.map((r) => ({ label: `V${r.number}`, value: r.approved, secondary: Math.round((r.collected / 1.18) * 100) / 100 }))}
            name="Valorizado" secondaryName="Cobrado (sin IGV)" color="#0A9F4C" highlightLast={false} height={300} />
        </Panel>
      </div>

      <Card>
        <DataTable rows={rows} columns={columns} pageSize={20} searchPlaceholder="N°, factura, fase…" initialSort={{ key: "number", dir: "desc" }}
          exportSheet={{ name: "Valorizaciones", title: "Valorizaciones y cobros", subtitle: "Presentado, aprobado, facturado y cobrado" }} exportMeta={meta}
          empty="Aún no hay valorizaciones registradas para esta obra." />
      </Card>

      {action && <ActionModal action={action} refx={refx} phases={phases} rows={rows} onClose={() => setAction(null)} />}
    </div>
  );
}

function ActionModal({ action, refx, phases, rows, onClose }: { action: Action; refx: Ref; phases: PhaseRow[]; rows: ValRow[]; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const lastEnd = rows.reduce((m, r) => (r.period_end > m ? r.period_end : m), "");
  const [f, setF] = useState<Record<string, string>>((): Record<string, string> => {
    if (action.kind === "new") return { period_start: lastEnd ? new Date(new Date(`${lastEnd}T12:00:00`).getTime() + 86400000).toISOString().slice(0, 10) : todayISO(), period_end: todayISO(), phase_id: phases[phases.length - 1]?.id ?? "", amount: "", notes: "" };
    if (action.kind === "approve") return { amount: String(action.row.presented), notes: "" };
    if (action.kind === "invoice") return { invoice_number: "E001-", invoice_date: todayISO() };
    return { amount: action.row.receivable.toFixed(2), collected_at: todayISO(), op: "", notes: "" };
  });
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));

  const run = async (observe = false) => {
    setBusy(true);
    let res;
    if (action.kind === "new") res = await createValuationAction({ ...refx, period_start: f.period_start, period_end: f.period_end, phase_id: f.phase_id, presented_amount: Number(f.amount), notes: f.notes });
    else if (action.kind === "approve") res = await approveValuationAction({ ...refx, id: action.row.id, approved_amount: Number(f.amount), observe, notes: f.notes });
    else if (action.kind === "invoice") res = await invoiceValuationAction({ ...refx, id: action.row.id, invoice_number: f.invoice_number, invoice_date: f.invoice_date });
    else res = await registerCollectionAction({ ...refx, valuation_id: action.row.id, amount: Number(f.amount), collected_at: f.collected_at, operation_number: f.op, notes: f.notes });
    setBusy(false);
    if (!res.ok) return toast.error("No se pudo guardar", { description: res.error });
    const msg = { new: "Valorización presentada", approve: observe ? "Valorización observada" : "Valorización aprobada", invoice: "Factura registrada", collect: "Abono registrado" }[action.kind];
    toast.success(msg, { description: action.kind === "collect" ? "El flujo de caja de la obra ya refleja el ingreso." : undefined });
    onClose();
    router.refresh();
  };

  const title = { new: "Nueva valorización", approve: `Aprobar valorización N° ${"row" in action ? action.row.number : ""}`, invoice: `Facturar valorización N° ${"row" in action ? action.row.number : ""}`, collect: `Registrar cobro · Val. N° ${"row" in action ? action.row.number : ""}` }[action.kind];
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={title} size="md"
      description={"row" in action ? `Periodo ${date(action.row.period_start)} – ${date(action.row.period_end)} · Fase ${action.row.phase || "—"}` : "Monto valorizado sin IGV presentado al cliente."}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        {action.kind === "approve" && <Button variant="outline" onClick={() => run(true)} disabled={busy}>Observar</Button>}
        <Button onClick={() => run()} disabled={busy} variant={action.kind === "collect" ? "success" : "primary"}>{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}Guardar</Button>
      </>}>
      <div className="grid gap-4 sm:grid-cols-2">
        {action.kind === "new" && <>
          <Field label="Inicio del periodo" required><Input type="date" value={f.period_start} onChange={(e) => set("period_start", e.target.value)} /></Field>
          <Field label="Fin del periodo" required><Input type="date" value={f.period_end} onChange={(e) => set("period_end", e.target.value)} /></Field>
          <Field label="Fase" className="sm:col-span-2"><Select value={f.phase_id} onChange={(e) => set("phase_id", e.target.value)}>{phases.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</Select></Field>
          <Field label="Monto presentado (S/ sin IGV)" required className="sm:col-span-2"><Input type="number" step="0.01" value={f.amount} onChange={(e) => set("amount", e.target.value)} className="num text-right text-base font-semibold" autoFocus /></Field>
          <Field label="Notas" className="sm:col-span-2"><Textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        </>}
        {action.kind === "approve" && <>
          <div className="rounded-xl bg-slate-50 p-3 sm:col-span-2"><p className="text-xs text-ink-muted">Presentado</p><p className="num font-display text-lg font-semibold">{money(action.row.presented)}</p></div>
          <Field label="Monto aprobado por el cliente (sin IGV)" required className="sm:col-span-2" hint={`IGV 18%: ${money(Number(f.amount) * 0.18)} · Total a facturar ${money(Number(f.amount) * 1.18)}`}>
            <Input type="number" step="0.01" value={f.amount} onChange={(e) => set("amount", e.target.value)} className="num text-right text-base font-semibold" autoFocus />
          </Field>
          <Field label="Comentario (obligatorio si se observa)" className="sm:col-span-2"><Textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Ej. Metrados de partida 03.02 observados por la supervisión." /></Field>
        </>}
        {action.kind === "invoice" && <>
          <div className="rounded-xl bg-slate-50 p-3 sm:col-span-2"><p className="text-xs text-ink-muted">Total a facturar (con IGV)</p><p className="num font-display text-lg font-semibold">{money(action.row.approved * 1.18)}</p></div>
          <Field label="N° de factura" required><Input value={f.invoice_number} onChange={(e) => set("invoice_number", e.target.value.toUpperCase())} autoFocus /></Field>
          <Field label="Fecha de emisión" required><Input type="date" value={f.invoice_date} onChange={(e) => set("invoice_date", e.target.value)} /></Field>
        </>}
        {action.kind === "collect" && <>
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center sm:col-span-2">
            <div><p className="text-[11px] text-ink-muted">Facturado</p><p className="num text-sm font-semibold">{money(action.row.invoicedWithIgv)}</p></div>
            <div><p className="text-[11px] text-ink-muted">Cobrado</p><p className="num text-sm font-semibold text-brand-green-700">{money(action.row.collected)}</p></div>
            <div><p className="text-[11px] text-ink-muted">Saldo</p><p className="num text-sm font-semibold">{money(action.row.receivable)}</p></div>
          </div>
          <Field label="Monto abonado (con IGV)" required hint="Se permiten cobros parciales (p. ej. neto de detracción)"><Input type="number" step="0.01" value={f.amount} onChange={(e) => set("amount", e.target.value)} className="num text-right font-semibold" autoFocus /></Field>
          <Field label="Fecha del abono" required><Input type="date" value={f.collected_at} max={todayISO()} onChange={(e) => set("collected_at", e.target.value)} /></Field>
          <Field label="N° de operación"><Input value={f.op} onChange={(e) => set("op", e.target.value)} /></Field>
          <Field label="Notas"><Input value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        </>}
      </div>
    </Modal>
  );
}
