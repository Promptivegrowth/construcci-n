"use client";
import { Building2, FileUp, LoaderCircle, Paperclip, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/dialog";
import { Button, Field, Input, Select, Textarea, cn } from "@/components/ui/primitives";
import { money, todayISO } from "@/lib/format";
import { uploadEvidence } from "@/lib/upload";
import { registerLimaExpenseAction } from "../actions";
import { BANKS, METHODS } from "./payments-view";

type Supplier = { id: string; name: string; ruc: string; kind: string };
type Phase = { id: string; code: string; name: string };
type Leaf = { id: string; code: string; name: string; phase_id: string | null };

const CATEGORIES = ["PAGO CENTRAL LIMA", "SEGUROS Y PÓLIZAS", "SERVICIOS PROFESIONALES", "COMPRAS PROVEEDORES", "ALQUILER EQUIPOS", "SERVICIO TRANSPORTE", "GASTOS GENERALES"];

export function LimaExpenseButton(props: { refx: { company: string; project: string }; ids: { companyId: string; projectId: string }; suppliers: Supplier[]; phases: Phase[]; leaves: Leaf[]; exchangeRate: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="navy" onClick={() => setOpen(true)}><Building2 className="h-4 w-4" />Comprobante central (Lima)</Button>
      {open && <LimaExpenseModal {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function LimaExpenseModal({ refx, ids, suppliers, phases, leaves, exchangeRate, onClose }: Parameters<typeof LimaExpenseButton>[0] & { onClose: () => void }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [newSup, setNewSup] = useState(false);
  const [f, setF] = useState({
    supplierId: "", ruc: "", name: "", doc_type: "FT" as "FT" | "BV" | "RH" | "TK" | "OT", series: "", doc_number: "",
    issue_date: todayISO(), reception_date: todayISO(), due_date: todayISO(), currency: "PEN" as "PEN" | "USD", exchange_rate: String(exchangeRate),
    total: "", tax_condition: "gravado" as "gravado" | "no_gravado" | "exonerado", retention_pct: "0", phase_id: phases[phases.length - 1]?.id ?? "",
    wbs_id: "", description: "", category: CATEGORIES[0],
  });
  const [file, setFile] = useState<File | null>(null);
  const [payNow, setPayNow] = useState(false);
  const [pay, setPay] = useState({ paid_at: todayISO(), method: "transferencia", bank: "BCP", operation_number: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  const realSuppliers = useMemo(() => suppliers.filter((s) => s.kind !== "trabajador"), [suppliers]);
  const phaseLeaves = useMemo(() => leaves.filter((l) => !l.phase_id || l.phase_id === f.phase_id), [leaves, f.phase_id]);

  const total = Number(f.total) || 0;
  const tc = f.currency === "USD" ? Number(f.exchange_rate) || exchangeRate : 1;
  const base = f.doc_type === "FT" && f.tax_condition === "gravado" ? total / 1.18 : total;
  const igv = total - base;
  const totalPen = total * tc;
  const payable = totalPen - (totalPen * (Number(f.retention_pct) || 0)) / 100;

  const submit = async () => {
    if (!newSup && !f.supplierId) return toast.warning("Selecciona el proveedor");
    if (newSup && (!f.ruc || !f.name)) return toast.warning("Completa RUC y razón social del proveedor");
    if (!f.doc_number) return toast.warning("Ingresa el número del comprobante");
    if (!f.wbs_id) return toast.warning("Clasificación obligatoria: elige el WBS de último nivel");
    if (!(total > 0)) return toast.warning("Ingresa el monto del comprobante");
    setBusy(true);
    try {
      let uploaded = null;
      if (file) {
        uploaded = await uploadEvidence(file, { companyId: ids.companyId, projectId: ids.projectId, folder: "comprobantes" });
      }
      const res = await registerLimaExpenseAction({
        ...refx,
        supplierId: newSup ? null : f.supplierId,
        newSupplier: newSup ? { ruc: f.ruc, name: f.name } : null,
        doc_type: f.doc_type, series: f.series, doc_number: f.doc_number, issue_date: f.issue_date, reception_date: f.reception_date, due_date: f.due_date,
        currency: f.currency, exchange_rate: Number(f.exchange_rate), total, tax_condition: f.tax_condition, retention_pct: Number(f.retention_pct) || 0,
        phase_id: f.phase_id, wbs_id: f.wbs_id, description: f.description, category: f.category, file: uploaded,
        payNow: payNow ? { amount: payable, ...pay } : null,
      });
      if (!res.ok) return toast.error("No se registró el comprobante", { description: res.error });
      toast.success("Comprobante central registrado", {
        description: payNow ? `Pagado ${money(payable)}. La obra ya lo ve reflejado en su WBS.` : "Quedó aprobado en la bandeja de pagos y visible para la obra.",
      });
      onClose();
      router.refresh();
    } catch (e) {
      toast.error("Error al subir el sustento", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} size="lg" title="Comprobante central (Lima)"
      description="Facturas que solo llegan a Lima (pólizas, servicios centrales, proveedores pagados desde oficina). Quedan aprobadas y la obra las ve en su WBS."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={submit} disabled={busy}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{payNow ? "Registrar y pagar" : "Registrar comprobante"}</Button></>}>
      <div className="space-y-6">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-blue">Proveedor</p>
            <button type="button" onClick={() => setNewSup(!newSup)} className="text-xs font-semibold text-brand-blue hover:underline">{newSup ? "Elegir existente" : "+ Proveedor nuevo"}</button>
          </div>
          {newSup ? (
            <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
              <Field label="RUC / DNI" required><Input inputMode="numeric" maxLength={11} value={f.ruc} onChange={(e) => set("ruc", e.target.value.replace(/\D/g, ""))} placeholder="20XXXXXXXXX" /></Field>
              <Field label="Razón social" required><Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="EMPRESA S.A.C." /></Field>
            </div>
          ) : (
            <Field label="Proveedor" required>
              <Select value={f.supplierId} onChange={(e) => set("supplierId", e.target.value)}>
                <option value="">Selecciona…</option>
                {realSuppliers.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.ruc}</option>)}
              </Select>
            </Field>
          )}
        </section>

        <section>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-brand-blue">Comprobante</p>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Tipo" required>
              <Select value={f.doc_type} onChange={(e) => set("doc_type", e.target.value)}>
                <option value="FT">Factura</option><option value="BV">Boleta</option><option value="RH">Recibo por honorarios</option><option value="TK">Ticket</option><option value="OT">Otro</option>
              </Select>
            </Field>
            <Field label="Serie"><Input value={f.series} onChange={(e) => set("series", e.target.value.toUpperCase())} placeholder="F001" maxLength={6} /></Field>
            <Field label="Número" required><Input value={f.doc_number} onChange={(e) => set("doc_number", e.target.value)} placeholder="0001234" /></Field>
            <Field label="Condición">
              <Select value={f.tax_condition} disabled={f.doc_type !== "FT"} onChange={(e) => set("tax_condition", e.target.value)}>
                <option value="gravado">Con IGV</option><option value="no_gravado">Sin IGV</option><option value="exonerado">Exonerado</option>
              </Select>
            </Field>
            <Field label="Emisión" required><Input type="date" value={f.issue_date} onChange={(e) => set("issue_date", e.target.value)} /></Field>
            <Field label="Recepción"><Input type="date" value={f.reception_date} onChange={(e) => set("reception_date", e.target.value)} /></Field>
            <Field label="Vencimiento"><Input type="date" value={f.due_date} onChange={(e) => set("due_date", e.target.value)} /></Field>
            <Field label="Fondo de garantía %"><Input type="number" min="0" max="20" step="0.5" value={f.retention_pct} onChange={(e) => set("retention_pct", e.target.value)} /></Field>
            <Field label="Moneda">
              <Select value={f.currency} onChange={(e) => set("currency", e.target.value)}><option value="PEN">Soles (S/)</option><option value="USD">Dólares (US$)</option></Select>
            </Field>
            {f.currency === "USD" && <Field label="Tipo de cambio"><Input type="number" step="0.001" value={f.exchange_rate} onChange={(e) => set("exchange_rate", e.target.value)} /></Field>}
            <Field label={`Importe total ${f.currency === "USD" ? "(US$)" : "(S/)"}`} required className={f.currency === "USD" ? "sm:col-span-2" : "sm:col-span-3"}>
              <Input type="number" step="0.01" min="0" value={f.total} onChange={(e) => set("total", e.target.value)} className="num text-right text-base font-semibold" />
            </Field>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-center text-xs sm:grid-cols-4">
            <div><p className="text-ink-muted">Base imponible</p><p className="num font-semibold">{money(base * tc)}</p></div>
            <div><p className="text-ink-muted">IGV 18%</p><p className="num font-semibold">{money(igv * tc)}</p></div>
            <div><p className="text-ink-muted">Total en soles</p><p className="num font-semibold">{money(totalPen)}</p></div>
            <div><p className="text-ink-muted">Monto a pagar</p><p className="num font-semibold text-brand-blue">{money(payable)}</p></div>
          </div>
        </section>

        <section>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-brand-blue">Clasificación</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Fase" required>
              <Select value={f.phase_id} onChange={(e) => { set("phase_id", e.target.value); set("wbs_id", ""); }}>{phases.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
            </Field>
            <Field label="WBS / centro de costo (último nivel)" required>
              <Select value={f.wbs_id} onChange={(e) => set("wbs_id", e.target.value)}>
                <option value="">Selecciona…</option>
                {phaseLeaves.map((l) => <option key={l.id} value={l.id}>{l.code} · {l.name}</option>)}
              </Select>
            </Field>
            <Field label="Tipo de gasto"><Select value={f.category} onChange={(e) => set("category", e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
            <Field label="Sustento (foto o PDF)">
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {file ? (
                <div className="flex h-10 items-center gap-2 rounded-xl border border-brand-green/40 bg-ok-50 px-3 text-xs">
                  <Paperclip className="h-4 w-4 text-brand-green-700" /><span className="flex-1 truncate font-medium">{file.name}</span>
                  <button type="button" onClick={() => setFile(null)} aria-label="Quitar"><X className="h-4 w-4 text-ink-muted" /></button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line text-xs font-semibold text-ink-soft hover:border-brand-blue hover:text-brand-blue">
                  <FileUp className="h-4 w-4" />Adjuntar comprobante
                </button>
              )}
            </Field>
            <Field label="Descripción" required className="sm:col-span-2"><Textarea value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Ej. Póliza Vida Ley — renovación anual (pago central)" /></Field>
          </div>
        </section>

        <section className={cn("rounded-2xl border p-4 transition", payNow ? "border-brand-green/40 bg-ok-50/50" : "border-line")}>
          <label className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" checked={payNow} onChange={(e) => setPayNow(e.target.checked)} className="h-4 w-4 accent-[#0a9f4c]" />
            <span className="text-sm font-semibold text-ink">Registrar el pago ahora <span className="font-normal text-ink-muted">({money(payable)})</span></span>
          </label>
          {payNow && (
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <Field label="Fecha"><Input type="date" value={pay.paid_at} max={todayISO()} onChange={(e) => setPay({ ...pay, paid_at: e.target.value })} /></Field>
              <Field label="Medio"><Select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>{METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</Select></Field>
              <Field label="Banco"><Select value={pay.bank} onChange={(e) => setPay({ ...pay, bank: e.target.value })}>{BANKS.map((b) => <option key={b}>{b}</option>)}</Select></Field>
              <Field label="N° operación"><Input value={pay.operation_number} onChange={(e) => setPay({ ...pay, operation_number: e.target.value })} /></Field>
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}
