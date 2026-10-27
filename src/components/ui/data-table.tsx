"use client";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import type { ExportColumnType, ExportMeta, ExportSheet } from "@/lib/export/types";
import { ExportMenu } from "./export-menu";
import { cn } from "./primitives";

export type Column<T> = {
  key: string;
  header: string;
  /** Valor crudo para ordenar, buscar y exportar */
  value?: (row: T) => string | number | null | undefined;
  cell?: (row: T) => ReactNode;
  type?: ExportColumnType;
  align?: "left" | "right" | "center";
  className?: string;
  /** Oculta la columna en móviles */
  hideSm?: boolean;
  /** Suma la columna en el pie */
  total?: boolean;
  sortable?: boolean;
  exportable?: boolean;
};

export function DataTable<T extends Record<string, unknown>>({
  rows, columns, searchPlaceholder = "Buscar…", pageSize = 15, rowHref, onRowClick, exportSheet, exportMeta,
  toolbar, empty, initialSort, dense, rowClassName, searchable = true,
}: {
  rows: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  pageSize?: number;
  rowHref?: (row: T) => string;
  onRowClick?: (row: T) => void;
  exportSheet?: Omit<ExportSheet, "columns" | "rows" | "totals">;
  exportMeta?: ExportMeta;
  toolbar?: ReactNode;
  empty?: ReactNode;
  initialSort?: { key: string; dir: "asc" | "desc" };
  dense?: boolean;
  rowClassName?: (row: T) => string | undefined;
  searchable?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(0);

  const val = (c: Column<T>, r: T) => (c.value ? c.value(r) : (r[c.key] as string | number | null | undefined));

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let out = rows;
    if (term) {
      const words = term.split(/\s+/);
      out = rows.filter((r) => {
        const hay = columns.map((c) => String(val(c, r) ?? "")).join(" ").toLowerCase();
        return words.every((w) => hay.includes(w));
      });
    }
    if (sort) {
      const c = columns.find((x) => x.key === sort.key);
      if (c) {
        out = [...out].sort((a, b) => {
          const va = val(c, a), vb = val(c, b);
          const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va ?? "").localeCompare(String(vb ?? ""), "es", { numeric: true });
          return sort.dir === "asc" ? cmp : -cmp;
        });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, sort, columns]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const slice = filtered.slice(current * pageSize, current * pageSize + pageSize);
  const hasTotals = columns.some((c) => c.total);
  const totals = useMemo(
    () => Object.fromEntries(columns.filter((c) => c.total).map((c) => [c.key, filtered.reduce((s, r) => s + Number(val(c, r) ?? 0), 0)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, columns],
  );

  const fmt = (c: Column<T>, v: number) =>
    c.type === "money" ? `S/ ${v.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : v.toLocaleString("es-PE", { maximumFractionDigits: 2 });

  const toggleSort = (k: string) => {
    setPage(0);
    setSort((s) => (!s || s.key !== k ? { key: k, dir: "desc" } : s.dir === "desc" ? { key: k, dir: "asc" } : null));
  };

  const exportCols = columns.filter((c) => c.exportable !== false && c.header);
  const align = (c: Column<T>) => c.align ?? (c.type && c.type !== "text" && c.type !== "date" ? "right" : "left");

  return (
    <div className="min-w-0">
      {(searchable || toolbar || exportSheet) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-4 py-3 no-print">
          {searchable && (
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder={searchPlaceholder}
                className="h-9 w-full rounded-xl border border-line bg-surface pl-9 pr-8 text-sm outline-none transition focus:border-brand-blue focus:bg-white focus:ring-4 focus:ring-brand-blue/10" />
              {q && <button onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink" aria-label="Limpiar"><X className="h-3.5 w-3.5" /></button>}
            </div>
          )}
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            {toolbar}
            {exportSheet && (
              <ExportMenu size="sm" meta={exportMeta ?? { filename: exportSheet.name }}
                build={() => [{
                  ...exportSheet,
                  columns: exportCols.map((c) => ({ key: c.key, header: c.header, type: c.type })),
                  rows: filtered.map((r) => Object.fromEntries(exportCols.map((c) => [c.key, val(c, r) ?? ""]))),
                  totals: hasTotals ? totals : undefined,
                }]} />
            )}
          </div>
        </div>
      )}
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50/80 text-[11px] uppercase tracking-wide text-ink-muted">
              {columns.map((c) => (
                <th key={c.key} className={cn("whitespace-nowrap px-4 py-2.5 font-semibold", align(c) === "right" ? "text-right" : align(c) === "center" ? "text-center" : "text-left", c.hideSm && "hidden md:table-cell")}>
                  {c.sortable === false ? c.header : (
                    <button onClick={() => toggleSort(c.key)} className={cn("inline-flex items-center gap-1 uppercase hover:text-ink", align(c) === "right" && "flex-row-reverse")}>
                      {c.header}
                      {sort?.key === c.key ? (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => {
              const href = rowHref?.(r);
              return (
                <tr key={(r.id as string) ?? i}
                  onClick={href ? () => router.push(href) : onRowClick ? () => onRowClick(r) : undefined}
                  className={cn("border-t border-line-soft transition-colors", (href || onRowClick) && "cursor-pointer hover:bg-brand-blue-50/50", rowClassName?.(r))}>
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-4 align-middle", dense ? "py-2" : "py-3", align(c) === "right" ? "num whitespace-nowrap text-right" : align(c) === "center" ? "text-center" : "text-left", c.hideSm && "hidden md:table-cell", c.className)}>
                      {c.cell ? c.cell(r) : c.type === "money" ? fmt(c, Number(val(c, r) ?? 0)) : (val(c, r) ?? "—")}
                    </td>
                  ))}
                </tr>
              );
            })}
            {!slice.length && (
              <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-ink-muted">{empty ?? (q ? `Sin resultados para “${q}”.` : "Sin registros.")}</td></tr>
            )}
          </tbody>
          {hasTotals && filtered.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-navy-900/80 bg-brand-blue-50/60 font-semibold text-navy-900">
                {columns.map((c, i) => (
                  <td key={c.key} className={cn("num whitespace-nowrap px-4 py-2.5", align(c) === "right" ? "text-right" : "text-left", c.hideSm && "hidden md:table-cell")}>
                    {c.total ? fmt(c, totals[c.key]) : i === 0 ? `Total (${filtered.length})` : ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {filtered.length > pageSize && (
        <div className="flex items-center justify-between gap-2 border-t border-line-soft px-4 py-2.5 text-xs text-ink-muted no-print">
          <span>{current * pageSize + 1}–{Math.min(filtered.length, (current + 1) * pageSize)} de {filtered.length}</span>
          <div className="flex items-center gap-1">
            <button disabled={current === 0} onClick={() => setPage(current - 1)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-line-soft disabled:opacity-30" aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></button>
            <span className="num px-2 font-semibold text-ink">{current + 1} / {pages}</span>
            <button disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-line-soft disabled:opacity-30" aria-label="Siguiente"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
