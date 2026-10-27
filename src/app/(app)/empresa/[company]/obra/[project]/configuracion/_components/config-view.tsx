"use client";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarCheck2, CircleAlert, CircleCheck, ClipboardCheck, Crosshair, ExternalLink, FileText, FileUp, LoaderCircle, Lock, LockOpen, Pencil, Plus,
  Save, Settings2, ShieldCheck, Unlock, UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/dialog";
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, Field, Input, Select, Textarea, cn } from "@/components/ui/primitives";
import { PROJECT_STATUS } from "@/lib/calc";
import { date, money, timeAgo } from "@/lib/format";
import { ROLE_LABEL, type Role } from "@/lib/permissions";
import { currentPosition, uploadEvidence } from "@/lib/upload";
import { closePeriod, reopenPeriod, saveDocument, updateProject, type DocInput, type FichaInput } from "../actions";

type Project = {
  id: string; code: string; name: string; short_name: string | null; client_name: string | null; client_ruc: string | null; project_type: string; location: string | null;
  address: string | null; region: string | null; start_date: string | null; end_date: string | null; extended_end_date: string | null; contract_amount: number; exchange_rate: number;
  status: string; alert_threshold: number; geofence_radius: number; lat: number | null; lng: number | null; manager_id: string | null; admin_id: string | null; resident_id: string | null;
};
type Doc = { id: string; doc_kind: string; title: string; number: string | null; amount: number | null; issue_date: string | null; expiry_date: string | null; file_path: string | null; notes: string | null; url: string | null };
type Closure = { id: string; period_start: string; period_end: string; label: string | null; closed_at: string; closer: string | null };
type Member = { id: string; full_name: string; position: string | null; avatar_color: string | null; email: string; role: Role; all_projects: boolean; last_seen_at: string | null };
type Opt = { id: string; label: string };

const KINDS: Record<string, { label: string; required: boolean }> = {
  contrato: { label: "Contrato de obra", required: true },
  orden_servicio_cliente: { label: "Orden de servicio del cliente", required: true },
  carta_fianza: { label: "Carta fianza", required: true },
  poliza: { label: "Póliza de seguro", required: true },
  otro: { label: "Otro documento", required: false },
};
const TABS = [
  { k: "ficha", label: "Ficha", Icon: Settings2 },
  { k: "documentos", label: "Checklist documental", Icon: ClipboardCheck },
  { k: "cierres", label: "Cierre de periodos", Icon: CalendarCheck2 },
  { k: "equipo", label: "Equipo de la obra", Icon: UsersRound },
];

function expiryState(exp: string | null) {
  if (!exp) return null;
  const days = Math.ceil((new Date(`${exp}T12:00:00`).getTime() - Date.now()) / 86400000);
  if (days < 0) return { tone: "red" as const, label: `Vencida hace ${-days} d` };
  if (days <= 30) return { tone: "amber" as const, label: `Vence en ${days} d` };
  return { tone: "green" as const, label: `Vigente · ${date(exp)}` };
}

export function ConfigView(props: {
  companyCode: string; companyId: string; project: Project; role: Role; editable: boolean; canDocs: boolean; canClose: boolean;
  docs: Doc[]; closures: Closure[]; team: Member[]; managers: Opt[]; admins: Opt[]; residents: Opt[];
}) {
  const params = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") ?? "ficha");
  const missing = Object.entries(KINDS).filter(([k, v]) => v.required && !props.docs.some((d) => d.doc_kind === k)).length;
  return (
    <div className="space-y-5">
      <div className="scrollbar-thin -mx-1 overflow-x-auto px-1">
        <div className="inline-flex gap-1 rounded-2xl bg-slate-100 p-1">
          {TABS.map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)} className={cn("relative inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition", tab === t.k ? "text-navy-900" : "text-ink-muted hover:text-ink")}>
              {tab === t.k && <motion.span layoutId="cfg-tab" className="absolute inset-0 rounded-xl bg-white shadow-sm" />}
              <t.Icon className="relative h-4 w-4" /><span className="relative">{t.label}</span>
              {t.k === "documentos" && missing > 0 && <span className="relative grid h-5 min-w-5 place-items-center rounded-full bg-warn-500 px-1 text-[10px] text-white">{missing}</span>}
            </button>
          ))}
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
          {tab === "ficha" && <Ficha {...props} />}
          {tab === "documentos" && <Documents {...props} />}
          {tab === "cierres" && <Closures {...props} />}
          {tab === "equipo" && <Team {...props} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Ficha({ companyCode, project: p, editable, managers, admins, residents }: Parameters<typeof ConfigView>[0]) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<FichaInput>({
    name: p.name, short_name: p.short_name ?? "", client_name: p.client_name ?? "", client_ruc: p.client_ruc ?? "", project_type: p.project_type as FichaInput["project_type"],
    location: p.location ?? "", address: p.address ?? "", region: p.region ?? "", start_date: p.start_date ?? "", end_date: p.end_date ?? "", extended_end_date: p.extended_end_date ?? "",
    contract_amount: p.contract_amount, exchange_rate: p.exchange_rate, status: p.status as FichaInput["status"], alert_threshold: p.alert_threshold, geofence_radius: p.geofence_radius,
    lat: p.lat, lng: p.lng, manager_id: p.manager_id ?? "", admin_id: p.admin_id ?? "", resident_id: p.resident_id ?? "",
  });
  const set = (x: Partial<FichaInput>) => setF((v) => ({ ...v, ...x }));
  const ro = !editable;
  const save = async () => {
    if (f.status === "cerrada" && p.status !== "cerrada" && !confirm("Al cerrar la obra quedará en solo lectura (no se podrán registrar gastos, pagos ni movimientos). ¿Continuar?")) return;
    setSaving(true);
    const r = await updateProject(companyCode, p.code, f);
    setSaving(false);
    if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error("No se pudo guardar", { description: r.error });
  };
  const locate = async () => {
    const pos = await currentPosition();
    if (!pos) return toast.error("No se pudo obtener la ubicación");
    set({ lat: Number(pos.lat.toFixed(6)), lng: Number(pos.lng.toFixed(6)) });
    toast.success("Ubicación capturada", { description: `±${Math.round(pos.accuracy)} m` });
  };

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader title="Datos generales" subtitle={ro ? "Solo lectura para tu rol" : "Los cambios quedan registrados en la trazabilidad"} icon={<Settings2 className="h-5 w-5" />} />
        <fieldset disabled={ro} className="grid gap-4 p-5 sm:grid-cols-6">
          <Field label="Nombre de la obra" className="sm:col-span-4"><Input value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Código" className="sm:col-span-2" hint="No editable"><Input value={p.code} disabled className="font-mono font-semibold" /></Field>
          <Field label="Nombre corto" className="sm:col-span-2"><Input value={f.short_name} onChange={(e) => set({ short_name: e.target.value })} /></Field>
          <Field label="Cliente" className="sm:col-span-2"><Input value={f.client_name} onChange={(e) => set({ client_name: e.target.value })} /></Field>
          <Field label="RUC del cliente" className="sm:col-span-2"><Input value={f.client_ruc ?? ""} maxLength={11} onChange={(e) => set({ client_ruc: e.target.value.replace(/\D/g, "") })} /></Field>
          <Field label="Tipo" className="sm:col-span-2">
            <Select value={f.project_type} onChange={(e) => set({ project_type: e.target.value as FichaInput["project_type"] })}>
              <option value="edificacion">Edificación</option><option value="infraestructura">Infraestructura</option><option value="mineria">Minería</option><option value="saneamiento">Saneamiento</option>
            </Select>
          </Field>
          <Field label="Estado" className="sm:col-span-2" hint={f.status === "cerrada" ? "Cerrada = solo lectura" : undefined}>
            <Select value={f.status} onChange={(e) => set({ status: e.target.value as FichaInput["status"] })}>
              {Object.entries(PROJECT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </Field>
          <Field label="Monto de contrato (sin IGV)" className="sm:col-span-2" hint={`Con IGV ${money(Number(f.contract_amount) * 1.18)}`}><Input type="number" step="0.01" value={f.contract_amount as number} onChange={(e) => set({ contract_amount: Number(e.target.value) })} className="num" /></Field>
          <Field label="Inicio" className="sm:col-span-2"><Input type="date" value={f.start_date} onChange={(e) => set({ start_date: e.target.value })} /></Field>
          <Field label="Fin contractual" className="sm:col-span-2"><Input type="date" value={f.end_date} onChange={(e) => set({ end_date: e.target.value })} /></Field>
          <Field label="Fin ampliado" className="sm:col-span-2" hint="Ampliaciones de plazo aprobadas"><Input type="date" value={f.extended_end_date ?? ""} onChange={(e) => set({ extended_end_date: e.target.value })} /></Field>
          <Field label="Gerente de proyecto" className="sm:col-span-2"><Select value={f.manager_id ?? ""} onChange={(e) => set({ manager_id: e.target.value })}><option value="">—</option>{managers.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</Select></Field>
          <Field label="Administrador" className="sm:col-span-2"><Select value={f.admin_id ?? ""} onChange={(e) => set({ admin_id: e.target.value })}><option value="">—</option>{admins.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</Select></Field>
          <Field label="Residente" className="sm:col-span-2"><Select value={f.resident_id ?? ""} onChange={(e) => set({ resident_id: e.target.value })}><option value="">—</option>{residents.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</Select></Field>
          <Field label="Dirección" className="sm:col-span-4"><Input value={f.address ?? ""} onChange={(e) => set({ address: e.target.value })} /></Field>
          <Field label="Región" className="sm:col-span-2"><Input value={f.region ?? ""} onChange={(e) => set({ region: e.target.value })} /></Field>
        </fieldset>
      </Card>
      <div className="space-y-5">
        <Card>
          <CardHeader title="Control y alertas" icon={<ShieldCheck className="h-5 w-5" />} />
          <fieldset disabled={ro} className="space-y-4 p-5">
            <Field label={`Umbral de alerta: ${f.alert_threshold}%`} hint="El semáforo pasa a ámbar y notifica al llegar a este consumo.">
              <input type="range" min={50} max={95} step={5} value={f.alert_threshold as number} onChange={(e) => set({ alert_threshold: Number(e.target.value) })} className="w-full accent-[#035AA6]" />
            </Field>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: "100%", background: `linear-gradient(90deg, #035AA6 0%, #0A9F4C ${Number(f.alert_threshold) - 1}%, #F59E0B ${f.alert_threshold}%, #F59E0B 99%, #F21D2F 100%)` }} />
            </div>
            <Field label="Tipo de cambio de referencia"><Input type="number" step="0.0001" value={f.exchange_rate as number} onChange={(e) => set({ exchange_rate: Number(e.target.value) })} className="num" /></Field>
          </fieldset>
        </Card>
        <Card>
          <CardHeader title="Geocerca de asistencia" subtitle="Valida la distancia del personal al marcar desde el celular" icon={<Crosshair className="h-5 w-5" />} />
          <fieldset disabled={ro} className="grid grid-cols-2 gap-3 p-5">
            <Field label="Latitud"><Input type="number" step="0.000001" value={(f.lat as number | null | undefined) ?? ""} onChange={(e) => set({ lat: e.target.value === "" ? null : Number(e.target.value) })} className="num" /></Field>
            <Field label="Longitud"><Input type="number" step="0.000001" value={(f.lng as number | null | undefined) ?? ""} onChange={(e) => set({ lng: e.target.value === "" ? null : Number(e.target.value) })} className="num" /></Field>
            <Field label="Radio (m)"><Input type="number" min={50} value={f.geofence_radius as number} onChange={(e) => set({ geofence_radius: Number(e.target.value) })} /></Field>
            <div className="flex items-end"><Button type="button" variant="outline" className="w-full" onClick={locate}><Crosshair className="h-4 w-4" />Mi ubicación</Button></div>
            {f.lat !== null && f.lng !== null && (
              <a href={`https://www.google.com/maps?q=${f.lat},${f.lng}`} target="_blank" rel="noreferrer" className="col-span-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-blue hover:underline">
                Ver en el mapa <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </fieldset>
        </Card>
        {editable && <Button size="lg" className="w-full" onClick={save} disabled={saving}>{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Guardar ficha</Button>}
      </div>
    </div>
  );
}

function Documents({ companyCode, companyId, project, docs, canDocs }: Parameters<typeof ConfigView>[0]) {
  const router = useRouter();
  const [form, setForm] = useState<DocInput | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const open = (d?: Doc, kind?: string) => {
    setFile(null);
    setForm(d ? { id: d.id, doc_kind: d.doc_kind as DocInput["doc_kind"], title: d.title, number: d.number ?? "", amount: d.amount, issue_date: d.issue_date ?? "", expiry_date: d.expiry_date ?? "", file_path: d.file_path, notes: d.notes ?? "" }
      : { doc_kind: (kind ?? "contrato") as DocInput["doc_kind"], title: KINDS[kind ?? "contrato"].label, number: "", amount: null, issue_date: "", expiry_date: "", file_path: null, notes: "" });
  };
  const submit = async () => {
    if (!form) return;
    setSaving(true);
    try {
      let file_path = form.file_path ?? null;
      if (file) file_path = (await uploadEvidence(file, { companyId, projectId: project.id, folder: "documentos" })).path;
      const r = await saveDocument(companyCode, project.code, { ...form, file_path });
      if (!r.ok) throw new Error(r.error);
      toast.success(r.message);
      setForm(null);
      router.refresh();
    } catch (e) {
      toast.error("No se pudo guardar el documento", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(KINDS).filter(([, v]) => v.required).map(([k, v], i) => {
          const list = docs.filter((d) => d.doc_kind === k);
          const withFile = list.some((d) => d.file_path);
          const exp = list.map((d) => expiryState(d.expiry_date)).find((s) => s && s.tone !== "green");
          const ok = list.length > 0 && withFile && !exp;
          return (
            <motion.div key={k} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className={cn("flex h-full items-start gap-3 p-4", ok ? "border-brand-green/30" : list.length && exp?.tone !== "red" ? "border-warn/40" : "border-danger/30")}>
                <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", ok ? "bg-ok-50 text-brand-green-700" : list.length && exp?.tone !== "red" ? "bg-warn-50 text-[#9a5200]" : "bg-danger-50 text-danger")}>
                  {ok ? <CircleCheck className="h-5 w-5" /> : <CircleAlert className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{v.label}</p>
                  <p className="text-xs text-ink-muted">{!list.length ? "Pendiente de registrar" : !withFile ? "Registrado · falta adjuntar archivo" : exp ? exp.label : `${list.length} documento(s) con sustento`}</p>
                  {canDocs && !list.length && <button onClick={() => open(undefined, k)} className="mt-2 text-xs font-semibold text-brand-blue hover:underline">+ Registrar</button>}
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <Card>
        <CardHeader title="Documentos de la obra" subtitle="Archivos privados; se alerta 30 días antes del vencimiento de fianzas y pólizas." icon={<FileText className="h-5 w-5" />}
          actions={canDocs && <Button size="sm" onClick={() => open()}><Plus className="h-4 w-4" />Agregar documento</Button>} />
        <div className="p-5 pt-4">
          {docs.length === 0 ? <EmptyState icon={<FileText className="h-6 w-6" />} title="Sin documentos" description="Registra el contrato, la orden de servicio del cliente y las cartas fianza." /> : (
            <ul className="divide-y divide-line-soft rounded-2xl border border-line">
              {docs.map((d) => {
                const e = expiryState(d.expiry_date);
                return (
                  <li key={d.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-blue-50 text-brand-blue"><FileText className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{d.title} {d.number && <span className="font-normal text-ink-muted">· {d.number}</span>}</p>
                      <p className="text-xs text-ink-muted">{KINDS[d.doc_kind]?.label}{d.issue_date ? ` · emitido ${date(d.issue_date)}` : ""}{d.amount ? ` · ${money(d.amount)}` : ""}</p>
                      {d.notes && <p className="mt-0.5 text-xs text-ink-soft">{d.notes}</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {e && <Badge tone={e.tone}>{e.label}</Badge>}
                      {d.url ? (
                        <a href={d.url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-blue-50 px-3 text-xs font-semibold text-brand-blue hover:bg-brand-blue-100"><ExternalLink className="h-3.5 w-3.5" />Ver archivo</a>
                      ) : <Badge tone="amber">Sin archivo</Badge>}
                      {canDocs && <button onClick={() => open(d)} className="rounded-lg p-2 text-ink-muted hover:bg-slate-100 hover:text-ink" aria-label="Editar"><Pencil className="h-4 w-4" /></button>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>

      <Modal open={!!form} onOpenChange={(o) => !o && setForm(null)} title={form?.id ? "Editar documento" : "Nuevo documento"}
        footer={<><Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button><Button onClick={submit} disabled={saving}>{saving && <LoaderCircle className="h-4 w-4 animate-spin" />}Guardar</Button></>}>
        {form && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo"><Select value={form.doc_kind} onChange={(e) => setForm({ ...form, doc_kind: e.target.value as DocInput["doc_kind"] })}>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
            <Field label="Número"><Input value={form.number ?? ""} onChange={(e) => setForm({ ...form, number: e.target.value })} /></Field>
            <Field label="Título" required className="sm:col-span-2"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Monto (S/)"><Input type="number" step="0.01" value={(form.amount as number | null | undefined) ?? ""} onChange={(e) => setForm({ ...form, amount: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
            <Field label="Emisión"><Input type="date" value={form.issue_date ?? ""} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} /></Field>
            <Field label="Vencimiento" hint="Para fianzas y pólizas"><Input type="date" value={form.expiry_date ?? ""} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></Field>
            <Field label="Archivo (PDF o imagen)" hint={form.file_path && !file ? "Ya tiene archivo; sube otro para reemplazarlo" : undefined}>
              <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <Button type="button" variant="outline" className="w-full justify-start" onClick={() => fileRef.current?.click()}>
                <FileUp className="h-4 w-4" /><span className="truncate">{file ? file.name : form.file_path ? "Reemplazar archivo" : "Seleccionar archivo"}</span>
              </Button>
            </Field>
            <Field label="Notas" className="sm:col-span-2"><Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Entidad emisora, condiciones de renovación…" /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Closures({ companyCode, project, closures, canClose, role }: Parameters<typeof ConfigView>[0]) {
  const router = useRouter();
  const now = new Date();
  const [kind, setKind] = useState<"mes" | "q1" | "q2">("mes");
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [busy, setBusy] = useState<string | null>(null);
  const range = () => {
    const [y, m] = month.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    const M = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre"][m - 1];
    if (kind === "q1") return { start: `${month}-01`, end: `${month}-15`, label: `1ra quincena ${M} ${y}` };
    if (kind === "q2") return { start: `${month}-16`, end: `${month}-${last}`, label: `2da quincena ${M} ${y}` };
    return { start: `${month}-01`, end: `${month}-${last}`, label: `${M} ${y}` };
  };
  const doClose = async () => {
    const r0 = range();
    if (!confirm(`Cerrar el periodo ${r0.label}? Después solo se permitirán ajustes con autorización de Gerencia.`)) return;
    setBusy("new");
    const r = await closePeriod(companyCode, project.code, r0);
    setBusy(null);
    if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error("No se pudo cerrar", { description: r.error });
  };
  const reopen = async (c: Closure) => {
    if (!confirm(`¿Reabrir el periodo ${c.label}?`)) return;
    setBusy(c.id);
    const r = await reopenPeriod(companyCode, project.code, c.id);
    setBusy(null);
    if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error);
  };
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader title="Cerrar periodo" subtitle="Bloquea registrar o modificar comprobantes con fecha dentro del periodo." icon={<Lock className="h-5 w-5" />} />
        <div className="space-y-4 p-5">
          {!canClose ? <p className="text-sm text-ink-muted">Solo Gerencia puede cerrar periodos.</p> : (
            <>
              <div className="inline-flex w-full gap-1 rounded-xl bg-slate-100 p-1">
                {([["mes", "Mes"], ["q1", "1ra quincena"], ["q2", "2da quincena"]] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setKind(k)} className={cn("h-8 flex-1 rounded-lg text-xs font-semibold", kind === k ? "bg-white text-navy-900 shadow-sm" : "text-ink-muted")}>{l}</button>
                ))}
              </div>
              <Field label="Mes"><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></Field>
              <div className="rounded-xl bg-brand-blue-50 p-3 text-xs text-brand-blue">Se cerrará <b>{range().label}</b> ({date(range().start)} – {date(range().end)})</div>
              <Button className="w-full" variant="navy" onClick={doClose} disabled={busy === "new"}>{busy === "new" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}Cerrar periodo</Button>
            </>
          )}
        </div>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader title="Periodos cerrados" subtitle={`${closures.length} cierre(s) registrados`} icon={<CalendarCheck2 className="h-5 w-5" />} />
        <div className="p-5 pt-4">
          {closures.length === 0 ? <EmptyState icon={<LockOpen className="h-6 w-6" />} title="Sin periodos cerrados" description="Cierra cada quincena o mes una vez conciliado con Contabilidad." /> : (
            <ol className="relative space-y-3 border-l-2 border-line pl-5">
              {closures.map((c) => (
                <li key={c.id} className="relative">
                  <span className="absolute -left-[27px] top-3 grid h-4 w-4 place-items-center rounded-full bg-navy-900 ring-4 ring-white"><Lock className="h-2.5 w-2.5 text-white" /></span>
                  <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line p-3">
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{c.label ?? `${date(c.period_start)} – ${date(c.period_end)}`}</p>
                      <p suppressHydrationWarning className="text-xs text-ink-muted">{date(c.period_start)} – {date(c.period_end)} · cerrado {timeAgo(c.closed_at)}{c.closer ? ` por ${c.closer}` : ""}</p>
                    </div>
                    {role === "gerente_general" && (
                      <Button size="sm" variant="ghost" onClick={() => reopen(c)} disabled={busy === c.id}>{busy === c.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />}Reabrir</Button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </Card>
    </div>
  );
}

function Team({ team, companyCode, role, project }: Parameters<typeof ConfigView>[0]) {
  return (
    <Card>
      <CardHeader title="Equipo con acceso a la obra" subtitle="Usuarios asignados a la empresa con acceso a todas sus obras o a esta en particular."
        icon={<UsersRound className="h-5 w-5" />}
        actions={role === "gerente_general" && <Link href={`/empresa/${companyCode}/usuarios`} className="text-xs font-semibold text-brand-blue hover:underline">Gestionar accesos →</Link>} />
      <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
        {team.map((m, i) => {
          const tags = [m.id === project.manager_id && "Gerente de proyecto", m.id === project.admin_id && "Administrador", m.id === project.resident_id && "Residente"].filter(Boolean) as string[];
          return (
            <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="flex items-center gap-3 rounded-2xl border border-line p-3">
              <Avatar name={m.full_name} color={m.avatar_color} size={42} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{m.full_name}</p>
                <p className="truncate text-xs text-ink-muted">{ROLE_LABEL[m.role]} · {m.all_projects ? "todas las obras" : "asignado a la obra"}</p>
                {tags.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{tags.map((t) => <Badge key={t} tone="blue">{t}</Badge>)}</div>}
              </div>
            </motion.div>
          );
        })}
        {!team.length && <p className="text-sm text-ink-muted">Sin usuarios asignados.</p>}
      </div>
    </Card>
  );
}
