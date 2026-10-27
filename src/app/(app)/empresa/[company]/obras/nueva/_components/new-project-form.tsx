"use client";
import { motion } from "framer-motion";
import { Building2, CalendarRange, Copy, Crosshair, FilePlus2, LoaderCircle, MapPin, Rocket, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button, Card, Field, Input, Select, cn } from "@/components/ui/primitives";
import { money } from "@/lib/format";
import { currentPosition } from "@/lib/upload";
import { createProject, type NewProjectInput } from "../actions";

type Opt = { id: string; label: string };
type Tpl = { id: string; label: string; type: string; nodes: number; leaves: number };

const TYPES = [
  { v: "edificacion", l: "Edificación", d: "4 fases: sótanos, casco, acabados húmedos y secos" },
  { v: "infraestructura", l: "Infraestructura", d: "Vías, hospitales, obras de arte" },
  { v: "mineria", l: "Minería", d: "Campamentos, muros, plataformas" },
  { v: "saneamiento", l: "Saneamiento", d: "Agua potable y desagüe" },
];

function abbr(name: string) {
  const stop = new Set(["DE", "DEL", "LA", "LAS", "LOS", "EL", "Y", "EN", "PARA", "CON", "A"]);
  const words = name.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter((w) => w && !stop.has(w));
  return words.map((w) => w[0]).join("").slice(0, 4) || "OBRA";
}

function Section({ icon, title, subtitle, children }: { icon: ReactNode; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-blue-50 text-brand-blue">{icon}</span>
        <div><h2 className="font-display text-base font-semibold">{title}</h2>{subtitle && <p className="text-xs text-ink-muted">{subtitle}</p>}</div>
      </div>
      {children}
    </Card>
  );
}

export function NewProjectForm({ companyCode, nextNumber, managers, admins, residents, templates, defaultManager }: {
  companyCode: string; nextNumber: string; managers: Opt[]; admins: Opt[]; residents: Opt[]; templates: Tpl[]; defaultManager: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [codeTouched, setCodeTouched] = useState(false);
  const [f, setF] = useState<NewProjectInput & { lat: number | null; lng: number | null }>({
    code: `${nextNumber}-OBRA`, name: "", short_name: "", client_name: "", client_ruc: "", project_type: "edificacion", location: "", address: "", region: "",
    start_date: "", end_date: "", contract_amount: 0, exchange_rate: 3.75, status: "preparacion", manager_id: defaultManager, admin_id: "", resident_id: "",
    lat: null, lng: null, geofence_radius: 200, alert_threshold: 80, template_id: "",
  });
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  const tpl = templates.find((t) => t.id === f.template_id);
  const months = useMemo(() => {
    if (!f.start_date || !f.end_date) return null;
    const d = (new Date(f.end_date).getTime() - new Date(f.start_date).getTime()) / (86400000 * 30.44);
    return d > 0 ? d : null;
  }, [f.start_date, f.end_date]);

  const onName = (name: string) => {
    set({ name, ...(codeTouched ? {} : { code: `${nextNumber}-${abbr(name)}` }) });
  };
  const locate = async () => {
    setLocating(true);
    const p = await currentPosition();
    setLocating(false);
    if (!p) return toast.error("No se pudo obtener la ubicación", { description: "Concede el permiso de ubicación o ingrésala manualmente." });
    set({ lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) });
    toast.success("Ubicación capturada", { description: `Precisión ±${Math.round(p.accuracy)} m` });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const r = await createProject(companyCode, { ...f, lat: f.lat ?? undefined, lng: f.lng ?? undefined });
    if (!r.ok) {
      setSaving(false);
      return toast.error("No se pudo crear la obra", { description: r.error });
    }
    toast.success(r.message, { description: tpl ? `Se replicaron ${tpl.nodes} partidas WBS de ${tpl.label.split(" · ")[0]} sin montos.` : "Siguiente paso: importar el presupuesto aprobado." });
    router.push(`/empresa/${companyCode}/obra/${r.data!.code}`);
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <Section icon={<Building2 className="h-5 w-5" />} title="Datos de la obra" subtitle="El código se sugiere correlativo por empresa; puedes ajustarlo.">
        <div className="grid gap-4 sm:grid-cols-6">
          <Field label="Nombre de la obra" required className="sm:col-span-4"><Input value={f.name} onChange={(e) => onName(e.target.value)} placeholder="Construcción del Hospital de…" /></Field>
          <Field label="Código" required hint="Formato 013-ABCD" className="sm:col-span-2">
            <Input value={f.code} onChange={(e) => { setCodeTouched(true); set({ code: e.target.value.toUpperCase() }); }} className="font-mono font-semibold" />
          </Field>
          <Field label="Nombre corto" required hint="Se muestra en menús y tarjetas" className="sm:col-span-2"><Input value={f.short_name} maxLength={40} onChange={(e) => set({ short_name: e.target.value })} placeholder="Hospital Chincheros" /></Field>
          <Field label="Cliente" required className="sm:col-span-2"><Input value={f.client_name} onChange={(e) => set({ client_name: e.target.value })} placeholder="Consorcio …" /></Field>
          <Field label="RUC del cliente" className="sm:col-span-2"><Input inputMode="numeric" maxLength={11} value={f.client_ruc ?? ""} onChange={(e) => set({ client_ruc: e.target.value.replace(/\D/g, "") })} /></Field>
        </div>
        <p className="mb-2 mt-5 text-xs font-semibold text-ink-soft">Tipo de obra</p>
        <div className="grid gap-2 sm:grid-cols-4">
          {TYPES.map((t) => (
            <button type="button" key={t.v} onClick={() => set({ project_type: t.v as NewProjectInput["project_type"] })}
              className={cn("rounded-2xl border p-3 text-left transition", f.project_type === t.v ? "border-brand-blue bg-brand-blue-50 ring-2 ring-brand-blue/15" : "border-line hover:border-brand-blue/30")}>
              <p className="text-sm font-semibold">{t.l}</p><p className="mt-0.5 text-[11px] text-ink-muted">{t.d}</p>
            </button>
          ))}
        </div>
      </Section>

      <Section icon={<CalendarRange className="h-5 w-5" />} title="Plazo, contrato y estado">
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Inicio" required><Input type="date" value={f.start_date} onChange={(e) => set({ start_date: e.target.value })} /></Field>
          <Field label="Fin" required hint={months ? `${months.toFixed(1)} meses de plazo` : undefined}><Input type="date" value={f.end_date} min={f.start_date || undefined} onChange={(e) => set({ end_date: e.target.value })} /></Field>
          <Field label="Monto de contrato (S/ sin IGV)" hint={Number(f.contract_amount) ? `Con IGV: ${money(Number(f.contract_amount) * 1.18)}` : undefined}>
            <Input type="number" min={0} step="0.01" value={f.contract_amount as number} onChange={(e) => set({ contract_amount: Number(e.target.value) })} className="num" />
          </Field>
          <Field label="Tipo de cambio de referencia"><Input type="number" min={1} step="0.0001" value={f.exchange_rate as number} onChange={(e) => set({ exchange_rate: Number(e.target.value) })} className="num" /></Field>
          <Field label="Estado inicial">
            <Select value={f.status} onChange={(e) => set({ status: e.target.value as "preparacion" | "ejecucion" })}>
              <option value="preparacion">En preparación</option><option value="ejecucion">En ejecución</option>
            </Select>
          </Field>
          <Field label="Umbral de alerta (%)" hint="Semáforo ámbar al llegar a este consumo"><Input type="number" min={50} max={99} value={f.alert_threshold as number} onChange={(e) => set({ alert_threshold: Number(e.target.value) })} /></Field>
        </div>
      </Section>

      <Section icon={<UsersRound className="h-5 w-5" />} title="Responsables" subtitle="Solo aparecen usuarios con acceso a la empresa.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Gerente de proyecto"><Select value={f.manager_id ?? ""} onChange={(e) => set({ manager_id: e.target.value })}><option value="">—</option>{managers.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</Select></Field>
          <Field label="Administrador de obra"><Select value={f.admin_id ?? ""} onChange={(e) => set({ admin_id: e.target.value })}><option value="">—</option>{admins.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</Select></Field>
          <Field label="Ingeniero residente"><Select value={f.resident_id ?? ""} onChange={(e) => set({ resident_id: e.target.value })}><option value="">—</option>{residents.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</Select></Field>
        </div>
      </Section>

      <Section icon={<MapPin className="h-5 w-5" />} title="Ubicación y geocerca" subtitle="Se usa para validar la marcación de asistencia del personal clave desde el celular.">
        <div className="grid gap-4 sm:grid-cols-6">
          <Field label="Distrito / localidad" className="sm:col-span-2"><Input value={f.location ?? ""} onChange={(e) => set({ location: e.target.value })} /></Field>
          <Field label="Región" className="sm:col-span-2"><Input value={f.region ?? ""} onChange={(e) => set({ region: e.target.value })} placeholder="Lima" /></Field>
          <Field label="Radio de geocerca (m)" className="sm:col-span-2"><Input type="number" min={50} max={5000} value={f.geofence_radius as number} onChange={(e) => set({ geofence_radius: Number(e.target.value) })} /></Field>
          <Field label="Dirección" className="sm:col-span-6"><Input value={f.address ?? ""} onChange={(e) => set({ address: e.target.value })} /></Field>
          <Field label="Latitud" className="sm:col-span-2"><Input type="number" step="0.000001" value={f.lat ?? ""} onChange={(e) => set({ lat: e.target.value === "" ? null : Number(e.target.value) })} className="num" /></Field>
          <Field label="Longitud" className="sm:col-span-2"><Input type="number" step="0.000001" value={f.lng ?? ""} onChange={(e) => set({ lng: e.target.value === "" ? null : Number(e.target.value) })} className="num" /></Field>
          <div className="flex items-end sm:col-span-2">
            <Button type="button" variant="outline" className="w-full" onClick={locate} disabled={locating}>{locating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}Usar mi ubicación</Button>
          </div>
        </div>
      </Section>

      <Section icon={<Copy className="h-5 w-5" />} title="Estructura de la obra" subtitle="Replica las fases y el WBS de otra obra (sin montos) o empieza con fases por defecto.">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <button type="button" onClick={() => set({ template_id: "" })}
            className={cn("rounded-2xl border p-4 text-left transition", !f.template_id ? "border-brand-blue bg-brand-blue-50 ring-2 ring-brand-blue/15" : "border-line hover:border-brand-blue/30")}>
            <FilePlus2 className="mb-2 h-5 w-5 text-brand-blue" />
            <p className="text-sm font-semibold">Obra en blanco</p>
            <p className="text-[11px] text-ink-muted">Fases por defecto según el tipo; importarás el presupuesto desde Excel.</p>
          </button>
          {templates.map((t) => (
            <motion.button type="button" key={t.id} whileHover={{ y: -2 }} onClick={() => set({ template_id: t.id })}
              className={cn("rounded-2xl border p-4 text-left transition", f.template_id === t.id ? "border-brand-blue bg-brand-blue-50 ring-2 ring-brand-blue/15" : "border-line hover:border-brand-blue/30")}>
              <Copy className="mb-2 h-5 w-5 text-brand-green-600" />
              <p className="truncate text-sm font-semibold">{t.label}</p>
              <p className="text-[11px] text-ink-muted">{t.nodes} partidas WBS · {t.leaves} centros de costo · {TYPES.find((x) => x.v === t.type)?.l}</p>
            </motion.button>
          ))}
        </div>
      </Section>

      <div className="sticky bottom-3 z-10 flex flex-col-reverse gap-2 rounded-2xl border border-line bg-white/90 p-3 shadow-pop backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="px-1 text-xs text-ink-muted">La obra aparecerá en el menú de la empresa y en el selector de la app de campo.</p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" disabled={saving} size="lg">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}Crear obra</Button>
        </div>
      </div>
    </form>
  );
}
