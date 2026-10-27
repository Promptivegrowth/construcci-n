"use client";
import { motion } from "framer-motion";
import { LoaderCircle, LogIn, LogOut, MapPinCheck, MapPinOff, Navigation } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge, cn } from "@/components/ui/primitives";
import type { CampoProject } from "./campo-app";
import { PhotoCapture, type Captured } from "./photo-capture";
import { enqueue } from "./queue";

type Pos = { lat: number; lng: number; accuracy: number };

function distanceM(a: number, b: number, c: number, d: number) {
  const R = 6371000, r = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function AttendancePanel({ project, history, onDone }: {
  project: CampoProject; history: { id: string; kind: string; markedAt: string; distance: number | null; within: boolean | null }[]; onDone: (queued: boolean) => void;
}) {
  const [pos, setPos] = useState<Pos | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<Captured | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) { setGeoError("Este dispositivo no tiene GPS disponible."); return; }
    const id = navigator.geolocation.watchPosition(
      (p) => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }); setGeoError(null); },
      (e) => setGeoError(e.code === 1 ? "Concede el permiso de ubicación para validar la geocerca." : "No se pudo obtener la ubicación."),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const hasSite = project.lat !== null && project.lng !== null;
  const dist = pos && hasSite ? distanceM(project.lat!, project.lng!, pos.lat, pos.lng) : null;
  const within = dist !== null ? dist <= project.radius : null;
  const today = history.filter((h) => new Date(h.markedAt).toDateString() === new Date().toDateString());
  const next = today[0]?.kind === "entrada" ? "salida" : "entrada";

  // Radar: el círculo interno es la geocerca; el exterior representa 2× el radio.
  const scale = 56 / project.radius; // px por metro (radar de 224 px)
  let dot = { x: 0, y: 0 };
  if (pos && hasSite && dist !== null) {
    const dy = (pos.lat - project.lat!) * 111320;
    const dx = (pos.lng - project.lng!) * 111320 * Math.cos((project.lat! * Math.PI) / 180);
    const d = Math.min(dist, project.radius * 2);
    const k = dist > 0 ? d / dist : 0;
    dot = { x: dx * k * scale, y: -dy * k * scale };
  }

  const mark = async (kind: "entrada" | "salida") => {
    if (!pos && !confirm("No hay ubicación GPS. ¿Registrar la marcación sin validar la geocerca?")) return;
    if (within === false && !confirm(`Estás a ${Math.round(dist!)} m de la obra (fuera de la geocerca de ${project.radius} m). La marcación quedará observada. ¿Continuar?`)) return;
    setSaving(kind);
    await enqueue({
      kind: "asistencia", label: `${kind === "entrada" ? "Entrada" : "Salida"} · ${project.code}`, projectId: project.id, companyId: project.companyId,
      photo: selfie?.blob ?? null, photoFolder: "asistencia",
      payload: { projectId: project.id, kind, lat: pos?.lat ?? null, lng: pos?.lng ?? null, accuracy: pos?.accuracy ?? null, markedAt: new Date().toISOString() },
    });
    setSaving(null);
    onDone(true);
  };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-3xl bg-navy-900 p-5 text-white shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">Geocerca de {project.code}</p>
            <p className="mt-1 font-display text-3xl font-semibold">{dist === null ? "—" : `${Math.round(dist)} m`}</p>
            <p className="text-xs text-white/65">{!hasSite ? "La obra no tiene ubicación configurada" : geoError ?? (pos ? `Precisión ±${Math.round(pos.accuracy)} m · radio permitido ${project.radius} m` : "Obteniendo ubicación…")}</p>
          </div>
          {within === null ? <Badge tone="gray">Sin validar</Badge> : within ? <Badge tone="green">Dentro de la obra</Badge> : <Badge tone="amber">Fuera de la geocerca</Badge>}
        </div>
        <div className="relative mx-auto mt-5 aspect-square w-56">
          <div className="absolute inset-0 rounded-full border border-white/10 bg-white/[0.03]" />
          <div className={cn("absolute inset-1/4 rounded-full border-2", within === false ? "border-warn-500/60 bg-warn-500/10" : "border-brand-green/60 bg-brand-green/10")} />
          <motion.div className="absolute inset-1/4 rounded-full border-2 border-brand-green/40" animate={{ scale: [1, 1.6], opacity: [0.6, 0] }} transition={{ duration: 2.2, repeat: Infinity }} />
          <span className="absolute left-1/2 top-1/2 grid h-6 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-lg bg-white text-[9px] font-bold text-navy-900">OBRA</span>
          {pos && hasSite && (
            <motion.span className="absolute left-1/2 top-1/2 h-4 w-4 rounded-full bg-brand-blue ring-4 ring-white/80"
              style={{ marginLeft: -8, marginTop: -8 }} animate={{ x: dot.x, y: dot.y }} transition={{ type: "spring", damping: 20 }} />
          )}
        </div>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-white/55"><Navigation className="h-3 w-3" />Tu posición se actualiza en tiempo real</p>
      </div>

      <PhotoCapture value={selfie} onChange={setSelfie} facing="user" label="Foto de verificación (opcional)" hint="Selfie en el frente de trabajo" />

      <div className="grid grid-cols-2 gap-3">
        {(["entrada", "salida"] as const).map((k) => (
          <motion.button key={k} whileTap={{ scale: 0.97 }} onClick={() => mark(k)} disabled={!!saving}
            className={cn("flex h-24 flex-col items-center justify-center gap-1.5 rounded-3xl text-white shadow-lg transition disabled:opacity-60",
              k === "entrada" ? "bg-gradient-to-br from-brand-green-600 to-brand-green-700" : "bg-gradient-to-br from-brand-blue to-navy-800",
              next === k && "ring-4 ring-offset-2", next === k && (k === "entrada" ? "ring-brand-green/40" : "ring-brand-blue/40"))}>
            {saving === k ? <LoaderCircle className="h-7 w-7 animate-spin" /> : k === "entrada" ? <LogIn className="h-7 w-7" /> : <LogOut className="h-7 w-7" />}
            <span className="font-display text-base font-semibold">Marcar {k}</span>
            {next === k && <span className="text-[10px] uppercase tracking-wider text-white/75">Sugerido</span>}
          </motion.button>
        ))}
      </div>

      <div className="rounded-2xl border border-line bg-white p-4">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-muted">Últimas marcaciones</p>
        {history.length ? (
          <ul className="mt-2 divide-y divide-line-soft">
            {history.slice(0, 8).map((h) => (
              <li key={h.id} className="flex items-center gap-3 py-2 text-sm">
                {h.within === false ? <MapPinOff className="h-4 w-4 text-warn-500" /> : <MapPinCheck className="h-4 w-4 text-brand-green-600" />}
                <span className="font-semibold capitalize">{h.kind}</span>
                <span suppressHydrationWarning className="text-ink-muted">{new Date(h.markedAt).toLocaleString("es-PE", { weekday: "short", hour: "2-digit", minute: "2-digit" })}</span>
                <span className="ml-auto text-xs text-ink-muted">{h.distance !== null ? `${Math.round(h.distance)} m` : "sin GPS"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-ink-muted">Sin marcaciones recientes.</p>
        )}
        {!pos && !geoError && <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-muted"><LoaderCircle className="h-3 w-3 animate-spin" />Buscando señal GPS…</p>}
        {geoError && toastOnce(geoError)}
      </div>
    </div>
  );
}

let shown = "";
function toastOnce(msg: string) {
  if (shown !== msg) { shown = msg; setTimeout(() => toast.warning(msg), 0); }
  return null;
}
