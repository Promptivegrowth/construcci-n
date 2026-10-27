"use client";
import { motion } from "framer-motion";
import { ClipboardList, LoaderCircle, Package, Plus, Send, Trash2, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { BatteryBar } from "@/components/ui/battery";
import { Button, Card, CardBody, CardHeader, cn, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { addDaysISO, money, todayISO } from "@/lib/format";
import type { FormLeaf, FormSupplier } from "../../gastos/_components/form-data";
import { createOrder, type OrderInput } from "../actions";

type Item = { key: string; description: string; unit: string; quantity: string; unit_price: string; material_id: string };
type Material = { id: string; code: string; name: string; unit: string };

const PRESETS: Record<"OS" | "OC", { title: string; items: Omit<Item, "key">[] }[]> = {
  OS: [
    { title: "Alquiler de equipos menores (vibradoras, amoladoras, taladros)", items: [{ description: "Alquiler de equipos menores — monto global proyectado", unit: "glb", quantity: "1", unit_price: "10000", material_id: "" }] },
    { title: "Alquiler de estación total", items: [{ description: "Alquiler mensual de estación total con prisma y trípode", unit: "mes", quantity: "6", unit_price: "3800", material_id: "" }] },
    { title: "Servicio de internet para obra", items: [{ description: "Internet dedicado — mensualidad", unit: "mes", quantity: "12", unit_price: "400", material_id: "" }] },
    { title: "Alquiler de laptops para oficina técnica", items: [{ description: "Laptop i7 16 GB — alquiler mensual", unit: "mes", quantity: "6", unit_price: "380", material_id: "" }] },
  ],
  OC: [
    { title: "Compra de EPP y uniformes", items: [{ description: "Casco con barbiquejo", unit: "und", quantity: "30", unit_price: "28", material_id: "" }, { description: "Guantes de cuero reforzado", unit: "par", quantity: "60", unit_price: "12.5", material_id: "" }] },
    { title: "Compra de consumibles (alambre y clavos)", items: [{ description: "Alambre negro N° 16", unit: "kg", quantity: "400", unit_price: "5.6", material_id: "" }, { description: "Clavo para madera 3\"", unit: "kg", quantity: "200", unit_price: "5.3", material_id: "" }] },
  ],
};

const blank = (): Item => ({ key: crypto.randomUUID(), description: "", unit: "und", quantity: "1", unit_price: "", material_id: "" });

export function OrderForm({ companyCode, projectCode, suppliers, leaves, materials, canApprove, projectEnd }: {
  companyCode: string; projectCode: string; suppliers: FormSupplier[]; leaves: FormLeaf[]; materials: Material[]; canApprove: boolean; projectEnd: string | null;
}) {
  const router = useRouter();
  const [type, setType] = useState<"OS" | "OC">("OS");
  const [f, setF] = useState({ supplier_id: "", wbs_id: "", title: "", description: "", currency: "PEN" as "PEN" | "USD", exchange_rate: "3.75", includes_igv: true,
    billing_frequency: "mensual" as OrderInput["billing_frequency"], start_date: todayISO(), end_date: projectEnd ?? addDaysISO(todayISO(), 180), notes: "" });
  const [items, setItems] = useState<Item[]>([blank()]);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const base = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0);
  const igv = f.includes_igv ? base * 0.18 : 0;
  const leaf = leaves.find((l) => l.id === f.wbs_id);
  const groups = [...leaves.reduce((m, l) => m.set(l.parent_label, [...(m.get(l.parent_label) ?? []), l]), new Map<string, FormLeaf[]>()).entries()];

  const submit = async () => {
    setBusy(true);
    try {
      const r = await createOrder(companyCode, projectCode, {
        ...f, order_type: type, exchange_rate: Number(f.exchange_rate) || 1,
        items: items.map((i) => ({ description: i.description, unit: i.unit, quantity: Number(i.quantity) || 0, unit_price: Number(i.unit_price) || 0, material_id: i.material_id || null })),
      });
      if (!r.ok) return toast.error("No se registró la orden", { description: r.error });
      toast.success(r.message ?? "Orden registrada");
      router.push(`/empresa/${companyCode}/obra/${projectCode}/ordenes/${r.data!.id}`);
      router.refresh();
    } catch {
      toast.error("Se perdió la conexión", { description: "Revisa el listado de órdenes antes de reintentar." });
    } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {(["OS", "OC"] as const).map((t) => (
            <button key={t} type="button" onClick={() => { setType(t); set("billing_frequency", t === "OS" ? "mensual" : "unica"); }}
              className={cn("flex items-center gap-4 rounded-2xl border-2 bg-white p-4 text-left transition", type === t ? "border-brand-blue shadow-card" : "border-line hover:border-brand-blue/30")}>
              <span className={cn("grid h-12 w-12 place-items-center rounded-2xl", t === "OS" ? "bg-brand-blue-50 text-brand-blue" : "bg-ok-50 text-brand-green-700")}>{t === "OS" ? <Wrench className="h-6 w-6" /> : <Package className="h-6 w-6" />}</span>
              <span><span className="block font-display font-semibold">{t === "OS" ? "Orden de servicio" : "Orden de compra"}</span>
                <span className="block text-xs text-ink-muted">{t === "OS" ? "Alquileres y servicios con monto global que se consume por factura" : "Materiales, EPP, uniformes e insumos"}</span></span>
            </button>
          ))}
        </div>

        <Card>
          <CardHeader icon={<ClipboardList className="h-4 w-4" />} title="Datos de la orden" subtitle="Plantillas rápidas:" actions={null} />
          <CardBody className="space-y-4">
            <div className="-mt-2 flex flex-wrap gap-1.5">
              {PRESETS[type].map((p) => (
                <button key={p.title} type="button" onClick={() => { set("title", p.title); setItems(p.items.map((i) => ({ ...i, key: crypto.randomUUID() }))); }}
                  className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-ink-soft transition hover:bg-brand-blue-50 hover:text-brand-blue">{p.title}</button>
              ))}
            </div>
            <Field label="Objeto de la orden" required><Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Ej.: Alquiler de equipos menores para la obra" /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Proveedor" required>
                <Select value={f.supplier_id} onChange={(e) => set("supplier_id", e.target.value)}>
                  <option value="">Seleccionar proveedor…</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.ruc}</option>)}
                </Select>
              </Field>
              <Field label="WBS al que se carga" required>
                <Select value={f.wbs_id} onChange={(e) => set("wbs_id", e.target.value)}>
                  <option value="">Seleccionar WBS…</option>
                  {groups.map(([g, list]) => <optgroup key={g} label={g}>{list.map((l) => <option key={l.id} value={l.id}>{l.code} · {l.name}</option>)}</optgroup>)}
                </Select>
              </Field>
              <Field label="Frecuencia de facturación">
                <Select value={f.billing_frequency} onChange={(e) => set("billing_frequency", e.target.value as OrderInput["billing_frequency"])}>
                  <option value="unica">Única</option><option value="semanal">Semanal</option><option value="quincenal">Quincenal</option><option value="mensual">Mensual</option>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Inicio"><Input type="date" value={f.start_date} onChange={(e) => set("start_date", e.target.value)} /></Field>
                <Field label="Fin"><Input type="date" value={f.end_date} onChange={(e) => set("end_date", e.target.value)} /></Field>
              </div>
              <Field label="Moneda">
                <Select value={f.currency} onChange={(e) => set("currency", e.target.value as "PEN" | "USD")}><option value="PEN">Soles</option><option value="USD">Dólares</option></Select>
              </Field>
              {f.currency === "USD" ? <Field label="Tipo de cambio"><Input type="number" step="0.001" value={f.exchange_rate} onChange={(e) => set("exchange_rate", e.target.value)} /></Field>
                : <label className="flex items-end gap-2 pb-2.5 text-sm font-semibold"><input type="checkbox" checked={f.includes_igv} onChange={(e) => set("includes_igv", e.target.checked)} className="h-4 w-4 accent-[#035aa6]" />Afecta a IGV 18%</label>}
            </div>
            <Field label="Descripción / condiciones"><Textarea value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Alcance, condiciones de pago, lugar de entrega…" /></Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Ítems" subtitle="Precios unitarios sin IGV" actions={<Button size="sm" variant="subtle" type="button" onClick={() => setItems((s) => [...s, blank()])}><Plus className="h-4 w-4" />Agregar ítem</Button>} />
          <CardBody className="space-y-3">
            {items.map((it, idx) => (
              <motion.div key={it.key} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="grid gap-2 rounded-xl border border-line-soft p-3 sm:grid-cols-[minmax(0,1fr)_80px_90px_110px_110px_36px] sm:items-end">
                <Field label={idx === 0 ? "Descripción" : ""}>
                  {type === "OC" && materials.length > 0 ? (
                    <div className="flex gap-2">
                      <Select className="w-32 shrink-0" value={it.material_id} onChange={(e) => {
                        const m = materials.find((x) => x.id === e.target.value);
                        setItems((s) => s.map((x) => x.key === it.key ? { ...x, material_id: e.target.value, description: m ? m.name : x.description, unit: m ? m.unit : x.unit } : x));
                      }}>
                        <option value="">Catálogo…</option>
                        {materials.map((m) => <option key={m.id} value={m.id}>{m.code} · {m.name}</option>)}
                      </Select>
                      <Input value={it.description} onChange={(e) => setItems((s) => s.map((x) => x.key === it.key ? { ...x, description: e.target.value } : x))} placeholder="Descripción" />
                    </div>
                  ) : <Input value={it.description} onChange={(e) => setItems((s) => s.map((x) => x.key === it.key ? { ...x, description: e.target.value } : x))} placeholder="Descripción del ítem" />}
                </Field>
                <Field label={idx === 0 ? "Unidad" : ""}><Input value={it.unit} onChange={(e) => setItems((s) => s.map((x) => x.key === it.key ? { ...x, unit: e.target.value } : x))} /></Field>
                <Field label={idx === 0 ? "Cantidad" : ""}><Input type="number" min="0" step="0.01" className="num text-right" value={it.quantity} onChange={(e) => setItems((s) => s.map((x) => x.key === it.key ? { ...x, quantity: e.target.value } : x))} /></Field>
                <Field label={idx === 0 ? "P. unitario" : ""}><Input type="number" min="0" step="0.01" className="num text-right" value={it.unit_price} onChange={(e) => setItems((s) => s.map((x) => x.key === it.key ? { ...x, unit_price: e.target.value } : x))} placeholder="0.00" /></Field>
                <div className="num pb-2.5 text-right text-sm font-semibold">{money((Number(it.quantity) || 0) * (Number(it.unit_price) || 0))}</div>
                <button type="button" disabled={items.length === 1} onClick={() => setItems((s) => s.filter((x) => x.key !== it.key))} className="mb-1 grid h-9 w-9 place-items-center rounded-lg text-danger hover:bg-danger-50 disabled:opacity-30" aria-label="Quitar"><Trash2 className="h-4 w-4" /></button>
              </motion.div>
            ))}
          </CardBody>
        </Card>
      </div>

      <div className="space-y-5 xl:sticky xl:top-20 xl:self-start">
        <Card className="overflow-hidden">
          <div className="bg-[linear-gradient(135deg,#062a4d,#035aa6)] px-5 py-4 text-white">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">Monto global de la orden</p>
            <p className="num font-display text-3xl font-semibold">{money(base + igv)}</p>
            <p className="text-xs text-white/60">{type === "OS" ? "Orden de servicio" : "Orden de compra"} · {f.currency === "USD" ? "US$" : "S/"}</p>
          </div>
          <CardBody className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-ink-muted">Subtotal (compromete el WBS)</span><span className="num font-semibold">{money(base)}</span></div>
            <div className="flex justify-between"><span className="text-ink-muted">IGV</span><span className="num">{money(igv)}</span></div>
          </CardBody>
        </Card>
        {leaf && (
          <Card>
            <CardHeader title="Disponibilidad del WBS" subtitle={`${leaf.code} · ${leaf.name}`} />
            <CardBody>
              <BatteryBar value={leaf.registered + base} total={leaf.budget} label={`Registrado + esta orden: ${money(leaf.registered + base)} de ${money(leaf.budget)}`} />
              <p className="mt-2 text-xs text-ink-muted">La orden se suma como <b>comprometido</b> hasta que se facturen sus comprobantes.</p>
            </CardBody>
          </Card>
        )}
        <Button className="w-full" size="lg" disabled={busy} onClick={submit}>
          {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Send className="h-4 w-4" />}{canApprove ? "Emitir orden aprobada" : "Enviar solicitud a Gerencia"}
        </Button>
        {!canApprove && <p className="text-center text-xs text-ink-muted">Tu rol solicita la orden; Gerencia la aprueba antes de emitirla al proveedor.</p>}
      </div>
    </div>
  );
}
