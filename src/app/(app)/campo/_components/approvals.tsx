"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Check, CheckCheck, LoaderCircle, MessageSquareWarning, TriangleAlert, WifiOff, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge, Button, Textarea } from "@/components/ui/primitives";
import { date, money } from "@/lib/format";
import { reviewExpense } from "../actions";
import type { CampoData } from "./campo-app";

export function Approvals({ items, online }: { items: CampoData["pending"]; online: boolean }) {
  const router = useRouter();
  const [done, setDone] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [observing, setObserving] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [zoom, setZoom] = useState<string | null>(null);
  const list = items.filter((i) => !done.includes(i.id));

  const act = async (id: string, decision: "aprobar" | "observar") => {
    setBusy(id);
    const r = await reviewExpense(id, decision, decision === "observar" ? text : undefined);
    setBusy(null);
    if (!r.ok) return toast.error("No se pudo registrar", { description: r.error });
    toast.success(r.message);
    setDone((d) => [...d, id]);
    setObserving(null);
    setText("");
    router.refresh();
  };

  if (!online) {
    return (
      <div className="rounded-3xl border border-line bg-white p-8 text-center">
        <WifiOff className="mx-auto h-8 w-8 text-warn-500" />
        <p className="mt-2 font-semibold">Las aprobaciones requieren conexión</p>
        <p className="text-sm text-ink-muted">Se necesita validar en línea el sustento y el saldo del WBS.</p>
      </div>
    );
  }
  if (!list.length) {
    return (
      <div className="rounded-3xl border border-line bg-white p-8 text-center">
        <CheckCheck className="mx-auto h-9 w-9 text-brand-green-600" />
        <p className="mt-2 font-display text-lg font-semibold">Bandeja al día</p>
        <p className="text-sm text-ink-muted">No hay gastos declarados pendientes de aprobación en esta obra.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted"><b className="text-ink">{list.length}</b> gasto(s) declarados por la obra esperan tu revisión. Al aprobar pasan a Contabilidad para pago.</p>
      <AnimatePresence initial={false}>
        {list.map((e) => (
          <motion.div key={e.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 80 }}
            className="overflow-hidden rounded-3xl border border-line bg-white shadow-card">
            <div className="flex gap-3 p-4">
              {e.photo ? (
                <button onClick={() => setZoom(e.photo)} className="h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={e.photo} alt="Sustento" className="h-full w-full object-cover" />
                </button>
              ) : <span className="grid h-20 w-16 shrink-0 place-items-center rounded-xl bg-danger-50 text-[10px] font-semibold text-danger">Sin sustento</span>}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{e.supplier}</p>
                  <p className="num shrink-0 font-display text-base font-semibold">{money(e.total)}</p>
                </div>
                <p className="truncate text-xs text-ink-soft">{e.description}</p>
                <p className="mt-0.5 text-[11px] text-ink-muted">{e.doc} · {date(e.date)} · {e.creator}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {e.origin === "campo" && <Badge tone="cyan">App de campo</Badge>}
                  {e.exceeds && <Badge tone="amber"><TriangleAlert className="h-3 w-3" />Excede saldo WBS</Badge>}
                </div>
              </div>
            </div>
            <AnimatePresence>
              {observing === e.id && (
                <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden px-4">
                  <Textarea autoFocus value={text} onChange={(x) => setText(x.target.value)} placeholder="Motivo de la observación (se notifica al registrante)" className="mb-3 min-h-[64px]" />
                </motion.div>
              )}
            </AnimatePresence>
            <div className="grid grid-cols-2 border-t border-line-soft">
              {observing === e.id ? (
                <>
                  <button onClick={() => setObserving(null)} className="flex h-12 items-center justify-center gap-1.5 text-sm font-semibold text-ink-muted"><X className="h-4 w-4" />Cancelar</button>
                  <button onClick={() => act(e.id, "observar")} disabled={busy === e.id} className="flex h-12 items-center justify-center gap-1.5 border-l border-line-soft text-sm font-bold text-[#9a5200]">
                    {busy === e.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MessageSquareWarning className="h-4 w-4" />}Enviar observación
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => { setObserving(e.id); setText(""); }} className="flex h-12 items-center justify-center gap-1.5 text-sm font-semibold text-[#9a5200]"><MessageSquareWarning className="h-4 w-4" />Observar</button>
                  <button onClick={() => act(e.id, "aprobar")} disabled={busy === e.id} className="flex h-12 items-center justify-center gap-1.5 border-l border-line-soft bg-ok-50 text-sm font-bold text-brand-green-700">
                    {busy === e.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Aprobar
                  </button>
                </>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      {zoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setZoom(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="Sustento ampliado" className="max-h-full max-w-full rounded-xl" />
          <Button variant="outline" size="icon" className="absolute right-4 top-4" onClick={() => setZoom(null)} aria-label="Cerrar"><X className="h-5 w-5" /></Button>
        </div>
      )}
    </div>
  );
}
