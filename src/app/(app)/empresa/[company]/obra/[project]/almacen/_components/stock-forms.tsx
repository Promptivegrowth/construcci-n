"use client";
import { ArrowDownToLine, ArrowUpFromLine, Camera, LoaderCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/dialog";
import { Button, Field, Input, Select, Textarea, cn } from "@/components/ui/primitives";
import { money, number, todayISO } from "@/lib/format";
import { uploadEvidence } from "@/lib/upload";
import { registerStockIn, registerStockOut } from "../actions";

export type FormMaterial = { id: string; code: string; name: string; unit: string; category: string; stock: number; avg: number };
export type FormCtx = {
  companyCode: string; projectCode: string; companyId: string; projectId: string; userName: string;
  materials: FormMaterial[];
  leaves: { id: string; code: string; name: string; phase_id: string | null; cost_type: string | null }[];
  phases: { id: string; code: string; name: string; start: string | null }[];
  suppliers: { id: string; name: string; ruc: string }[];
  orders: { id: string; number: string; title: string; supplier_id: string | null }[];
};

export function StockMovementModal({ open, onOpenChange, kind, ctx, materialId }: {
  open: boolean; onOpenChange: (o: boolean) => void; kind: "ingreso" | "salida"; ctx: FormCtx; materialId?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mat, setMat] = useState(materialId ?? "");
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const [moved, setMoved] = useState(todayISO());
  const [supplier, setSupplier] = useState("");
  const [order, setOrder] = useState("");
  const [doc, setDoc] = useState("");
  const [resp, setResp] = useState(kind === "ingreso" ? ctx.userName : "");
  const [wbs, setWbs] = useState("");
  const [front, setFront] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [q, setQ] = useState("");

  const material = ctx.materials.find((m) => m.id === mat);
  const phaseFor = (d: string) => [...ctx.phases].reverse().find((p) => p.start && d >= p.start)?.id ?? null;
  const leaves = ctx.leaves.filter((l) => l.cost_type !== "gastos_generales" || true);
  const filteredMats = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? ctx.materials.filter((m) => `${m.code} ${m.name}`.toLowerCase().includes(t)) : ctx.materials;
  }, [q, ctx.materials]);
  const qn = Number(qty) || 0;
  const over = kind === "salida" && material && qn > material.stock + 1e-6;

  const reset = () => { setQty(""); setCost(""); setDoc(""); setNotes(""); setPhoto(null); setFront(""); };

  const submit = () => start(async () => {
    let photo_path: string | null = null;
    if (photo) {
      try {
        photo_path = (await uploadEvidence(photo, { companyId: ctx.companyId, projectId: ctx.projectId, folder: "almacen" })).path;
      } catch (e) {
        return void toast.error("No se subió la foto", { description: e instanceof Error ? e.message : undefined });
      }
    }
    const wbsLeaf = ctx.leaves.find((l) => l.id === wbs);
    const res = kind === "ingreso"
      ? await registerStockIn(ctx.companyCode, ctx.projectCode, { material_id: mat, quantity: qn, unit_cost: Number(cost) || 0, moved_at: moved, supplier_id: supplier || null, order_id: order || null, document_ref: doc, responsible_name: resp, notes, photo_path })
      : await registerStockOut(ctx.companyCode, ctx.projectCode, { material_id: mat, quantity: qn, moved_at: moved, wbs_id: wbs, phase_id: wbsLeaf?.phase_id ?? phaseFor(moved), front, responsible_name: resp, notes });
    if (!res.ok) return void toast.error(kind === "ingreso" ? "No se registró el ingreso" : "No se registró la salida", { description: res.error });
    toast.success(res.message ?? "Registrado", { description: material ? `${number(qn)} ${material.unit} · ${material.name}` : undefined });
    reset();
    onOpenChange(false);
    router.refresh();
  });

  const Icon = kind === "ingreso" ? ArrowDownToLine : ArrowUpFromLine;
  return (
    <Modal open={open} onOpenChange={onOpenChange} size="lg"
      title={<span className="flex items-center gap-2"><span className={cn("grid h-8 w-8 place-items-center rounded-lg", kind === "ingreso" ? "bg-ok-50 text-brand-green-700" : "bg-warn-50 text-[#9a5200]")}><Icon className="h-4 w-4" /></span>{kind === "ingreso" ? "Ingreso a almacén" : "Salida / consumo de material"}</span>}
      description={kind === "ingreso" ? "Registra cantidades y costo: alimenta el kardex valorizado y el costo promedio." : "Toda salida se carga a un WBS (código de control) y a un frente de trabajo."}
      footer={<>
        {qn > 0 && kind === "ingreso" && <span className="mr-auto self-center text-sm text-ink-soft">Total: <b className="num text-navy-900">{money(qn * (Number(cost) || 0))}</b></span>}
        {qn > 0 && kind === "salida" && material && <span className="mr-auto self-center text-sm text-ink-soft">Valorizado aprox.: <b className="num text-navy-900">{money(qn * material.avg)}</b></span>}
        <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
        <Button variant={kind === "ingreso" ? "success" : "primary"} onClick={submit} disabled={pending || !mat || qn <= 0 || !!over}>
          {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}{kind === "ingreso" ? "Registrar ingreso" : "Registrar salida"}
        </Button>
      </>}>
      <div className="space-y-4">
        <Field label="Material" required>
          <div className="space-y-2">
            {!materialId && <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar: alambre, clavo, madera, agua…" />}
            <Select value={mat} onChange={(e) => { setMat(e.target.value); const m = ctx.materials.find((x) => x.id === e.target.value); if (m && kind === "ingreso" && !cost) setCost(m.avg ? m.avg.toFixed(2) : ""); }}>
              <option value="">Selecciona un material…</option>
              {filteredMats.map((m) => <option key={m.id} value={m.id}>{m.code} · {m.name} ({m.unit}){kind === "salida" ? ` — stock ${number(m.stock)}` : ""}</option>)}
            </Select>
          </div>
        </Field>
        {material && (
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-xs">
            <div><p className="text-ink-muted">Stock actual</p><p className="num font-semibold text-ink">{number(material.stock)} {material.unit}</p></div>
            <div><p className="text-ink-muted">Costo promedio</p><p className="num font-semibold text-ink">{money(material.avg)}</p></div>
            <div><p className="text-ink-muted">Valor en almacén</p><p className="num font-semibold text-ink">{money(material.stock * material.avg)}</p></div>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={`Cantidad${material ? ` (${material.unit})` : ""}`} required error={over ? `Supera el stock disponible (${number(material!.stock)})` : null}>
            <Input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" />
          </Field>
          {kind === "ingreso" ? (
            <Field label="Costo unitario (S/, sin IGV)" required><Input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" /></Field>
          ) : (
            <Field label="Frente de trabajo"><Input value={front} onChange={(e) => setFront(e.target.value)} placeholder="Sector 3 — Bloque B" /></Field>
          )}
          <Field label="Fecha" required><Input type="date" value={moved} max={todayISO()} onChange={(e) => setMoved(e.target.value)} /></Field>
        </div>
        {kind === "ingreso" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Proveedor">
                <Select value={supplier} onChange={(e) => setSupplier(e.target.value)}>
                  <option value="">—</option>
                  {ctx.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
              <Field label="Orden de compra">
                <Select value={order} onChange={(e) => setOrder(e.target.value)}>
                  <option value="">Sin O/C</option>
                  {ctx.orders.filter((o) => !supplier || o.supplier_id === supplier).map((o) => <option key={o.id} value={o.id}>{o.number} · {o.title}</option>)}
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Guía de remisión / comprobante"><Input value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="GR EG01-000123" /></Field>
              <Field label="Recibido por" required><Input value={resp} onChange={(e) => setResp(e.target.value)} /></Field>
            </div>
            <Field label="Foto de la guía o del material" hint="Opcional · se comprime automáticamente">
              {photo ? (
                <div className="flex items-center gap-3 rounded-xl border border-line p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={URL.createObjectURL(photo)} alt="" className="h-14 w-14 rounded-lg object-cover" />
                  <span className="flex-1 truncate text-sm">{photo.name}</span>
                  <button type="button" onClick={() => setPhoto(null)} className="rounded-lg p-1.5 text-ink-muted hover:bg-line-soft"><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line px-4 py-4 text-sm font-medium text-ink-muted transition hover:border-brand-blue/40 hover:text-brand-blue">
                  <Camera className="h-4 w-4" /> Tomar foto o adjuntar
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
                </label>
              )}
            </Field>
          </>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="WBS (código de control)" required hint="Centro de costo al que se carga el consumo">
              <Select value={wbs} onChange={(e) => setWbs(e.target.value)}>
                <option value="">Selecciona el WBS…</option>
                {leaves.map((l) => <option key={l.id} value={l.id}>{l.code} · {l.name}</option>)}
              </Select>
            </Field>
            <Field label="Retirado por" required><Input value={resp} onChange={(e) => setResp(e.target.value)} placeholder="Nombre del capataz o trabajador" /></Field>
          </div>
        )}
        <Field label="Observaciones"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

/** Botones de ingreso/salida con sus modales. */
export function StockButtons({ ctx, size = "md" }: { ctx: FormCtx; size?: "sm" | "md" }) {
  const [kind, setKind] = useState<null | "ingreso" | "salida">(null);
  return (
    <>
      <Button size={size} variant="success" onClick={() => setKind("ingreso")}><ArrowDownToLine className="h-4 w-4" />Ingreso</Button>
      <Button size={size} onClick={() => setKind("salida")}><ArrowUpFromLine className="h-4 w-4" />Salida</Button>
      {kind && <StockMovementModal key={kind} open={!!kind} onOpenChange={(o) => !o && setKind(null)} kind={kind} ctx={ctx} />}
    </>
  );
}
