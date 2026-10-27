"use client";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, Boxes, Building2, ChevronDown, CloudUpload, LoaderCircle, MapPinCheck, Receipt, ShieldCheck, Trash2, TriangleAlert, WifiOff,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge, cn } from "@/components/ui/primitives";
import { can, ROLE_LABEL, type Role } from "@/lib/permissions";
import { money } from "@/lib/format";
import { AttendancePanel } from "./attendance";
import { Approvals } from "./approvals";
import { ExpenseForm, StockForm } from "./forms";
import { clearError, discard, listQueue, onQueueChange, syncQueue, type QueueItem } from "./queue";
import { useOnline } from "./use-online";

export type CampoProject = { id: string; code: string; name: string; status: string; lat: number | null; lng: number | null; radius: number; companyId: string; companyCode: string; companyName: string; role: Role | null };
export type CampoData = {
  user: { id: string; name: string; isHolding: boolean };
  projects: CampoProject[];
  phases: { id: string; projectId: string; code: string; name: string }[];
  leaves: { id: string; projectId: string; code: string; name: string; phaseId: string | null; budget: number; used: number }[];
  suppliers: { id: string; companyId: string; ruc: string; name: string }[];
  materials: { id: string; companyId: string; code: string; name: string; unit: string }[];
  attendance: { id: string; projectId: string; kind: string; markedAt: string; distance: number | null; within: boolean | null }[];
  pending: { id: string; projectId: string; seq: number | null; description: string; doc: string; total: number; date: string; origin: string; exceeds: boolean; supplier: string; creator: string; photo: string | null }[];
};

type View = "inicio" | "gasto" | "asistencia" | "almacen" | "aprobaciones";

export function CampoApp({ data, initialAction }: { data: CampoData; initialAction: string | null }) {
  const router = useRouter();
  const online = useOnline();
  const [projectId, setProjectId] = useState<string>(data.projects[0]?.id ?? "");
  const [view, setView] = useState<View>("inicio");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [picker, setPicker] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("gc-campo-obra");
      if (saved && data.projects.some((p) => p.id === saved)) setProjectId(saved);
    } catch {}
    if (initialAction === "gasto" || initialAction === "asistencia") setView(initialAction);
  }, [data.projects, initialAction]);
  const project = data.projects.find((p) => p.id === projectId);
  const choose = (id: string) => { setProjectId(id); setPicker(false); try { localStorage.setItem("gc-campo-obra", id); } catch {} };

  const refreshQueue = useCallback(async () => setQueue(await listQueue()), []);
  useEffect(() => { refreshQueue(); return onQueueChange(refreshQueue); }, [refreshQueue]);

  const runSync = useCallback(async (manual = false) => {
    if (!navigator.onLine) { if (manual) toast.warning("Sin conexión", { description: "Se sincronizará automáticamente al recuperar la señal." }); return; }
    setSyncing(true);
    const r = await syncQueue();
    setSyncing(false);
    if (r.synced) { toast.success(`${r.synced} registro(s) sincronizado(s)`, { description: r.messages.slice(-1)[0] }); router.refresh(); }
    if (r.failed) toast.error(`${r.failed} registro(s) con observaciones`, { description: "Revísalos en la cola de pendientes." });
    if (manual && !r.synced && !r.failed) toast("Todo está sincronizado");
  }, [router]);

  useEffect(() => {
    const on = () => { toast.success("Conexión recuperada", { description: "Sincronizando registros pendientes…" }); runSync(); };
    window.addEventListener("online", on);
    const t = setTimeout(() => runSync(), 800);
    return () => { window.removeEventListener("online", on); clearTimeout(t); };
  }, [runSync]);

  const afterSave = async (queued: boolean) => {
    setView("inicio");
    if (navigator.onLine) await runSync();
    else if (queued) toast.warning("Guardado en el celular", { description: "Sin conexión — se sincronizará automáticamente." });
  };

  const role = project?.role ?? null;
  const pendingHere = data.pending.filter((p) => !project || p.projectId === project.id);
  const tiles = [
    { k: "gasto" as View, label: "Registrar gasto", sub: "Foto del comprobante + GPS", Icon: Receipt, c: "from-brand-blue to-navy-700", show: can(role, "registerExpense") },
    { k: "asistencia" as View, label: "Marcar asistencia", sub: "Entrada / salida con geocerca", Icon: MapPinCheck, c: "from-brand-green-600 to-brand-green-700", show: true },
    { k: "almacen" as View, label: "Ingreso de almacén", sub: "Material, cantidad, guía y foto", Icon: Boxes, c: "from-[#7c3aed] to-[#4c1d95]", show: can(role, "stockMovement") },
    { k: "aprobaciones" as View, label: "Aprobaciones", sub: `${pendingHere.length} gasto(s) por revisar`, Icon: ShieldCheck, c: "from-[#e07b00] to-[#b45309]", show: can(role, "approveExpense") },
  ].filter((t) => t.show);
  const todayAtt = data.attendance.filter((a) => a.projectId === projectId && new Date(a.markedAt).toDateString() === new Date().toDateString());

  if (!data.projects.length) {
    return (
      <div className="mt-16 text-center">
        <Building2 className="mx-auto h-10 w-10 text-ink-muted" />
        <p className="mt-3 font-display text-lg font-semibold">Sin obras activas asignadas</p>
        <p className="text-sm text-ink-muted">Solicita a Gerencia General acceso a una obra en ejecución.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!online && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3 rounded-2xl bg-warn-50 p-3 text-sm text-[#9a5200] ring-1 ring-warn/30">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
          <p><b>Sin conexión</b> — puedes seguir registrando; todo se guardará en el celular y se sincronizará al recuperar la señal.</p>
        </motion.div>
      )}

      {/* Obra seleccionada */}
      <div className="relative">
        <button onClick={() => setPicker(!picker)} className="flex w-full items-center gap-3 rounded-2xl bg-gradient-to-br from-navy-900 to-brand-blue p-4 text-left text-white shadow-lg shadow-navy-900/20">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15"><Building2 className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">{project?.companyName}</span>
            <span className="block truncate font-display text-lg font-semibold">{project?.code} · {project?.name}</span>
            <span className="block text-[11px] text-white/70">{role ? ROLE_LABEL[role] : "Sin rol"}</span>
          </span>
          <ChevronDown className={cn("h-5 w-5 shrink-0 transition", picker && "rotate-180")} />
        </button>
        <AnimatePresence>
          {picker && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              className="absolute inset-x-0 top-full z-20 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-line bg-white p-1.5 shadow-pop">
              {data.projects.map((p) => (
                <button key={p.id} onClick={() => choose(p.id)} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left", p.id === projectId ? "bg-brand-blue-50" : "hover:bg-slate-50")}>
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy-900 text-[11px] font-bold text-white">{p.companyCode}</span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{p.code}</span><span className="block truncate text-xs text-ink-muted">{p.name}</span></span>
                  {p.status !== "ejecucion" && <Badge tone="gray">{p.status === "preparacion" ? "Preparación" : "Paralizada"}</Badge>}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Cola de sincronización */}
      {queue.length > 0 && (
        <motion.div layout className="rounded-2xl border border-line bg-white p-3 shadow-card">
          <div className="flex items-center gap-3">
            <span className="relative grid h-10 w-10 place-items-center rounded-xl bg-brand-blue-50 text-brand-blue">
              <CloudUpload className="h-5 w-5" />
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand-red px-1 text-[10px] font-bold text-white">{queue.length}</span>
            </span>
            <button onClick={() => setShowQueue(!showQueue)} className="min-w-0 flex-1 text-left">
              <p className="text-sm font-semibold">{queue.length} registro(s) pendientes de sincronizar</p>
              <p className="text-[11px] text-ink-muted">{queue.some((q) => q.error) ? "Algunos tienen observaciones · toca para ver" : online ? "Se envían automáticamente" : "Esperando señal"}</p>
            </button>
            <button onClick={() => runSync(true)} disabled={syncing || !online} className="h-9 rounded-xl bg-brand-blue px-3 text-xs font-bold text-white disabled:opacity-40">
              {syncing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Sincronizar"}
            </button>
          </div>
          <AnimatePresence>
            {showQueue && (
              <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-3 space-y-2 overflow-hidden">
                {queue.map((q) => (
                  <li key={q.id} className={cn("rounded-xl border p-2.5 text-xs", q.error ? "border-danger/30 bg-danger-50" : "border-line bg-slate-50")}>
                    <div className="flex items-center gap-2">
                      <Badge tone={q.kind === "gasto" ? "blue" : q.kind === "asistencia" ? "green" : "violet"}>{q.kind}</Badge>
                      <span className="min-w-0 flex-1 truncate font-medium">{q.label}</span>
                      {q.amount ? <span className="num font-semibold">{money(q.amount)}</span> : null}
                    </div>
                    <p className="mt-1 text-[10px] text-ink-muted">{new Date(q.createdAt).toLocaleString("es-PE")}{q.photo ? " · con foto" : ""}</p>
                    {q.error && (
                      <div className="mt-1.5 flex items-start gap-2">
                        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
                        <p className="flex-1 text-danger">{q.error}</p>
                        <button onClick={async () => { await clearError(q.id); runSync(true); }} className="font-semibold text-brand-blue">Reintentar</button>
                        <button onClick={() => discard(q.id)} className="text-ink-muted" aria-label="Descartar"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    )}
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {view === "inicio" ? (
          <motion.div key="inicio" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {tiles.map((t, i) => (
                <motion.button key={t.k} onClick={() => setView(t.k)} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  whileTap={{ scale: 0.97 }}
                  className={cn("flex aspect-square flex-col justify-between rounded-3xl bg-gradient-to-br p-4 text-left text-white shadow-lg sm:aspect-[4/3]", t.c)}>
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15"><t.Icon className="h-6 w-6" /></span>
                  <span>
                    <span className="block font-display text-base font-semibold leading-tight">{t.label}</span>
                    <span className="mt-1 block text-[11px] text-white/75">{t.sub}</span>
                  </span>
                </motion.button>
              ))}
            </div>
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-muted">Hoy en {project?.code}</p>
              {todayAtt.length ? (
                <ul className="mt-2 space-y-1.5">
                  {todayAtt.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 text-sm">
                      <span className={cn("h-2 w-2 rounded-full", a.within === false ? "bg-warn-500" : "bg-brand-green")} />
                      <span className="font-semibold capitalize">{a.kind}</span>
                      <span suppressHydrationWarning className="text-ink-muted">{new Date(a.markedAt).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}</span>
                      {a.distance !== null && <span className="ml-auto text-xs text-ink-muted">{Math.round(a.distance)} m</span>}
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-1 text-sm text-ink-muted">Aún no marcaste asistencia hoy en esta obra.</p>}
            </div>
          </motion.div>
        ) : (
          <motion.div key={view} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}>
            <button onClick={() => setView("inicio")} className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-blue"><ArrowLeft className="h-4 w-4" />Volver</button>
            {project && view === "gasto" && <ExpenseForm data={data} project={project} onDone={afterSave} />}
            {project && view === "almacen" && <StockForm data={data} project={project} onDone={afterSave} />}
            {project && view === "asistencia" && <AttendancePanel project={project} history={data.attendance.filter((a) => a.projectId === project.id)} onDone={afterSave} />}
            {project && view === "aprobaciones" && <Approvals items={pendingHere} online={online} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
