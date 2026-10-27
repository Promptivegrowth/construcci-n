"use client";
import { AnimatePresence, motion } from "framer-motion";
import { AlertOctagon, CheckCheck, CircleCheck, ExternalLink, FileText, FileWarning, LoaderCircle, MessageSquareWarning, PartyPopper, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BatteryBar } from "@/components/ui/battery";
import { Modal } from "@/components/ui/dialog";
import { Badge, Button, cn, EmptyState, Field, Textarea } from "@/components/ui/primitives";
import { date, DOC_TYPE_LABEL, docRef, money, timeAgo } from "@/lib/format";
import { approveExpenses, observeExpenses } from "../gastos/actions";

export type ApprovalItem = {
  id: string; seq: number; issue_date: string; declared_at: string | null; doc_type: string; series: string | null; doc_number: string | null;
  description: string; cost_pen: number; payable_pen: number; currency: string; total: number; exceeds_budget: boolean; origin: string; observation: string | null;
  supplier: string; ruc: string; wbs: string; phase: string; budget: number; registered: number; paid: number; files: number; thumb: string | null; pdf: boolean; by: string;
};

export function ApprovalsBoard({ items, companyCode, projectCode, readOnly }: { items: ApprovalItem[]; companyCode: string; projectCode: string; readOnly: boolean }) {
  const router = useRouter();
  const base = `/empresa/${companyCode}/obra/${projectCode}`;
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [onlyExceeds, setOnlyExceeds] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [observe, setObserve] = useState<string[] | null>(null);
  const [text, setText] = useState("");
  const [gone, setGone] = useState<Set<string>>(new Set());

  const visible = useMemo(() => items.filter((i) => !gone.has(i.id) && (!onlyExceeds || i.exceeds_budget) &&
    (!q.trim() || `${i.supplier} ${i.ruc} ${i.description} ${docRef(i)} ${i.wbs}`.toLowerCase().includes(q.trim().toLowerCase()))), [items, gone, onlyExceeds, q]);
  const selected = visible.filter((i) => sel.has(i.id));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const approve = async (ids: string[]) => {
    setBusy(ids.length > 1 ? "bulk" : ids[0]);
    try {
      const r = await approveExpenses(companyCode, projectCode, ids);
      if (!r.ok) return toast.error("No se aprobó", { description: r.error });
      toast.success(r.message ?? "Aprobado", { icon: <CircleCheck className="h-5 w-5 text-brand-green-600" /> });
      setGone((g) => new Set([...g, ...ids]));
      setSel(new Set());
      router.refresh();
    } catch {
      toast.error("Se perdió la conexión", { description: "Actualiza la página para ver el estado real." });
    } finally { setBusy(null); }
  };
  const sendObservation = async () => {
    if (!observe) return;
    setBusy("obs");
    try {
      const r = await observeExpenses(companyCode, projectCode, observe, text);
      if (!r.ok) return toast.error("No se envió la observación", { description: r.error });
      toast.success(r.message ?? "Observado");
      setGone((g) => new Set([...g, ...observe]));
      setSel(new Set());
      setObserve(null);
      setText("");
      router.refresh();
    } finally { setBusy(null); }
  };

  if (!items.length) {
    return <EmptyState icon={<PartyPopper className="h-6 w-6" />} title={readOnly ? "No hay comprobantes observados" : "¡Bandeja al día!"}
      description={readOnly ? "La obra no tiene correcciones pendientes." : "No hay comprobantes pendientes de aprobación en esta obra."} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {!readOnly && (
          <label className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold">
            <input type="checkbox" className="h-4 w-4 accent-[#035aa6]" checked={selected.length === visible.length && visible.length > 0}
              onChange={(e) => setSel(e.target.checked ? new Set(visible.map((i) => i.id)) : new Set())} />
            Seleccionar todo ({visible.length})
          </label>
        )}
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Proveedor, RUC, concepto, WBS…" className="h-10 w-full rounded-xl border border-line bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10" />
        </div>
        <button onClick={() => setOnlyExceeds(!onlyExceeds)} className={cn("inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold ring-1 transition", onlyExceeds ? "bg-danger-50 text-danger ring-danger/30" : "bg-white text-ink-soft ring-line")}>
          <AlertOctagon className="h-4 w-4" />Solo los que exceden su WBS
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AnimatePresence initial={false}>
          {visible.map((i, idx) => (
            <motion.div key={i.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { delay: Math.min(idx, 8) * 0.03 } }} exit={{ opacity: 0, x: 60, transition: { duration: 0.25 } }}
              className={cn("overflow-hidden rounded-2xl border bg-white shadow-card transition", sel.has(i.id) ? "border-brand-blue ring-4 ring-brand-blue/10" : "border-line", i.exceeds_budget && "border-l-4 border-l-danger-500")}>
              <div className="flex gap-4 p-4">
                <Link href={`${base}/gastos/${i.id}`} className="group relative h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-line">
                  {i.thumb ? <img src={i.thumb} alt="Sustento" className="h-full w-full object-cover transition group-hover:scale-105" />
                    : <span className={cn("grid h-full place-items-center", i.doc_type === "PL" ? "bg-slate-100 text-ink-muted" : i.files ? "bg-danger-50 text-danger-500" : "bg-warn-50 text-warn")}>{i.files || i.doc_type === "PL" ? <FileText className="h-7 w-7" /> : <FileWarning className="h-7 w-7" />}</span>}
                  <span className="absolute inset-x-0 bottom-0 bg-navy-900/70 py-0.5 text-center text-[10px] font-semibold text-white">{i.files ? `${i.files} archivo(s)` : i.doc_type === "PL" ? "Planilla" : "Sin sustento"}</span>
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-ink">{i.supplier}</p>
                      <p className="text-[11px] text-ink-muted">{DOC_TYPE_LABEL[i.doc_type]} {docRef(i)} · {date(i.issue_date)} · N° {i.seq}</p>
                    </div>
                    {!readOnly && <input type="checkbox" checked={sel.has(i.id)} onChange={() => toggle(i.id)} className="mt-1 h-5 w-5 shrink-0 accent-[#035aa6]" aria-label="Seleccionar" />}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-ink-soft">{i.description}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="num font-display text-lg font-semibold text-ink">{money(i.cost_pen)}</span>
                    <span className="text-[10px] text-ink-muted">costo · a pagar {money(i.payable_pen)}</span>
                    {i.exceeds_budget && <Badge tone="red">Excede WBS</Badge>}
                    {i.origin === "campo" && <Badge tone="cyan">Campo</Badge>}
                  </div>
                </div>
              </div>
              <div className="border-t border-line-soft bg-slate-50/50 px-4 py-3">
                <BatteryBar value={i.registered} total={i.budget} size="sm" label={`${i.phase} · ${i.wbs}`} />
                <p className="mt-1 text-[10.5px] text-ink-muted">Registrado con este gasto {money(i.registered)} de {money(i.budget)} · pagado {money(i.paid)} · declarado por {i.by} {i.declared_at ? timeAgo(i.declared_at) : ""}</p>
                {readOnly && i.observation && <p className="mt-2 rounded-lg bg-warn-50 px-2.5 py-1.5 text-xs text-[#7a4300]"><b>Observación:</b> {i.observation}</p>}
              </div>
              {!readOnly && (
                <div className="flex items-center justify-end gap-2 px-4 py-2.5">
                  <Link href={`${base}/gastos/${i.id}`} className="mr-auto inline-flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline">Ver detalle <ExternalLink className="h-3.5 w-3.5" /></Link>
                  <Button size="sm" variant="outline" onClick={() => setObserve([i.id])} disabled={!!busy}><MessageSquareWarning className="h-3.5 w-3.5 text-warn" />Observar</Button>
                  <Button size="sm" variant="success" onClick={() => approve([i.id])} disabled={!!busy || (!i.files && i.doc_type !== "PL")} title={!i.files && i.doc_type !== "PL" ? "Sin sustento" : undefined}>
                    {busy === i.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <CircleCheck className="h-3.5 w-3.5" />}Aprobar
                  </Button>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {!visible.length && <EmptyState title="Sin resultados" description="Ajusta la búsqueda o los filtros." />}

      <AnimatePresence>
        {selected.length > 0 && (
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            className="fixed inset-x-3 bottom-4 z-40 mx-auto flex max-w-2xl flex-wrap items-center gap-3 rounded-2xl bg-navy-900 p-3 pl-5 text-white shadow-pop lg:left-[290px]">
            <div className="flex-1">
              <p className="text-sm font-semibold">{selected.length} seleccionado(s)</p>
              <p className="num text-xs text-white/60">{money(selected.reduce((s, i) => s + i.cost_pen, 0))} en costo</p>
            </div>
            <Button size="sm" variant="ghost" className="text-white/80 hover:bg-white/10 hover:text-white" onClick={() => setSel(new Set())}><X className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" onClick={() => setObserve(selected.map((s) => s.id))} disabled={!!busy}><MessageSquareWarning className="h-4 w-4 text-warn" />Observar</Button>
            <Button size="sm" variant="success" onClick={() => approve(selected.map((s) => s.id))} disabled={!!busy}>
              {busy === "bulk" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}Aprobar seleccionados
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal open={!!observe} onOpenChange={(o) => !o && setObserve(null)} size="sm" title={`Observar ${observe?.length ?? 0} comprobante(s)`}
        description="La obra recibirá tu comentario para corregir y volver a declarar."
        footer={<><Button variant="ghost" onClick={() => setObserve(null)}>Cancelar</Button>
          <Button onClick={sendObservation} disabled={busy === "obs" || text.trim().length < 5}>{busy === "obs" && <LoaderCircle className="h-4 w-4 animate-spin" />}Enviar observación</Button></>}>
        <Field label="Comentario" required hint="Mínimo 5 caracteres">
          <Textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Ej.: El monto no coincide con la orden de compra; sustentar diferencia." />
        </Field>
      </Modal>
    </div>
  );
}
