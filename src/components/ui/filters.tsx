"use client";
import { CalendarRange, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { cn } from "./primitives";

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PRESETS: { key: string; label: string; range: () => [string, string] }[] = [
  { key: "q", label: "Quincena", range: () => { const d = new Date(); const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() <= 15 ? 1 : 16); return [iso(s), iso(d)]; } },
  { key: "m", label: "Este mes", range: () => { const d = new Date(); return [iso(new Date(d.getFullYear(), d.getMonth(), 1)), iso(d)]; } },
  { key: "pm", label: "Mes anterior", range: () => { const d = new Date(); return [iso(new Date(d.getFullYear(), d.getMonth() - 1, 1)), iso(new Date(d.getFullYear(), d.getMonth(), 0))]; } },
  { key: "90", label: "90 días", range: () => { const d = new Date(); const s = new Date(d); s.setDate(s.getDate() - 90); return [iso(s), iso(d)]; } },
  { key: "y", label: "Año", range: () => { const d = new Date(); return [`${d.getFullYear()}-01-01`, iso(d)]; } },
];

/** Hook para leer/escribir filtros en la URL (los Server Components vuelven a consultar). */
export function useUrlFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const set = (patch: Record<string, string | null | undefined>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };
  return { params, set, pending };
}

/** Intervalo de fechas con atajos (quincena, mes, 90 días, año). Escribe ?desde=&hasta= */
export function DateRangeFilter({ className }: { className?: string }) {
  const { params, set, pending } = useUrlFilters();
  const from = params.get("desde") ?? "";
  const to = params.get("hasta") ?? "";
  return (
    <div className={cn("flex flex-wrap items-center gap-2", pending && "opacity-70", className)}>
      <div className="flex items-center gap-1.5 rounded-xl border border-line bg-white px-2.5 py-1 shadow-[inset_0_1px_1px_rgb(15_27_45/0.03)]">
        <CalendarRange className="h-4 w-4 text-brand-blue" />
        <input type="date" value={from} max={to || undefined} onChange={(e) => set({ desde: e.target.value })}
          className="h-7 bg-transparent text-xs font-medium text-ink outline-none" aria-label="Desde" />
        <span className="text-xs text-ink-muted">→</span>
        <input type="date" value={to} min={from || undefined} onChange={(e) => set({ hasta: e.target.value })}
          className="h-7 bg-transparent text-xs font-medium text-ink outline-none" aria-label="Hasta" />
        {(from || to) && (
          <button onClick={() => set({ desde: null, hasta: null })} className="ml-1 rounded-md p-1 text-ink-muted hover:bg-line-soft hover:text-ink" aria-label="Quitar fechas">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => {
          const [a, b] = p.range();
          const active = from === a && to === b;
          return (
            <button key={p.key} onClick={() => set({ desde: a, hasta: b })}
              className={cn("h-8 rounded-lg px-2.5 text-xs font-semibold transition", active ? "bg-navy-900 text-white" : "bg-white text-ink-soft ring-1 ring-line hover:text-ink")}>
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Selector simple ligado a un parámetro de la URL. */
export function UrlSelect({ name, options, placeholder, className }: { name: string; options: { value: string; label: string }[]; placeholder: string; className?: string }) {
  const { params, set } = useUrlFilters();
  return (
    <select value={params.get(name) ?? ""} onChange={(e) => set({ [name]: e.target.value })}
      className={cn("h-9 cursor-pointer rounded-xl border border-line bg-white px-3 pr-8 text-xs font-semibold text-ink outline-none focus:border-brand-blue", className)}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-white/70 p-2.5 backdrop-blur no-print", className)}>{children}</div>;
}

/** Pestañas de segmento (chips) ligadas a un parámetro de URL. */
export function UrlSegment({ name, options, className }: { name: string; options: { value: string; label: string; count?: number }[]; className?: string }) {
  const { params, set } = useUrlFilters();
  const current = params.get(name) ?? options[0]?.value ?? "";
  return (
    <div className={cn("inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1", className)}>
      {options.map((o) => (
        <button key={o.value} onClick={() => set({ [name]: o.value === options[0].value ? null : o.value })}
          className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition",
            current === o.value ? "bg-white text-navy-900 shadow-sm" : "text-ink-muted hover:text-ink")}>
          {o.label}
          {o.count !== undefined && <span className={cn("num rounded-full px-1.5 text-[10px]", current === o.value ? "bg-brand-blue text-white" : "bg-white text-ink-muted")}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
