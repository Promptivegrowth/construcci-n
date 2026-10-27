"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { consumptionLevel } from "@/lib/calc";
import { money, pct } from "@/lib/format";
import { cn } from "@/components/ui/primitives";

export type BudgetRow = { key: string; label: string; sub?: string; budget: number; paid: number; committed?: number; href?: string; active?: boolean };

const PAID: Record<string, string> = { normal: "#035aa6", alerta: "#e07b00", peligro: "#c8102e" };

/**
 * Barras horizontales Presupuesto vs. Ejecutado (+ Comprometido rayado), como el tablero de referencia.
 * Cada fila enlaza a su detalle.
 */
export function BudgetBars({ rows, threshold = 0.8 }: { rows: BudgetRow[]; threshold?: number }) {
  return (
    <div className="space-y-3.5">
      {rows.map((r, i) => {
        const ratioPaid = r.budget > 0 ? r.paid / r.budget : r.paid > 0 ? 1 : 0;
        const ratioComm = r.budget > 0 ? (r.committed ?? 0) / r.budget : 0;
        const level = consumptionLevel(ratioPaid, threshold);
        const Wrapper = r.href ? Link : "div";
        return (
          <Wrapper key={r.key} href={r.href ?? "#"} className={cn("group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-xl p-1.5 transition sm:grid-cols-[minmax(150px,220px)_minmax(0,1fr)_56px]", r.href && "hover:bg-slate-50", r.active && "bg-brand-blue-50/60")}>
            <div className="min-w-0">
              <p className={cn("truncate text-[13px] text-ink", r.active ? "font-bold" : "font-semibold")}>{r.label}</p>
              {r.sub && <p className="truncate text-[11px] text-ink-muted">{r.sub}</p>}
            </div>
            <span className={cn("num text-right text-xs font-bold sm:order-last", level === "peligro" ? "text-danger" : level === "alerta" ? "text-[#9a5200]" : "text-ink")}>{pct(ratioPaid, 0)}</span>
            <div className="relative col-span-2 h-4 overflow-hidden rounded-md bg-brand-blue-100/60 sm:col-span-1" title={`Pagado ${money(r.paid)} · Comprometido ${money(r.committed ?? 0)} · Presupuesto ${money(r.budget)}`}>
              <motion.div className="absolute inset-y-0 left-0 rounded-md" style={{ background: PAID[level] }}
                initial={{ width: 0 }} whileInView={{ width: `${Math.min(ratioPaid, 1) * 100}%` }} viewport={{ once: true }}
                transition={{ duration: 1, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }} />
              {ratioComm > 0 && (
                <motion.div className="hatch absolute inset-y-0 rounded-r-md bg-[#5b8fd0]"
                  style={{ left: `${Math.min(ratioPaid, 1) * 100}%` }}
                  initial={{ width: 0 }} whileInView={{ width: `${Math.min(ratioComm, Math.max(0, 1 - ratioPaid)) * 100}%` }} viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.5 + i * 0.06 }} />
              )}
              <span className="absolute inset-y-0 w-px bg-warn-500" style={{ left: `${threshold * 100}%` }} />
            </div>
          </Wrapper>
        );
      })}
      <div className="flex flex-wrap gap-4 pt-1 text-[11px] font-medium text-ink-soft">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-3 rounded-sm bg-brand-blue" />Pagado</span>
        <span className="flex items-center gap-1.5"><span className="hatch h-2.5 w-3 rounded-sm bg-[#5b8fd0]" />Comprometido (O/S y O/C emitidas)</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-3 rounded-sm bg-brand-blue-100" />Presupuesto</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-px bg-warn-500" />Umbral {pct(threshold, 0)}</span>
      </div>
    </div>
  );
}

/** Medidor semicircular de consumo. */
export function Gauge({ value, label, threshold = 0.8, size = 180 }: { value: number; label?: string; threshold?: number; size?: number }) {
  const level = consumptionLevel(value, threshold);
  const color = PAID[level];
  const r = 70, c = Math.PI * r;
  const v = Math.min(Math.max(value, 0), 1);
  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg viewBox="0 0 180 104" width={size} height={size * 0.58}>
        <path d="M20,94 A70,70 0 0 1 160,94" fill="none" stroke="#e7edf5" strokeWidth={16} strokeLinecap="round" />
        <motion.path d="M20,94 A70,70 0 0 1 160,94" fill="none" stroke={color} strokeWidth={16} strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} whileInView={{ strokeDashoffset: c * (1 - v) }} viewport={{ once: true }}
          transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }} />
        {(() => {
          const a = Math.PI * (1 - threshold);
          return <line x1={90 + Math.cos(a) * 58} y1={94 - Math.sin(a) * 58} x2={90 + Math.cos(a) * 82} y2={94 - Math.sin(a) * 82} stroke="#f59e0b" strokeWidth={2.5} />;
        })()}
        <text x="90" y="86" textAnchor="middle" className="num fill-ink font-display" fontSize="26" fontWeight="700">{pct(value, 0)}</text>
      </svg>
      {label && <p className="-mt-1 text-center text-[11px] font-medium text-ink-muted">{label}</p>}
    </div>
  );
}
