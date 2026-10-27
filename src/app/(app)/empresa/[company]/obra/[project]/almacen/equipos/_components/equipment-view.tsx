"use client";
import { CalendarClock, Drill, FileSignature, History, LoaderCircle, Pencil, Plus, Undo2, UserRound, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { SignaturePad } from "@/components/ui/alm-signature-pad";
import { Drawer, Modal } from "@/components/ui/dialog";
import { ExportMenu } from "@/components/ui/export-menu";
import { CountUp, Stagger, StaggerItem } from "@/components/ui/motion";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, Textarea, cn } from "@/components/ui/primitives";
import type { Tone } from "@/lib/calc";
import { dateTime, money } from "@/lib/format";
import { deliverEquipment, returnEquipment, saveEquipment, type EquipmentInput } from "../../actions";

type Assignment = {
  id: string; project: string; project_id: string; assigned_to: string; dni: string | null; delivered_at: string; delivered_by: string | null;
  condition_out: string | null; signature_out: string | null; returned_at: string | null; condition_in: string | null; signature_in: string | null; notes: string | null;
};
export type EquipmentItem = {
  id: string; code: string; name: string; type: string | null; brand: string | null; model: string | null; serial: string | null;
  ownership: "propio" | "alquilado"; status: string; notes: string | null; rate_amount: number | null; rate_period: string | null;
  project_id: string | null; project_code: string | null; order: { id: string; number: string; title: string; project: string } | null; order_id: string | null;
  open: Assignment | null; history: Assignment[];
};

const STATUS: Record<string, { label: string; tone: Tone }> = {
  disponible: { label: "Disponible", tone: "green" }, asignado: { label: "Entregado", tone: "blue" }, mantenimiento: { label: "Mantenimiento", tone: "amber" }, baja: { label: "De baja", tone: "red" },
};
const TYPES = ["vibradora", "amoladora", "taladro", "estacion_total", "nivel", "mezcladora", "compactadora", "cortadora", "generador", "laptop", "otro"];
const PERIOD: Record<string, string> = { dia: "día", semana: "semana", mes: "mes" };
const monthly = (e: EquipmentItem) => !e.rate_amount ? 0 : e.rate_period === "dia" ? e.rate_amount * 26 : e.rate_period === "semana" ? e.rate_amount * 4.33 : e.rate_amount;
const daysSince = (d: string) => Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 86400000));

export function EquipmentView({ items, projectId, projectCode, companyCode, orders, canMove, canManage, meta }: {
  items: EquipmentItem[]; projectId: string; projectCode: string; companyCode: string; orders: { id: string; label: string }[];
  canMove: boolean; canManage: boolean; meta: { companyName: string; projectLabel: string; userName: string };
}) {
  const [tab, setTab] = useState<"obra" | "disponibles" | "todos">("obra");
  const [q, setQ] = useState("");
  const [deliver, setDeliver] = useState<EquipmentItem | null>(null);
  const [ret, setRet] = useState<EquipmentItem | null>(null);
  const [hist, setHist] = useState<EquipmentItem | null>(null);
  const [edit, setEdit] = useState<EquipmentItem | "new" | null>(null);

  const here = items.filter((e) => e.project_id === projectId);
  const available = items.filter((e) => e.status === "disponible");
  const list = useMemo(() => {
    const base = tab === "obra" ? here : tab === "disponibles" ? available : items;
    const t = q.trim().toLowerCase();
    return t ? base.filter((e) => `${e.code} ${e.name} ${e.brand ?? ""} ${e.open?.assigned_to ?? ""}`.toLowerCase().includes(t)) : base;
  }, [tab, q, here, available, items]);
  const rentHere = here.filter((e) => e.ownership === "alquilado");

  const exportSheets = () => [{
    name: "Equipos", title: "Equipos menores", subtitle: tab === "obra" ? `Asignados a ${projectCode}` : tab === "disponibles" ? "Disponibles" : "Todos los equipos de la empresa",
    summary: [
      { label: "En la obra", value: String(here.length), tone: "blue" as const },
      { label: "Alquilados en obra", value: String(rentHere.length), tone: "amber" as const },
      { label: "Costo mensual estimado", value: money(rentHere.reduce((s, e) => s + monthly(e), 0)), tone: "navy" as const },
    ],
    columns: [{ key: "code", header: "Código" }, { key: "name", header: "Equipo", width: 30 }, { key: "own", header: "Tipo" }, { key: "status", header: "Estado" }, { key: "obra", header: "Obra" },
      { key: "resp", header: "Responsable" }, { key: "since", header: "Entregado", type: "date" as const }, { key: "rate", header: "Tarifa", type: "money" as const }, { key: "os", header: "O/S" }],
    rows: list.map((e) => ({ code: e.code, name: `${e.name} ${e.brand ?? ""} ${e.model ?? ""}`.trim(), own: e.ownership === "alquilado" ? "Alquilado" : "Propio", status: STATUS[e.status]?.label,
      obra: e.project_code ?? "", resp: e.open?.assigned_to ?? "", since: e.open?.delivered_at?.slice(0, 10) ?? "", rate: e.rate_amount ?? "", os: e.order?.number ?? "" })),
  }];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`${projectCode} · Almacén y logística`} title="Equipos menores"
        description="Equipos propios y alquilados (vibradoras, amoladoras, estación total…) con cargo de entrega y devolución firmados en el celular."
        actions={<>
          <ExportMenu build={exportSheets} meta={{ filename: `Equipos_${projectCode}`, company: meta.companyName, project: meta.projectLabel, user: meta.userName }} />
          {canManage && <Button variant="outline" onClick={() => setEdit("new")}><Plus className="h-4 w-4" />Nuevo equipo</Button>}
        </>} />

      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { l: "Equipos en esta obra", v: here.length, s: `${here.filter((e) => e.open).length} con cargo firmado`, I: Drill, t: "bg-brand-blue-50 text-brand-blue", f: "int" as const },
          { l: "Alquilados en obra", v: rentHere.length, s: "Vinculados a su O/S de alquiler", I: FileSignature, t: "bg-warn-50 text-[#9a5200]", f: "int" as const },
          { l: "Costo mensual estimado", v: rentHere.reduce((s, e) => s + monthly(e), 0), s: "Alquileres activos en la obra", I: CalendarClock, t: "bg-navy-900 text-white", f: "money" as const },
          { l: "Disponibles en la empresa", v: available.length, s: `${items.filter((e) => e.status === "mantenimiento").length} en mantenimiento`, I: Wrench, t: "bg-ok-50 text-brand-green-700", f: "int" as const },
        ].map((k) => (
          <StaggerItem key={k.l}>
            <Card className="h-full p-5">
              <div className="flex items-start justify-between"><p className="text-xs font-medium text-ink-muted">{k.l}</p><span className={cn("grid h-9 w-9 place-items-center rounded-xl", k.t)}><k.I className="h-4 w-4" /></span></div>
              <p className="mt-2 font-display text-2xl font-semibold"><CountUp value={k.v} format={k.f} /></p>
              <p className="mt-1 text-[11px] text-ink-muted">{k.s}</p>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-1 rounded-xl bg-slate-100 p-1">
          {([["obra", `En ${projectCode}`, here.length], ["disponibles", "Disponibles", available.length], ["todos", "Todos", items.length]] as const).map(([k, l, n]) => (
            <button key={k} onClick={() => setTab(k)} className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold", tab === k ? "bg-white text-navy-900 shadow-sm" : "text-ink-muted")}>
              {l}<span className={cn("rounded-full px-1.5 text-[10px]", tab === k ? "bg-brand-blue text-white" : "bg-white")}>{n}</span>
            </button>
          ))}
        </div>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar equipo o responsable…" className="h-9 max-w-xs" />
      </div>

      {!list.length ? (
        <EmptyState icon={<Drill className="h-6 w-6" />} title="Sin equipos en esta vista" description={tab === "obra" ? "Entrega un equipo disponible para registrar su cargo firmado." : "No hay equipos que coincidan."} />
      ) : (
        <Stagger className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3" delay={0.04}>
          {list.map((e) => {
            const st = STATUS[e.status] ?? STATUS.disponible;
            return (
              <StaggerItem key={e.id}>
                <Card className="flex h-full flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-pop">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", e.ownership === "alquilado" ? "bg-warn-50 text-[#9a5200]" : "bg-brand-blue-50 text-brand-blue")}><Drill className="h-5 w-5" /></span>
                      <div className="min-w-0">
                        <p className="font-mono text-[11px] font-semibold text-brand-blue">{e.code}</p>
                        <p className="truncate font-display font-semibold text-ink">{e.name}</p>
                        <p className="truncate text-xs text-ink-muted">{[e.brand, e.model, e.serial].filter(Boolean).join(" · ")}</p>
                      </div>
                    </div>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <Badge tone={e.ownership === "alquilado" ? "amber" : "gray"} dot={false}>{e.ownership === "alquilado" ? "Alquilado" : "Propio"}</Badge>
                    {e.rate_amount ? <Badge tone="gray" dot={false}>{money(e.rate_amount)} / {PERIOD[e.rate_period ?? "mes"] ?? e.rate_period}</Badge> : null}
                    {e.order && <Badge tone="violet" dot={false}>{e.order.number} · {e.order.project}</Badge>}
                    {e.project_code && e.project_id !== projectId && <Badge tone="blue" dot={false}>En {e.project_code}</Badge>}
                  </div>
                  {e.open ? (
                    <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-ink-soft ring-1 ring-line"><UserRound className="h-4 w-4" /></span>
                      <div className="min-w-0 flex-1 text-xs">
                        <p className="truncate font-semibold text-ink">{e.open.assigned_to}</p>
                        <p className="text-ink-muted">Desde {dateTime(e.open.delivered_at)} · {daysSince(e.open.delivered_at)} días</p>
                      </div>
                      {e.open.signature_out && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={e.open.signature_out} alt="Firma de recepción" className="h-9 w-20 rounded-md bg-white object-contain ring-1 ring-line" />
                      )}
                    </div>
                  ) : (
                    <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-ink-muted">{e.status === "mantenimiento" ? e.notes ?? "En mantenimiento." : "Sin responsable asignado."}</p>
                  )}
                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    {canMove && e.status === "disponible" && <Button size="sm" variant="success" onClick={() => setDeliver(e)}><FileSignature className="h-3.5 w-3.5" />Entregar</Button>}
                    {canMove && e.open && e.open.project_id === projectId && <Button size="sm" onClick={() => setRet(e)}><Undo2 className="h-3.5 w-3.5" />Devolución</Button>}
                    <Button size="sm" variant="outline" onClick={() => setHist(e)}><History className="h-3.5 w-3.5" />Historial ({e.history.length})</Button>
                    {canManage && <Button size="sm" variant="ghost" onClick={() => setEdit(e)} aria-label="Editar"><Pencil className="h-3.5 w-3.5" /></Button>}
                  </div>
                </Card>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}

      {deliver && <DeliverModal item={deliver} onClose={() => setDeliver(null)} companyCode={companyCode} projectCode={projectCode} />}
      {ret && <ReturnModal item={ret} onClose={() => setRet(null)} companyCode={companyCode} projectCode={projectCode} />}
      {edit && <EquipmentModal item={edit === "new" ? null : edit} onClose={() => setEdit(null)} companyCode={companyCode} projectCode={projectCode} orders={orders} />}
      <Drawer open={!!hist} onOpenChange={(o) => !o && setHist(null)} title={hist ? `${hist.code} · ${hist.name}` : ""} description="Historial de cargos de entrega y devolución">
        {hist && (
          <ol className="relative space-y-5 border-l-2 border-line pl-6">
            {hist.history.map((h) => (
              <li key={h.id} className="relative">
                <span className={cn("absolute -left-[33px] top-1 h-4 w-4 rounded-full ring-4 ring-white", h.returned_at ? "bg-slate-300" : "bg-brand-green-600")} />
                <div className="rounded-xl border border-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-ink">{h.assigned_to} {h.dni && <span className="text-xs font-normal text-ink-muted">DNI {h.dni}</span>}</p>
                    <Badge tone={h.returned_at ? "gray" : "green"}>{h.returned_at ? "Devuelto" : "Vigente"} · {h.project}</Badge>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="text-xs">
                      <p className="font-semibold text-ink-soft">Entrega · {dateTime(h.delivered_at)}</p>
                      <p className="text-ink-muted">{h.condition_out ?? "—"}{h.delivered_by ? ` · entregó ${h.delivered_by}` : ""}</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {h.signature_out && <img src={h.signature_out} alt="Firma de entrega" className="mt-2 h-14 w-full rounded-lg bg-slate-50 object-contain ring-1 ring-line" />}
                    </div>
                    <div className="text-xs">
                      <p className="font-semibold text-ink-soft">Devolución · {h.returned_at ? dateTime(h.returned_at) : "pendiente"}</p>
                      <p className="text-ink-muted">{h.condition_in ?? "—"}</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {h.signature_in && <img src={h.signature_in} alt="Firma de devolución" className="mt-2 h-14 w-full rounded-lg bg-slate-50 object-contain ring-1 ring-line" />}
                    </div>
                  </div>
                </div>
              </li>
            ))}
            {!hist.history.length && <p className="text-sm text-ink-muted">Este equipo aún no tiene cargos.</p>}
          </ol>
        )}
      </Drawer>
    </div>
  );
}

function DeliverModal({ item, onClose, companyCode, projectCode }: { item: EquipmentItem; onClose: () => void; companyCode: string; projectCode: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [who, setWho] = useState("");
  const [dni, setDni] = useState("");
  const [cond, setCond] = useState("Operativo, con accesorios completos");
  const [notes, setNotes] = useState("");
  const [sig, setSig] = useState<string | null>(null);
  const submit = () => start(async () => {
    const res = await deliverEquipment(companyCode, projectCode, { equipment_id: item.id, assigned_to: who, assigned_to_dni: dni, condition_out: cond, signature_out: sig ?? "", notes });
    if (!res.ok) return void toast.error("No se registró la entrega", { description: res.error });
    toast.success("Cargo de entrega firmado", { description: res.message });
    onClose();
    router.refresh();
  });
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={`Cargo de entrega · ${item.code}`} description={`${item.name}${item.brand ? ` · ${item.brand}` : ""} — el trabajador firma la recepción en pantalla.`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="success" onClick={submit} disabled={pending || !who.trim() || !sig}>{pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />}Registrar entrega</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <Field label="Entregado a" required><Input value={who} onChange={(e) => setWho(e.target.value)} placeholder="Nombre del trabajador" /></Field>
          <Field label="DNI"><Input inputMode="numeric" maxLength={8} value={dni} onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))} /></Field>
        </div>
        <Field label="Condición de entrega"><Input value={cond} onChange={(e) => setCond(e.target.value)} /></Field>
        <Field label="Observaciones"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[60px]" /></Field>
        <SignaturePad onChange={setSig} label="Firma de recepción" />
        <p className="text-[11px] text-ink-muted">El trabajador declara recibir el equipo en la condición indicada y se compromete a devolverlo al término de su uso.</p>
      </div>
    </Modal>
  );
}

function ReturnModal({ item, onClose, companyCode, projectCode }: { item: EquipmentItem; onClose: () => void; companyCode: string; projectCode: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cond, setCond] = useState("Devuelto operativo");
  const [maint, setMaint] = useState(false);
  const [sig, setSig] = useState<string | null>(null);
  const submit = () => start(async () => {
    const res = await returnEquipment(companyCode, projectCode, { assignment_id: item.open!.id, condition_in: cond, signature_in: sig ?? "", to_maintenance: maint });
    if (!res.ok) return void toast.error("No se registró la devolución", { description: res.error });
    toast.success(res.message ?? "Devolución registrada", { description: `${item.name} · ${maint ? "enviado a mantenimiento" : "disponible"}` });
    onClose();
    router.refresh();
  });
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={`Devolución · ${item.code}`} description={`${item.name} entregado a ${item.open?.assigned_to} el ${dateTime(item.open?.delivered_at)}`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={submit} disabled={pending || !sig}>{pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}Registrar devolución</Button></>}>
      <div className="space-y-4">
        <Field label="Condición de devolución">
          <Select value={cond} onChange={(e) => { setCond(e.target.value); setMaint(e.target.value.includes("requiere")); }}>
            {["Devuelto operativo", "Devuelto con desgaste normal", "Devuelto, requiere limpieza", "Devuelto, requiere mantenimiento", "Devuelto con daños — requiere reparación"].map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-sm text-ink-soft"><input type="checkbox" checked={maint} onChange={(e) => setMaint(e.target.checked)} className="h-4 w-4 accent-brand-blue" />Enviar a mantenimiento (no quedará disponible)</label>
        <SignaturePad onChange={setSig} label="Firma de devolución" />
      </div>
    </Modal>
  );
}

function EquipmentModal({ item, onClose, companyCode, projectCode, orders }: { item: EquipmentItem | null; onClose: () => void; companyCode: string; projectCode: string; orders: { id: string; label: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState<EquipmentInput>({
    id: item?.id, code: item?.code ?? "", name: item?.name ?? "", equipment_type: item?.type ?? "otro", brand: item?.brand ?? "", model: item?.model ?? "", serial: item?.serial ?? "",
    ownership: item?.ownership ?? "propio", order_id: item?.order_id ?? null, rate_amount: item?.rate_amount ?? null, rate_period: item?.rate_period ?? "mes", status: item?.status ?? "disponible", notes: item?.notes ?? "",
  });
  const up = (p: Partial<EquipmentInput>) => setF({ ...f, ...p });
  const submit = () => start(async () => {
    const res = await saveEquipment(companyCode, projectCode, f);
    if (!res.ok) return void toast.error("No se guardó el equipo", { description: res.error });
    toast.success(res.message ?? "Guardado");
    onClose();
    router.refresh();
  });
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={item ? `Editar ${item.code}` : "Nuevo equipo"} size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={submit} disabled={pending}>{pending ? "Guardando…" : "Guardar"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Código" required><Input value={f.code} onChange={(e) => up({ code: e.target.value })} placeholder="EQ-015" /></Field>
        <Field label="Nombre" required><Input value={f.name} onChange={(e) => up({ name: e.target.value })} placeholder="Vibradora de concreto 4 HP" /></Field>
        <Field label="Tipo"><Select value={f.equipment_type} onChange={(e) => up({ equipment_type: e.target.value })}>{TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}</Select></Field>
        <Field label="Marca"><Input value={f.brand} onChange={(e) => up({ brand: e.target.value })} /></Field>
        <Field label="Modelo"><Input value={f.model} onChange={(e) => up({ model: e.target.value })} /></Field>
        <Field label="N° de serie"><Input value={f.serial} onChange={(e) => up({ serial: e.target.value })} /></Field>
        <Field label="Propiedad">
          <Select value={f.ownership} onChange={(e) => up({ ownership: e.target.value as "propio" | "alquilado" })}><option value="propio">Propio</option><option value="alquilado">Alquilado</option></Select>
        </Field>
        {item && (
          <Field label="Estado">
            <Select value={f.status} onChange={(e) => up({ status: e.target.value })} disabled={item.status === "asignado"}>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k} disabled={k === "asignado" && item.status !== "asignado"}>{v.label}</option>)}
            </Select>
          </Field>
        )}
        {f.ownership === "alquilado" && (
          <>
            <Field label="O/S de alquiler" className="sm:col-span-2">
              <Select value={f.order_id ?? ""} onChange={(e) => up({ order_id: e.target.value || null })}><option value="">Sin O/S</option>{orders.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</Select>
            </Field>
            <Field label="Tarifa (S/)"><Input inputMode="decimal" value={f.rate_amount ?? ""} onChange={(e) => up({ rate_amount: e.target.value ? Number(e.target.value) : null })} /></Field>
            <Field label="Periodo"><Select value={f.rate_period ?? "mes"} onChange={(e) => up({ rate_period: e.target.value })}><option value="dia">Por día</option><option value="semana">Por semana</option><option value="mes">Por mes</option></Select></Field>
          </>
        )}
        <Field label="Notas" className="sm:col-span-2"><Textarea value={f.notes} onChange={(e) => up({ notes: e.target.value })} className="min-h-[60px]" /></Field>
      </div>
    </Modal>
  );
}
