"use client";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertOctagon, Camera, Check, ChevronsUpDown, FileText, ImagePlus, Info, Layers, Link2, LoaderCircle, MapPin, Plus, ReceiptText, Save, Search, Send, Split, Trash2, UserPlus, X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BatteryBar } from "@/components/ui/battery";
import { Modal } from "@/components/ui/dialog";
import { Button, Card, CardBody, CardHeader, cn, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { COST_TYPE_LABEL } from "@/lib/calc";
import { DOC_TYPE_LABEL, money, todayISO, addDaysISO } from "@/lib/format";
import { currentPosition, uploadEvidence } from "@/lib/upload";
import { createSupplier, saveExpense, type EvidenceInput, type ExpenseInput } from "../actions";
import { computeExpense, r2 } from "./expense-math";
import type { FormLeaf, FormOrder, FormPhase, FormSupplier } from "./form-data";

const CATEGORIES = ["COMPRAS PROVEEDORES", "ALQUILER EQUIPOS", "SERVICIO TRANSPORTE", "SEGURIDAD", "SERVICIOS", "SUBCONTRATOS", "PASAJES Y VIÁTICOS", "CAJA CHICA", "GASTOS GENERALES", "CONTINGENCIAS"];
const TYPE_CATEGORY: Record<string, string> = {
  alquileres: "ALQUILER EQUIPOS", transporte: "SERVICIO TRANSPORTE", materiales: "COMPRAS PROVEEDORES", seguridad: "SEGURIDAD", servicios: "SERVICIOS",
  gastos_generales: "GASTOS GENERALES", contingencias: "CONTINGENCIAS", mano_obra: "SUBCONTRATOS",
};
const DOCS = ["FT", "BV", "RH", "TK", "OT"] as const;

export type ExpenseFormInitial = Partial<Omit<ExpenseInput, "files">> & { existingFiles?: number; observation?: string | null; status?: string };

type Upload = EvidenceInput & { preview: string | null; uploading?: boolean; key: string };

export function ExpenseForm({
  companyCode, projectCode, companyId, projectId, projectTc, suppliers: initialSuppliers, phases, leaves, orders, canOverride, initial, expenseId,
}: {
  companyCode: string; projectCode: string; companyId: string; projectId: string; projectTc: number;
  suppliers: FormSupplier[]; phases: FormPhase[]; leaves: FormLeaf[]; orders: FormOrder[]; canOverride: boolean;
  initial?: ExpenseFormInitial; expenseId?: string;
}) {
  const router = useRouter();
  const base = `/empresa/${companyCode}/obra/${projectCode}`;
  const today = todayISO();
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [f, setF] = useState({
    supplier_id: initial?.supplier_id ?? "",
    doc_type: (initial?.doc_type ?? "FT") as ExpenseInput["doc_type"],
    series: initial?.series ?? "",
    doc_number: initial?.doc_number ?? "",
    issue_date: initial?.issue_date ?? today,
    reception_date: initial?.reception_date ?? today,
    due_date: initial?.due_date ?? addDaysISO(today, 30),
    currency: (initial?.currency ?? "PEN") as ExpenseInput["currency"],
    exchange_rate: initial?.exchange_rate ?? projectTc,
    tax_condition: (initial?.tax_condition ?? "gravado") as ExpenseInput["tax_condition"],
    total: initial?.total ? String(initial.total) : "",
    retention_pct: initial?.retention_pct ? String(initial.retention_pct) : "0",
    phase_id: initial?.phase_id ?? "",
    wbs_id: initial?.wbs_id ?? "",
    order_id: initial?.order_id ?? "",
    order_override: initial?.order_override ?? false,
    description: initial?.description ?? "",
    category: initial?.category ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const [split, setSplit] = useState((initial?.allocations?.length ?? 0) > 1);
  const [alloc, setAlloc] = useState<Record<string, string>>(Object.fromEntries((initial?.allocations ?? []).map((a) => [a.wbs_id, String(a.amount)])));
  const [files, setFiles] = useState<Upload[]>([]);
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState<null | "borrador" | "declarado">(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const total = Number(f.total) || 0;
  const m = computeExpense({ docType: f.doc_type, tax: f.tax_condition, total, currency: f.currency, tc: Number(f.exchange_rate), retentionPct: Number(f.retention_pct) || 0 });
  const leaf = leaves.find((l) => l.id === f.wbs_id);
  const supplier = suppliers.find((s) => s.id === f.supplier_id);
  const siblings = leaf ? leaves.filter((l) => l.parent_id === leaf.parent_id) : [];
  const order = orders.find((o) => o.id === f.order_id);
  const ownAlloc = initial?.allocations ?? [];
  const ownIn = (id: string) => (initial?.status && initial.status !== "borrador" ? ownAlloc.find((a) => a.wbs_id === id)?.amount ?? 0 : 0);

  // Agrupa las hojas por su padre para el selector
  const leafGroups = useMemo(() => {
    const visible = f.phase_id ? leaves.filter((l) => !l.phase_id || l.phase_id === f.phase_id) : leaves;
    const g = new Map<string, FormLeaf[]>();
    visible.forEach((l) => g.set(l.parent_label, [...(g.get(l.parent_label) ?? []), l]));
    return [...g.entries()];
  }, [leaves, f.phase_id]);

  // Al elegir WBS: fase y tipo de gasto sugeridos
  useEffect(() => {
    if (!leaf) return;
    setF((s) => ({ ...s, phase_id: s.phase_id || leaf.phase_id || s.phase_id, category: s.category || TYPE_CATEGORY[leaf.cost_type ?? ""] || "COMPRAS PROVEEDORES" }));
  }, [leaf]);
  // Tipo de doc: tickets/boletas se pagan al contado
  useEffect(() => {
    if (["BV", "TK"].includes(f.doc_type)) setF((s) => ({ ...s, due_date: s.reception_date }));
  }, [f.doc_type]);

  const allocations = split
    ? siblings.map((l) => ({ wbs_id: l.id, amount: Number(alloc[l.id]) || 0 })).filter((a) => a.amount > 0)
    : [{ wbs_id: f.wbs_id, amount: m.cost }];
  const allocSum = r2(allocations.reduce((s, a) => s + a.amount, 0));
  const allocDiff = r2(m.cost - allocSum);

  const orderBalance = order ? order.subtotal_pen - order.invoiced + (initial?.order_id === order.id ? (initial?.allocations ?? []).reduce((s, a) => s + a.amount, 0) : 0) : 0;
  const orderExceeds = order ? m.cost > orderBalance + 0.5 : false;
  const suggestedOrders = orders.filter((o) => (!f.wbs_id || o.wbs_id === f.wbs_id || (split && siblings.some((s) => s.id === o.wbs_id))) && (!f.supplier_id || o.supplier_id === f.supplier_id));
  const otherOrders = orders.filter((o) => !suggestedOrders.includes(o));

  const impact = allocations.map((a) => {
    const l = leaves.find((x) => x.id === a.wbs_id);
    return l ? { leaf: l, after: l.registered - ownIn(l.id) + a.amount } : null;
  }).filter(Boolean) as { leaf: FormLeaf; after: number }[];
  const exceeds = impact.some((i) => i.after > i.leaf.budget + 0.01);

  const onFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    // La ubicación se obtiene en paralelo: la subida no espera al GPS.
    const posP = geo ? Promise.resolve(geo) : currentPosition(6000);
    posP.then((pos) => {
      if (!pos) return;
      setGeo(pos);
      setFiles((s) => s.map((x) => (x.lat ? x : { ...x, lat: pos.lat, lng: pos.lng })));
    });
    await Promise.all(Array.from(list).map(async (file) => {
      if (file.size > 15 * 1024 * 1024) { toast.error(`${file.name} supera 15 MB`); return; }
      const key = crypto.randomUUID();
      const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
      setFiles((s) => [...s, { key, preview, uploading: true, path: "", name: file.name, mime: file.type, size: file.size, lat: geo?.lat ?? null, lng: geo?.lng ?? null, captured_at: new Date().toISOString() }]);
      try {
        const up = await uploadEvidence(file, { companyId, projectId, folder: "comprobantes" });
        setFiles((s) => s.map((x) => (x.key === key ? { ...x, uploading: false, path: up.path, size: up.size, mime: up.mime } : x)));
        toast.success("Sustento cargado", { description: `${file.name} · ${(up.size / 1024).toFixed(0)} KB` });
      } catch (e) {
        setFiles((s) => s.filter((x) => x.key !== key));
        toast.error("No se pudo subir el archivo", { description: e instanceof Error ? e.message : undefined });
      }
    }));
  };

  const validate = (mode: "borrador" | "declarado") => {
    const e: Record<string, string> = {};
    if (!f.supplier_id) e.supplier_id = "Selecciona el proveedor";
    if (!(total > 0)) e.total = "Ingresa el monto total";
    if (!f.phase_id) e.phase_id = "Fase obligatoria";
    if (!f.wbs_id) e.wbs_id = "WBS de último nivel obligatorio";
    if (!["TK", "OT"].includes(f.doc_type) && !f.doc_number.trim()) e.doc_number = "Número obligatorio";
    if (!f.description.trim()) e.description = "Describe el gasto";
    if (f.currency === "USD" && !(Number(f.exchange_rate) > 0)) e.exchange_rate = "Tipo de cambio obligatorio";
    if (split && Math.abs(allocDiff) > 0.01) e.split = `La distribución debe sumar ${money(m.cost)} (faltan ${money(allocDiff)})`;
    if (orderExceeds && !f.order_override) e.order = "Excede el saldo de la orden";
    if (mode === "declarado" && (initial?.existingFiles ?? 0) + files.filter((x) => x.path).length === 0) e.files = "Sustento obligatorio para declarar: adjunta foto o PDF";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (mode: "borrador" | "declarado") => {
    if (files.some((x) => x.uploading)) return toast.warning("Espera a que termine de subir el sustento");
    if (!validate(mode)) return toast.error("Revisa los campos marcados");
    setBusy(mode);
    let res: Awaited<ReturnType<typeof saveExpense>>;
    try {
      res = await saveExpense(companyCode, projectCode, {
        ...f, total, exchange_rate: Number(f.exchange_rate), retention_pct: Number(f.retention_pct) || 0,
        order_id: f.order_id || null, allocations: split ? allocations : [], files: files.filter((x) => x.path).map(({ path, name, mime, size, lat, lng, captured_at }) => ({ path, name, mime, size, lat, lng, captured_at })),
        lat: geo?.lat ?? null, lng: geo?.lng ?? null,
      }, mode, expenseId);
    } catch {
      setBusy(null);
      toast.error("Se perdió la conexión al guardar", { description: "Verifica en el listado de gastos si quedó registrado antes de reintentar (el sistema bloquea duplicados)." });
      return;
    }
    setBusy(null);
    if (!res.ok) return toast.error("No se pudo guardar", { description: res.error });
    toast.success(res.message ?? "Guardado", { description: `${supplier?.name ?? ""} · ${money(m.payable)}` });
    router.push(`${base}/gastos/${res.data!.id}`);
    router.refresh();
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-5">
        {initial?.observation && (
          <div className="flex gap-3 rounded-2xl border border-warn/30 bg-warn-50 p-4 text-sm text-[#7a4300]">
            <Info className="mt-0.5 h-5 w-5 shrink-0" />
            <div><p className="font-semibold">Observación de Gerencia</p><p>{initial.observation}</p></div>
          </div>
        )}

        {/* 1. Comprobante */}
        <Card>
          <CardHeader icon={<ReceiptText className="h-4 w-4" />} title="Comprobante" subtitle="Datos tal como figuran en la factura, boleta o recibo." />
          <CardBody className="space-y-4">
            <SupplierPicker suppliers={suppliers} value={f.supplier_id} error={errors.supplier_id} onChange={(id) => set("supplier_id", id)}
              onCreate={async (input) => {
                const r = await createSupplier(companyCode, projectCode, input);
                if (!r.ok) { toast.error(r.error); return false; }
                setSuppliers((s) => (s.some((x) => x.id === r.data!.id) ? s : [...s, { ...r.data!, kind: input.kind }]));
                set("supplier_id", r.data!.id);
                toast.success(r.message ?? "Proveedor registrado", { description: `${r.data!.name} · RUC ${r.data!.ruc}` });
                return true;
              }} />

            <div>
              <span className="mb-1.5 block text-xs font-semibold text-ink-soft">Tipo de documento <span className="text-danger-500">*</span></span>
              <div className="flex flex-wrap gap-1.5">
                {DOCS.map((d) => (
                  <button key={d} type="button" onClick={() => set("doc_type", d)}
                    className={cn("h-9 rounded-xl px-3 text-xs font-semibold ring-1 transition", f.doc_type === d ? "bg-navy-900 text-white ring-navy-900" : "bg-white text-ink-soft ring-line hover:text-ink")}>
                    {DOC_TYPE_LABEL[d]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Serie"><Input value={f.series} onChange={(e) => set("series", e.target.value.toUpperCase())} placeholder={f.doc_type === "BV" ? "B001" : f.doc_type === "RH" ? "E001" : "F001"} maxLength={6} /></Field>
              <Field label="Número" required={!["TK", "OT"].includes(f.doc_type)} error={errors.doc_number}><Input value={f.doc_number} onChange={(e) => set("doc_number", e.target.value.replace(/[^\dA-Za-z-]/g, ""))} placeholder="0004521" inputMode="numeric" /></Field>
              <Field label="Fecha de emisión" required><Input type="date" value={f.issue_date} max={today} onChange={(e) => set("issue_date", e.target.value)} /></Field>
              <Field label="Fecha de recepción"><Input type="date" value={f.reception_date} onChange={(e) => set("reception_date", e.target.value)} /></Field>
              <Field label="Fecha de vencimiento" hint="Ordena la bandeja de pagos de Contabilidad"><Input type="date" value={f.due_date} onChange={(e) => set("due_date", e.target.value)} /></Field>
              <Field label="Moneda">
                <Select value={f.currency} onChange={(e) => set("currency", e.target.value as "PEN" | "USD")}><option value="PEN">Soles (S/)</option><option value="USD">Dólares (US$)</option></Select>
              </Field>
              {f.currency === "USD" && (
                <Field label="Tipo de cambio del comprobante" required error={errors.exchange_rate}><Input type="number" step="0.001" min="0" value={f.exchange_rate} onChange={(e) => set("exchange_rate", Number(e.target.value))} /></Field>
              )}
              <Field label={`Monto total ${f.currency === "USD" ? "(US$)" : "(S/)"}`} required error={errors.total} hint={f.doc_type === "FT" ? "Importe total de la factura, IGV incluido" : "Importe total del documento"}>
                <Input type="number" step="0.01" min="0" value={f.total} onChange={(e) => set("total", e.target.value)} placeholder="0.00" className="num text-right font-semibold" />
              </Field>
              {f.doc_type === "FT" && (
                <Field label="Condición tributaria">
                  <Select value={f.tax_condition} onChange={(e) => set("tax_condition", e.target.value as ExpenseInput["tax_condition"])}>
                    <option value="gravado">Gravada con IGV 18%</option><option value="no_gravado">No gravada</option><option value="exonerado">Exonerada</option>
                  </Select>
                </Field>
              )}
              <Field label="Fondo de garantía %" hint="Retención a subcontratistas">
                <Input type="number" step="0.5" min="0" max="20" value={f.retention_pct} onChange={(e) => set("retention_pct", e.target.value)} />
              </Field>
            </div>
          </CardBody>
        </Card>

        {/* 2. Clasificación */}
        <Card>
          <CardHeader icon={<Layers className="h-4 w-4" />} title="Clasificación del gasto" subtitle="Obligatorio: obra, fase y WBS de último nivel (código de control)." />
          <CardBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
              <Field label="Fase" required error={errors.phase_id}>
                <Select value={f.phase_id} onChange={(e) => set("phase_id", e.target.value)}>
                  <option value="">Seleccionar…</option>
                  {phases.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name.split("·")[1]?.trim() ?? p.name}</option>)}
                </Select>
              </Field>
              <Field label="WBS / centro de costo" required error={errors.wbs_id}>
                <Select value={f.wbs_id} onChange={(e) => { set("wbs_id", e.target.value); setAlloc({}); }}>
                  <option value="">Seleccionar WBS de último nivel…</option>
                  {leafGroups.map(([group, list]) => (
                    <optgroup key={group} label={group}>
                      {list.map((l) => <option key={l.id} value={l.id}>{l.code} · {l.name}</option>)}
                    </optgroup>
                  ))}
                </Select>
              </Field>
            </div>

            {leaf && siblings.length > 1 && (
              <div className="rounded-2xl border border-line bg-slate-50/60 p-4">
                <label className="flex cursor-pointer items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-ink"><Split className="h-4 w-4 text-brand-blue" />Distribuir entre subcategorías</span>
                  <input type="checkbox" checked={split} onChange={(e) => { setSplit(e.target.checked); if (e.target.checked && !Object.keys(alloc).length) setAlloc({ [leaf.id]: String(m.cost) }); }} className="h-4 w-4 accent-[#035aa6]" />
                </label>
                <p className="mt-1 text-xs text-ink-muted">Un mismo comprobante puede repartirse entre las hojas de <b>{leaf.parent_label.split(" › ").pop()}</b> sin duplicarse.</p>
                <AnimatePresence>
                  {split && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="mt-3 space-y-2">
                        {siblings.map((l) => (
                          <div key={l.id} className="grid grid-cols-[minmax(0,1fr)_140px] items-center gap-3">
                            <span className="truncate text-sm"><b className="text-brand-blue">{l.code}</b> {l.name}</span>
                            <Input type="number" step="0.01" min="0" value={alloc[l.id] ?? ""} onChange={(e) => setAlloc((s) => ({ ...s, [l.id]: e.target.value }))} className="num h-9 text-right" placeholder="0.00" />
                          </div>
                        ))}
                        <div className={cn("flex justify-between rounded-xl px-3 py-2 text-xs font-semibold", Math.abs(allocDiff) < 0.01 ? "bg-ok-50 text-brand-green-700" : "bg-warn-50 text-[#9a5200]")}>
                          <span>Distribuido {money(allocSum)} de {money(m.cost)}</span>
                          <span>{Math.abs(allocDiff) < 0.01 ? "Cuadra ✓" : `Diferencia ${money(allocDiff)}`}</span>
                        </div>
                        {errors.split && <p className="text-xs font-medium text-danger">{errors.split}</p>}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Orden de servicio / compra" hint="Opcional · el comprobante descuenta el saldo de la orden" error={errors.order}>
                <Select value={f.order_id} onChange={(e) => set("order_id", e.target.value)}>
                  <option value="">Sin orden asociada</option>
                  {suggestedOrders.length > 0 && <optgroup label="Sugeridas (mismo WBS / proveedor)">{suggestedOrders.map((o) => <option key={o.id} value={o.id}>{o.number} · {o.title}</option>)}</optgroup>}
                  {otherOrders.length > 0 && <optgroup label="Otras órdenes aprobadas">{otherOrders.map((o) => <option key={o.id} value={o.id}>{o.number} · {o.title}</option>)}</optgroup>}
                </Select>
              </Field>
              <Field label="Tipo de gasto">
                <Select value={f.category} onChange={(e) => set("category", e.target.value)}>
                  <option value="">Seleccionar…</option>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </Select>
              </Field>
            </div>
            {order && (
              <div className={cn("rounded-2xl border p-4", orderExceeds ? "border-danger/30 bg-danger-50/60" : "border-line bg-white")}>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink"><Link2 className="h-4 w-4 text-brand-blue" />{order.number} · {order.title}</div>
                <BatteryBar value={order.subtotal_pen - orderBalance + m.cost} total={order.subtotal_pen} label={`Facturado + este comprobante: ${money(order.subtotal_pen - orderBalance + m.cost)} de ${money(order.subtotal_pen)}`} />
                <p className="mt-2 text-xs text-ink-muted">Saldo de la orden antes de este comprobante: <b className="text-ink">{money(orderBalance)}</b></p>
                {orderExceeds && (
                  <div className="mt-3 space-y-2">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-danger"><AlertOctagon className="h-4 w-4" />La factura excede el saldo de la orden en {money(m.cost - orderBalance)}.</p>
                    {canOverride ? (
                      <label className="flex items-center gap-2 text-xs font-semibold text-ink"><input type="checkbox" checked={f.order_override} onChange={(e) => set("order_override", e.target.checked)} className="accent-[#c8102e]" />Autorizo como Gerencia (aprobación especial)</label>
                    ) : <p className="text-xs text-ink-muted">Solo Gerencia puede autorizar el exceso. Solicita una ampliación de la orden.</p>}
                  </div>
                )}
              </div>
            )}
            <Field label="Descripción del gasto" required error={errors.description}>
              <Textarea value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Ej.: 120 kg de alambre N° 16 para encofrado de losa — Torre A piso 6" maxLength={300} />
            </Field>
          </CardBody>
        </Card>

        {/* 3. Sustento */}
        <Card>
          <CardHeader icon={<Camera className="h-4 w-4" />} title="Sustento del comprobante" subtitle="Foto o PDF obligatorio para declarar. La foto se comprime y guarda fecha, hora y ubicación GPS." />
          <CardBody>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
            <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
              className={cn("rounded-2xl border-2 border-dashed p-6 text-center transition", errors.files ? "border-danger/40 bg-danger-50/40" : "border-line bg-slate-50/50 hover:border-brand-blue/40")}>
              <ImagePlus className="mx-auto h-9 w-9 text-brand-blue" />
              <p className="mt-2 text-sm font-semibold text-ink">Arrastra la foto o el PDF del comprobante</p>
              <p className="text-xs text-ink-muted">JPG, PNG o PDF · máx. 15 MB</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button type="button" variant="primary" size="sm" onClick={() => camRef.current?.click()}><Camera className="h-4 w-4" />Tomar foto</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Plus className="h-4 w-4" />Elegir archivo</Button>
              </div>
              {errors.files && <p className="mt-3 text-xs font-semibold text-danger">{errors.files}</p>}
              {(initial?.existingFiles ?? 0) > 0 && <p className="mt-3 text-xs font-medium text-brand-green-700">Ya tiene {initial!.existingFiles} sustento(s) adjunto(s).</p>}
            </div>
            {files.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {files.map((x) => (
                  <motion.div key={x.key} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="group relative overflow-hidden rounded-xl border border-line bg-white">
                    {x.preview ? <img src={x.preview} alt={x.name} className="h-28 w-full object-cover" /> : <div className="grid h-28 place-items-center bg-danger-50"><FileText className="h-8 w-8 text-danger-500" /></div>}
                    <div className="px-2 py-1.5"><p className="truncate text-[11px] font-medium">{x.name}</p>
                      <p className="flex items-center gap-1 text-[10px] text-ink-muted">{x.uploading ? <><LoaderCircle className="h-3 w-3 animate-spin" />Subiendo…</> : <><Check className="h-3 w-3 text-brand-green-600" />{(x.size / 1024).toFixed(0)} KB{x.lat ? <> · <MapPin className="h-3 w-3" />GPS</> : null}</>}</p>
                    </div>
                    {!x.uploading && <button type="button" onClick={() => setFiles((s) => s.filter((y) => y.key !== x.key))} className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-lg bg-white/90 text-danger opacity-0 shadow transition group-hover:opacity-100" aria-label="Quitar"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </motion.div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Resumen lateral */}
      <div className="space-y-5 xl:sticky xl:top-20 xl:self-start">
        <Card className="overflow-hidden">
          <div className="bg-[linear-gradient(135deg,#062a4d,#035aa6)] px-5 py-4 text-white">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">Monto a pagar</p>
            <motion.p key={m.payable} initial={{ opacity: 0.4, y: -4 }} animate={{ opacity: 1, y: 0 }} className="num font-display text-3xl font-semibold">{money(m.payable)}</motion.p>
            <p className="text-xs text-white/60">{supplier ? supplier.name : "Selecciona el proveedor"}</p>
          </div>
          <CardBody className="space-y-2 text-sm">
            {[
              ["Base imponible", m.subtotal * (f.currency === "USD" ? m.rate : 1)],
              ["IGV 18%", m.igv * (f.currency === "USD" ? m.rate : 1)],
              ["Total en soles", m.totalPen],
              ["Fondo de garantía", -m.retention],
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between"><span className="text-ink-muted">{k}</span><span className="num font-medium">{money(v)}</span></div>
            ))}
            <div className="flex justify-between border-t border-line pt-2"><span className="font-semibold text-ink">Costo cargado al WBS</span><span className="num font-semibold text-brand-blue">{money(m.cost)}</span></div>
            <p className="text-[11px] text-ink-muted">{f.doc_type === "FT" && f.tax_condition === "gravado" ? "La factura gravada carga la base sin IGV (crédito fiscal)." : `${DOC_TYPE_LABEL[f.doc_type]}: se carga el importe total.`}{f.currency === "USD" ? ` Convertido con TC ${Number(f.exchange_rate).toFixed(3)}.` : ""}</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Impacto en el presupuesto" subtitle="Registrado + este comprobante vs. proyectado" />
          <CardBody className="space-y-4">
            {impact.length ? impact.map((i) => (
              <div key={i.leaf.id}>
                <p className="mb-1 text-xs font-semibold text-ink"><span className="text-brand-blue">{i.leaf.code}</span> {i.leaf.name}</p>
                <BatteryBar value={i.after} total={i.leaf.budget} label={`${money(i.after)} de ${money(i.leaf.budget)}`} />
                <p className="mt-1 text-[11px] text-ink-muted">Pagado por Contabilidad: {money(i.leaf.paid)} · Saldo tras el gasto: <b className={i.leaf.budget - i.after < 0 ? "text-danger" : "text-ink"}>{money(i.leaf.budget - i.after)}</b> · {COST_TYPE_LABEL[i.leaf.cost_type ?? ""] ?? ""}</p>
              </div>
            )) : <p className="text-sm text-ink-muted">Elige el WBS para ver cómo queda su batería de consumo.</p>}
            {exceeds && (
              <div className="flex gap-2 rounded-xl bg-danger-50 p-3 text-xs text-danger">
                <AlertOctagon className="h-4 w-4 shrink-0" />
                <p><b>Deja el WBS en negativo.</b> Se registrará con la marca “Excede WBS” y requerirá aprobación de Gerencia.</p>
              </div>
            )}
          </CardBody>
        </Card>

        <div className="sticky bottom-0 z-10 -mx-4 flex gap-2 border-t border-line bg-white/95 p-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border xl:static">
          <Button type="button" variant="outline" className="flex-1" disabled={!!busy} onClick={() => submit("borrador")}>
            {busy === "borrador" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Guardar borrador
          </Button>
          <Button type="button" className="flex-1" disabled={!!busy} onClick={() => submit("declarado")}>
            {busy === "declarado" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Declarar
          </Button>
        </div>
      </div>
    </div>
  );
}

function SupplierPicker({ suppliers, value, onChange, onCreate, error }: {
  suppliers: FormSupplier[]; value: string; onChange: (id: string) => void; error?: string;
  onCreate: (input: { ruc: string; name: string; kind: string }) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [nw, setNw] = useState({ ruc: "", name: "", kind: "proveedor" });
  const [saving, setSaving] = useState(false);
  const sel = suppliers.find((s) => s.id === value);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (t ? suppliers.filter((s) => `${s.name} ${s.ruc}`.toLowerCase().includes(t)) : suppliers).slice(0, 60);
  }, [q, suppliers]);
  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold text-ink-soft">Proveedor (RUC / DNI) <span className="text-danger-500">*</span></span>
      <button type="button" onClick={() => setOpen(true)} className={cn("flex h-11 w-full items-center gap-3 rounded-xl border bg-white px-3.5 text-left text-sm transition hover:border-brand-blue/50", error ? "border-danger/50" : "border-line")}>
        {sel ? <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-ink">{sel.name}</span><span className="block text-[11px] text-ink-muted">RUC {sel.ruc}</span></span>
          : <span className="flex-1 text-ink-muted">Buscar por razón social o RUC…</span>}
        <ChevronsUpDown className="h-4 w-4 text-ink-muted" />
      </button>
      {error && <span className="mt-1 block text-xs font-medium text-danger">{error}</span>}
      <Modal open={open} onOpenChange={(o) => { setOpen(o); if (!o) setCreating(false); }} title={creating ? "Nuevo proveedor" : "Seleccionar proveedor"} description={creating ? "Se registra en el catálogo de la empresa." : `${suppliers.length} proveedores en el catálogo`} size="md">
        {creating ? (
          <div className="space-y-4">
            <Field label="RUC (11 dígitos) o DNI (8 dígitos)" required><Input value={nw.ruc} onChange={(e) => setNw({ ...nw, ruc: e.target.value.replace(/\D/g, "").slice(0, 11) })} inputMode="numeric" placeholder="20601234567" autoFocus /></Field>
            <Field label="Razón social / nombre" required><Input value={nw.name} onChange={(e) => setNw({ ...nw, name: e.target.value })} placeholder="FERRETERÍA EL CONSTRUCTOR E.I.R.L." /></Field>
            <Field label="Tipo">
              <Select value={nw.kind} onChange={(e) => setNw({ ...nw, kind: e.target.value })}>
                <option value="proveedor">Proveedor</option><option value="subcontratista">Subcontratista</option><option value="trabajador">Persona natural / trabajador</option><option value="entidad">Entidad</option>
              </Select>
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreating(false)}>Volver</Button>
              <Button disabled={saving} onClick={async () => { setSaving(true); const ok = await onCreate(nw); setSaving(false); if (ok) { setOpen(false); setCreating(false); setNw({ ruc: "", name: "", kind: "proveedor" }); } }}>
                {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Registrar
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Razón social o RUC" className="pl-9" />
              {q && <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"><X className="h-4 w-4" /></button>}
            </div>
            <div className="scrollbar-thin mt-3 max-h-[50vh] space-y-1 overflow-y-auto">
              {list.map((s) => (
                <button key={s.id} type="button" onClick={() => { onChange(s.id); setOpen(false); }}
                  className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-brand-blue-50", s.id === value && "bg-brand-blue-50")}>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{s.name}</span><span className="block text-[11px] text-ink-muted">RUC {s.ruc} · {s.kind}</span></span>
                  {s.id === value && <Check className="h-4 w-4 text-brand-blue" />}
                </button>
              ))}
              {!list.length && <p className="py-6 text-center text-sm text-ink-muted">No se encontró “{q}”.</p>}
            </div>
            <Button variant="subtle" className="mt-3 w-full" onClick={() => { setCreating(true); setNw((n) => ({ ...n, ruc: /^\d+$/.test(q) ? q : "", name: /^\d+$/.test(q) ? "" : q })); }}>
              <UserPlus className="h-4 w-4" />Registrar proveedor nuevo
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
