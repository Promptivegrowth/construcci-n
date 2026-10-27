"use client";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, FilePlus2, FilePen, FileX2, History, Lock, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Drawer } from "@/components/ui/dialog";
import { ExportMenu } from "@/components/ui/export-menu";
import { DateRangeFilter, FilterBar, UrlSelect, useUrlFilters } from "@/components/ui/filters";
import { Avatar, Badge, Card, EmptyState, cn } from "@/components/ui/primitives";
import { dateTime, timeAgo } from "@/lib/format";
import { exportAudit } from "../actions";
import { ACTION_LABEL, FIELD_LABEL, HIDDEN_FIELDS, TABLE_LABEL } from "../audit-meta";

export type AuditRow = {
  id: number; table_name: string; record_id: string | null; action: string; changed_at: string; user: string; user_color: string | null;
  project_code: string | null; summary: string; old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null;
};

const ACTION_ICON = { INSERT: FilePlus2, UPDATE: FilePen, DELETE: FileX2 } as Record<string, typeof FilePen>;
const MONEYISH = /(amount|total|budget|cost|pen|subtotal|igv|margin)$/;

function fmt(key: string, v: unknown, people: Map<string, string>) {
  if (v === null || v === undefined || v === "") return <span className="text-ink-muted/60">vacío</span>;
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (typeof v === "object") return <code className="text-[11px]">{JSON.stringify(v)}</code>;
  const s = String(v);
  if ((key.endsWith("_by") || key === "user_id" || key === "changed_by") && people.has(s)) return people.get(s);
  if (/^[0-9a-f-]{36}$/.test(s)) return <span className="font-mono text-[11px] text-ink-muted">{s.slice(0, 8)}…</span>;
  if (MONEYISH.test(key) && !Number.isNaN(Number(s))) return `S/ ${Number(s).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return dateTime(s);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.split("-").reverse().join("/");
  return s;
}

export function AuditView({ rows, total, page, pageSize, companyCode, companyName, userName, projects, people }: {
  rows: AuditRow[]; total: number; page: number; pageSize: number; companyId: string; companyCode: string; companyName: string; userName: string;
  projects: { value: string; label: string }[]; people: { value: string; label: string }[];
}) {
  const { params, set, pending } = useUrlFilters();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [open, setOpen] = useState<AuditRow | null>(null);
  const peopleMap = useMemo(() => new Map(people.map((p) => [p.value, p.label])), [people]);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    const t = setTimeout(() => { if ((params.get("q") ?? "") !== q) set({ q: q || null, page: null }); }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const diff = useMemo(() => {
    if (!open) return [];
    const keys = new Set([...Object.keys(open.old_data ?? {}), ...Object.keys(open.new_data ?? {})]);
    return [...keys].filter((k) => !HIDDEN_FIELDS.has(k)).map((k) => {
      const a = open.old_data?.[k], b = open.new_data?.[k];
      return { key: k, label: FIELD_LABEL[k] ?? k.replace(/_/g, " "), old: a, new: b, changed: open.action === "UPDATE" && JSON.stringify(a) !== JSON.stringify(b) };
    }).sort((x, y) => Number(y.changed) - Number(x.changed));
  }, [open]);
  const changedCount = diff.filter((d) => d.changed).length;

  return (
    <div className="space-y-5">
      <Card className="flex items-start gap-4 border-navy-900/10 bg-gradient-to-r from-navy-900 to-navy-700 p-5 text-white">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10"><Lock className="h-5 w-5 text-brand-green" /></span>
        <div>
          <p className="font-display font-semibold">Historial inalterable</p>
          <p className="mt-0.5 text-sm text-white/70">Los eventos los registra la base de datos automáticamente (triggers). Ningún usuario —ni Gerencia— puede modificarlos o eliminarlos. Las anulaciones no borran: quedan visibles con su motivo.</p>
        </div>
        <div className="ml-auto hidden text-right sm:block">
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/50">Eventos</p>
          <p className="num font-display text-2xl font-semibold">{total.toLocaleString("es-PE")}</p>
        </div>
      </Card>

      <FilterBar>
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="N° comprobante, orden, código, operación…"
            className="h-9 w-full rounded-xl border border-line bg-white pl-9 pr-8 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10" />
          {q && <button onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted"><X className="h-3.5 w-3.5" /></button>}
        </div>
        <UrlSelect name="tabla" placeholder="Todo tipo de registro" options={Object.entries(TABLE_LABEL).map(([value, label]) => ({ value, label }))} />
        <UrlSelect name="accion" placeholder="Toda acción" options={Object.entries(ACTION_LABEL).map(([value, a]) => ({ value, label: a.label }))} />
        <UrlSelect name="usuario" placeholder="Todos los usuarios" options={people} />
        <UrlSelect name="obra" placeholder="Todas las obras" options={projects} />
        <DateRangeFilter />
        <div className="ml-auto">
          <ExportMenu size="sm" meta={{ filename: `trazabilidad-${companyCode}`, company: companyName, user: userName }}
            build={async () => {
              const r = await exportAudit(companyCode, Object.fromEntries(params.entries()));
              if (!r.ok) { toast.error(r.error); throw new Error(r.error); }
              return [{
                name: "Trazabilidad", title: "Historial de trazabilidad", subtitle: `${r.data?.length ?? 0} eventos (máx. 3000)`,
                columns: [{ key: "fecha", header: "Fecha", type: "date" }, { key: "hora", header: "Hora" }, { key: "usuario", header: "Usuario" }, { key: "accion", header: "Acción" },
                  { key: "registro", header: "Registro" }, { key: "obra", header: "Obra" }, { key: "detalle", header: "Detalle", width: 60 }],
                rows: r.data ?? [],
              }];
            }} />
        </div>
      </FilterBar>

      <Card className={cn("overflow-hidden transition-opacity", pending && "opacity-60")}>
        {rows.length === 0 ? (
          <EmptyState className="m-4 border-0" icon={<History className="h-6 w-6" />} title="Sin eventos" description={page > 1 ? "No hay más resultados en esta página." : "No hay eventos con estos filtros."} />
        ) : (
          <ol className="divide-y divide-line-soft">
            {rows.map((r, i) => {
              const A = ACTION_LABEL[r.action] ?? ACTION_LABEL.UPDATE;
              const I = ACTION_ICON[r.action] ?? FilePen;
              const changes = r.action === "UPDATE" ? Object.keys(r.new_data ?? {}).filter((k) => !HIDDEN_FIELDS.has(k) && JSON.stringify(r.old_data?.[k]) !== JSON.stringify(r.new_data?.[k])) : [];
              const statusChange = changes.includes("status") ? `${r.old_data?.status} → ${r.new_data?.status}` : null;
              return (
                <motion.li key={r.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 15) * 0.02 }}>
                  <button onClick={() => setOpen(r)} className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-brand-blue-50/40 sm:px-5">
                    <span className={cn("mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl", A.tone === "green" ? "bg-ok-50 text-brand-green-700" : A.tone === "red" ? "bg-danger-50 text-danger" : "bg-brand-blue-50 text-brand-blue")}>
                      <I className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5 text-[13px]">
                        <b className="text-ink">{r.user}</b>
                        <span className="text-ink-muted">{A.label.toLowerCase()}</span>
                        <Badge tone="gray" dot={false}>{TABLE_LABEL[r.table_name] ?? r.table_name}</Badge>
                        {r.project_code && <Badge tone="navy" dot={false}>{r.project_code}</Badge>}
                        {statusChange && <Badge tone="violet">{statusChange}</Badge>}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-ink-soft">{r.summary}</span>
                      {changes.length > 0 && <span className="mt-0.5 block truncate text-[11px] text-ink-muted">Cambió: {changes.slice(0, 5).map((k) => FIELD_LABEL[k] ?? k).join(", ")}{changes.length > 5 ? "…" : ""}</span>}
                    </span>
                    <span className="shrink-0 text-right text-[11px] text-ink-muted">
                      <span suppressHydrationWarning className="block font-medium text-ink-soft">{timeAgo(r.changed_at)}</span>
                      <span className="hidden sm:block">{dateTime(r.changed_at)}</span>
                    </span>
                  </button>
                </motion.li>
              );
            })}
          </ol>
        )}
        <div className="flex items-center justify-between border-t border-line-soft px-4 py-3 text-xs text-ink-muted">
          <span>{total ? `${(page - 1) * pageSize + 1}–${Math.min(total, page * pageSize)} de ${total.toLocaleString("es-PE")}` : "0 eventos"}</span>
          <div className="flex items-center gap-1">
            <button disabled={page <= 1} onClick={() => set({ page: page - 1 > 1 ? String(page - 1) : null })} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-line-soft disabled:opacity-30" aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></button>
            <span className="num px-2 font-semibold text-ink">{page} / {pages}</span>
            <button disabled={page >= pages} onClick={() => set({ page: String(page + 1) })} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-line-soft disabled:opacity-30" aria-label="Siguiente"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </Card>

      <Drawer open={!!open} onOpenChange={(o) => !o && setOpen(null)} width="max-w-2xl"
        title={open ? `${ACTION_LABEL[open.action]?.label ?? open.action} · ${TABLE_LABEL[open.table_name] ?? open.table_name}` : ""}
        description={open ? `${dateTime(open.changed_at)} · ${open.user}${open.project_code ? ` · Obra ${open.project_code}` : ""}` : undefined}>
        {open && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
              <Avatar name={open.user} color={open.user_color} size={38} />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{open.summary}</p>
                <p className="font-mono text-[11px] text-ink-muted">ID {open.record_id}</p>
              </div>
            </div>
            {open.action === "UPDATE" && <p className="text-xs text-ink-muted"><b className="text-ink">{changedCount}</b> campo(s) modificados, resaltados primero.</p>}
            <div className="overflow-hidden rounded-2xl border border-line">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-ink-muted">
                  <tr><th className="px-3 py-2 text-left">Campo</th>{open.action !== "INSERT" && <th className="px-3 py-2 text-left">Antes</th>}{open.action !== "DELETE" && <th className="px-3 py-2 text-left">{open.action === "INSERT" ? "Valor" : "Después"}</th>}</tr>
                </thead>
                <tbody>
                  {diff.map((d) => (
                    <tr key={d.key} className={cn("border-t border-line-soft align-top", d.changed && "bg-warn-50/70")}>
                      <td className="px-3 py-2 text-xs font-semibold text-ink-soft">{d.label}{d.changed && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-warn-500" />}</td>
                      {open.action !== "INSERT" && <td className={cn("break-words px-3 py-2 text-xs", d.changed && "text-danger line-through decoration-danger/40")}>{fmt(d.key, d.old, peopleMap)}</td>}
                      {open.action !== "DELETE" && <td className={cn("break-words px-3 py-2 text-xs", d.changed && "font-semibold text-brand-green-700")}>{fmt(d.key, d.new, peopleMap)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
