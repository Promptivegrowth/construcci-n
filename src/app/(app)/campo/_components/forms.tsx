"use client";
import { Boxes, LoaderCircle, Receipt, Send, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, Field, Input, Select, Textarea, cn } from "@/components/ui/primitives";
import { money, todayISO } from "@/lib/format";
import type { CampoData, CampoProject } from "./campo-app";
import { PhotoCapture, type Captured } from "./photo-capture";
import { enqueue } from "./queue";

const DOCS = [
  { v: "BV", l: "Boleta" }, { v: "FT", l: "Factura" }, { v: "TK", l: "Ticket" }, { v: "RH", l: "Rec. honorarios" }, { v: "OT", l: "Otro" },
] as const;
const QUICK = ["Pasajes de personal", "Alimentación de personal", "Combustible", "Hospedaje", "Materiales menores", "Flete local", "Agua y víveres"];

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-line bg-white p-4 shadow-card sm:p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-blue-50 text-brand-blue">{icon}</span>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export function ExpenseForm({ data, project, onDone }: { data: CampoData; project: CampoProject; onDone: (queued: boolean) => void }) {
  const phases = data.phases.filter((p) => p.projectId === project.id);
  const [photo, setPhoto] = useState<Captured | null>(null);
  const [phaseId, setPhaseId] = useState(phases[phases.length - 1]?.id ?? "");
  const [wbsId, setWbsId] = useState("");
  const [ruc, setRuc] = useState("");
  const [name, setName] = useState("");
  const [docType, setDocType] = useState<(typeof DOCS)[number]["v"]>("BV");
  const [series, setSeries] = useState("");
  const [num, setNum] = useState("");
  const [date, setDate] = useState(todayISO());
  const [total, setTotal] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const leaves = useMemo(() => data.leaves.filter((l) => l.projectId === project.id && (!phaseId || !l.phaseId || l.phaseId === phaseId)), [data.leaves, project.id, phaseId]);
  const leaf = leaves.find((l) => l.id === wbsId);
  const suppliers = data.suppliers.filter((s) => s.companyId === project.companyId);
  const known = suppliers.find((s) => s.ruc === ruc);
  const amount = Number(total) || 0;
  const cost = docType === "FT" ? amount / 1.18 : amount;
  const saldo = leaf ? leaf.budget - leaf.used : 0;
  const exceeds = !!leaf && leaf.budget > 0 && cost > saldo;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = !photo ? "Toma la foto del comprobante (sustento obligatorio)." : !phaseId ? "Selecciona la fase." : !wbsId ? "Selecciona el WBS." :
      !/^(\d{8}|\d{11})$/.test(ruc) ? "RUC (11) o DNI (8) inválido." : !known && name.trim().length < 3 ? "Ingresa la razón social del proveedor." :
      !num.trim() && !["TK", "OT"].includes(docType) ? "Ingresa el número del comprobante." : amount <= 0 ? "Ingresa el monto." : desc.trim().length < 4 ? "Describe el gasto." : null;
    if (err) return toast.warning(err);
    setSaving(true);
    await enqueue({
      kind: "gasto", label: `${DOCS.find((d) => d.v === docType)?.l} ${series ? `${series}-` : ""}${num} · ${known?.name ?? name}`, amount,
      projectId: project.id, companyId: project.companyId, photo: photo!.blob, photoFolder: "comprobantes",
      payload: {
        projectId: project.id, wbsId, phaseId, supplierRuc: ruc, supplierName: known?.name ?? name, docType, series, docNumber: num.trim(), issueDate: date,
        total: Math.round(amount * 100) / 100, description: desc.trim(), lat: photo!.geo?.lat ?? null, lng: photo!.geo?.lng ?? null, capturedAt: photo!.at,
      },
    });
    setSaving(false);
    onDone(true);
  };

  return (
    <form onSubmit={submit}>
      <Card icon={<Receipt className="h-5 w-5" />} title="Registrar gasto">
        <div className="space-y-4">
          <PhotoCapture value={photo} onChange={setPhoto} required hint="La foto guarda fecha, hora y ubicación GPS como evidencia" />
          <div className="grid grid-cols-5 gap-1 rounded-2xl bg-slate-100 p-1">
            {DOCS.map((d) => (
              <button type="button" key={d.v} onClick={() => setDocType(d.v)} className={cn("h-9 rounded-xl text-[11px] font-semibold leading-tight transition", docType === d.v ? "bg-white text-navy-900 shadow-sm" : "text-ink-muted")}>{d.l}</button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Serie"><Input value={series} onChange={(e) => setSeries(e.target.value.toUpperCase())} placeholder="B001" maxLength={6} /></Field>
            <Field label="Número" required={!["TK", "OT"].includes(docType)} className="col-span-2"><Input inputMode="numeric" value={num} onChange={(e) => setNum(e.target.value)} placeholder="000123" /></Field>
          </div>
          <Field label="RUC / DNI del proveedor" required hint={known ? `✓ ${known.name}` : ruc.length >= 8 ? "Proveedor nuevo: se registrará en la empresa" : undefined}>
            <Input list="campo-suppliers" inputMode="numeric" value={ruc} onChange={(e) => setRuc(e.target.value.replace(/\D/g, "").slice(0, 11))} placeholder="20xxxxxxxxx" />
            <datalist id="campo-suppliers">{suppliers.map((s) => <option key={s.id} value={s.ruc}>{s.name}</option>)}</datalist>
          </Field>
          {!known && ruc.length >= 8 && <Field label="Razón social / nombre" required><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha de emisión" required><Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Monto total (S/)" required hint={docType === "FT" && amount ? `Base ${money(cost)} + IGV` : undefined}>
              <Input type="number" inputMode="decimal" step="0.01" min="0" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0.00" className="num text-lg font-semibold" />
            </Field>
          </div>
          <Field label="Fase" required>
            <Select value={phaseId} onChange={(e) => { setPhaseId(e.target.value); setWbsId(""); }}>
              <option value="">Selecciona…</option>{phases.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="WBS / centro de costo" required hint={leaf ? `Saldo disponible ${money(saldo)} de ${money(leaf.budget)}` : undefined}>
            <Select value={wbsId} onChange={(e) => setWbsId(e.target.value)}>
              <option value="">Selecciona…</option>{leaves.map((l) => <option key={l.id} value={l.id}>{l.code} · {l.name}</option>)}
            </Select>
          </Field>
          {exceeds && (
            <div className="flex gap-2 rounded-xl bg-warn-50 p-3 text-xs text-[#9a5200] ring-1 ring-warn/30">
              <TriangleAlert className="h-4 w-4 shrink-0" />Este gasto deja el WBS en negativo: quedará marcado para aprobación de Gerencia.
            </div>
          )}
          <div>
            <p className="mb-1.5 text-xs font-semibold text-ink-soft">Descripción <span className="text-danger-500">*</span></p>
            <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Descripciones frecuentes">
              {QUICK.map((q) => <button type="button" key={q} onClick={() => setDesc(q)} className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium ring-1", desc === q ? "bg-brand-blue text-white ring-brand-blue" : "bg-white text-ink-soft ring-line")}>{q}</button>)}
            </div>
            <Textarea aria-label="Descripción del gasto" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Detalle del gasto" className="min-h-[64px]" />
          </div>
        </div>
      </Card>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <Button type="submit" size="lg" className="w-full" disabled={saving}>{saving ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}Declarar gasto {amount ? `· ${money(amount)}` : ""}</Button>
        </div>
      </div>
    </form>
  );
}

export function StockForm({ data, project, onDone }: { data: CampoData; project: CampoProject; onDone: (queued: boolean) => void }) {
  const materials = data.materials.filter((m) => m.companyId === project.companyId);
  const suppliers = data.suppliers.filter((s) => s.companyId === project.companyId);
  const [q, setQ] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const [ruc, setRuc] = useState("");
  const [guia, setGuia] = useState("");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<Captured | null>(null);
  const [saving, setSaving] = useState(false);
  const mat = materials.find((m) => m.id === materialId);
  const filtered = materials.filter((m) => !q || `${m.code} ${m.name}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  const known = suppliers.find((s) => s.ruc === ruc);
  const total = (Number(qty) || 0) * (Number(cost) || 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = !mat ? "Selecciona el material." : !(Number(qty) > 0) ? "Ingresa la cantidad." : Number(cost) < 0 || cost === "" ? "Ingresa el costo unitario." :
      ruc && !/^(\d{8}|\d{11})$/.test(ruc) ? "RUC inválido." : null;
    if (err) return toast.warning(err);
    setSaving(true);
    await enqueue({
      kind: "almacen", label: `${qty} ${mat!.unit} · ${mat!.name}`, amount: total, projectId: project.id, companyId: project.companyId,
      photo: photo?.blob ?? null, photoFolder: "almacen",
      payload: { projectId: project.id, materialId, quantity: Number(qty), unitCost: Number(cost), supplierRuc: ruc, supplierName: known?.name ?? "", documentRef: guia, movedAt: date, notes },
    });
    setSaving(false);
    onDone(true);
  };

  return (
    <form onSubmit={submit}>
      <Card icon={<Boxes className="h-5 w-5" />} title="Ingreso de almacén">
        <div className="space-y-4">
          <Field label="Material" required>
            {mat ? (
              <button type="button" onClick={() => setMaterialId("")} className="flex w-full items-center justify-between rounded-xl border border-brand-blue/40 bg-brand-blue-50 px-3.5 py-2.5 text-left text-sm">
                <span><b>{mat.code}</b> · {mat.name}</span><span className="text-xs font-semibold text-brand-blue">Cambiar</span>
              </button>
            ) : (
              <>
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar: alambre, clavo, madera, cemento…" />
                <div className="mt-2 space-y-1">
                  {filtered.map((m) => (
                    <button type="button" key={m.id} onClick={() => { setMaterialId(m.id); setQ(""); }} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50">
                      <span className="truncate"><b className="text-ink-soft">{m.code}</b> {m.name}</span><span className="text-xs text-ink-muted">{m.unit}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Cantidad${mat ? ` (${mat.unit})` : ""}`} required><Input type="number" inputMode="decimal" step="0.001" min="0" value={qty} onChange={(e) => setQty(e.target.value)} className="num text-lg font-semibold" /></Field>
            <Field label="Costo unitario (S/)" required hint={total ? `Total ${money(total)}` : undefined}><Input type="number" inputMode="decimal" step="0.01" min="0" value={cost} onChange={(e) => setCost(e.target.value)} className="num" /></Field>
          </div>
          <Field label="RUC del proveedor" hint={known ? `✓ ${known.name}` : undefined}>
            <Input list="campo-suppliers-stock" inputMode="numeric" value={ruc} onChange={(e) => setRuc(e.target.value.replace(/\D/g, "").slice(0, 11))} />
            <datalist id="campo-suppliers-stock">{suppliers.map((s) => <option key={s.id} value={s.ruc}>{s.name}</option>)}</datalist>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Guía de remisión"><Input value={guia} onChange={(e) => setGuia(e.target.value.toUpperCase())} placeholder="EG01-000123" /></Field>
            <Field label="Fecha"><Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} /></Field>
          </div>
          <PhotoCapture value={photo} onChange={setPhoto} label="Foto de la guía o del material" hint="Opcional" />
          <Field label="Observaciones"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[56px]" /></Field>
        </div>
      </Card>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <Button type="submit" size="lg" variant="success" className="w-full" disabled={saving}>{saving ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}Registrar ingreso {total ? `· ${money(total)}` : ""}</Button>
        </div>
      </div>
    </form>
  );
}
