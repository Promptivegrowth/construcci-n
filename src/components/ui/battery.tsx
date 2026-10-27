"use client";
import { motion } from "framer-motion";
import { AlertTriangle, CircleCheck, OctagonAlert } from "lucide-react";
import { consumptionLevel, type Level } from "@/lib/calc";
import { money, pct } from "@/lib/format";
import { cn } from "./primitives";

const FILL: Record<Level, string> = {
  normal: "linear-gradient(90deg, #035AA6 0%, #0A7FB8 45%, #0A9F4C 100%)",
  alerta: "linear-gradient(90deg, #f59e0b 0%, #e07b00 100%)",
  peligro: "linear-gradient(90deg, #f21d2f 0%, #b40e5a 100%)",
};
export const LEVEL_META: Record<Level, { label: string; text: string; bg: string; Icon: typeof CircleCheck }> = {
  normal: { label: "Consumo normal", text: "text-brand-green-700", bg: "bg-ok-50", Icon: CircleCheck },
  alerta: { label: "Alerta ≥ 80%", text: "text-[#9a5200]", bg: "bg-warn-50", Icon: AlertTriangle },
  peligro: { label: "Sobrecosto", text: "text-danger", bg: "bg-danger-50", Icon: OctagonAlert },
};

/**
 * Barra de consumo que "carga como batería": azul→verde hasta 79%, ámbar desde el umbral
 * y roja al exceder el 100%. Marca el umbral de alerta y, opcionalmente, el % de plazo transcurrido.
 */
export function BatteryBar({
  value, total, threshold = 0.8, elapsed, size = "md", showLabel = true, label, className, delay = 0,
}: {
  value: number; total: number; threshold?: number; elapsed?: number; size?: "sm" | "md" | "lg";
  showLabel?: boolean; label?: string; className?: string; delay?: number;
}) {
  const r = total > 0 ? value / total : value > 0 ? 1 : 0;
  const level = consumptionLevel(r, threshold);
  const width = Math.min(r, 1) * 100;
  const h = size === "sm" ? "h-2" : size === "lg" ? "h-5" : "h-3";
  const meta = LEVEL_META[level];
  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px]">
          <span className="truncate font-medium text-ink-soft">{label ?? `${money(value)} de ${money(total)}`}</span>
          <span className={cn("num inline-flex items-center gap-1 font-bold", meta.text)}>
            <meta.Icon className="h-3.5 w-3.5" aria-hidden />
            {pct(r)}
          </span>
        </div>
      )}
      <div
        className={cn("relative w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200/70", h)}
        role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(r * 100)} aria-label={`${meta.label}: ${pct(r)}`}
      >
        <motion.div
          className={cn("absolute inset-y-0 left-0 rounded-full", level === "peligro" && "animate-pulse")}
          style={{ background: FILL[level] }}
          initial={{ width: 0 }}
          whileInView={{ width: `${width}%` }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, delay, ease: [0.22, 1, 0.36, 1] }}
        >
          {size !== "sm" && <span className="absolute inset-0 rounded-full bg-[linear-gradient(180deg,rgb(255_255_255/0.35),transparent_60%)]" />}
        </motion.div>
        {/* segmentos tipo batería */}
        {size !== "sm" && (
          <div className="pointer-events-none absolute inset-0 flex">
            {Array.from({ length: 10 }).map((_, i) => <span key={i} className="h-full flex-1 border-r border-white/50 last:border-0" />)}
          </div>
        )}
        <span className="absolute inset-y-0 w-0.5 bg-warn-500/90" style={{ left: `${threshold * 100}%` }} title={`Umbral de alerta ${pct(threshold, 0)}`} />
        {elapsed !== undefined && (
          <span className="absolute -inset-y-0.5 w-[3px] rounded bg-navy-900" style={{ left: `calc(${Math.min(elapsed, 1) * 100}% - 1.5px)` }} title={`Plazo transcurrido ${pct(elapsed, 0)}`} />
        )}
      </div>
    </div>
  );
}

/** Semáforo de tres luces para el estado de consumo. */
export function Semaphore({ level, className }: { level: Level; className?: string }) {
  const on = { normal: 2, alerta: 1, peligro: 0 }[level];
  const colors = ["#f21d2f", "#f59e0b", "#0a9f4c"];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-navy-900 px-1.5 py-1", className)} title={LEVEL_META[level].label}>
      {colors.map((c, i) => (
        <span key={c} className={cn("h-2.5 w-2.5 rounded-full transition", i === on ? "scale-110" : "opacity-20")}
          style={{ background: c, boxShadow: i === on ? `0 0 8px ${c}` : undefined }} />
      ))}
      <span className="sr-only">{LEVEL_META[level].label}</span>
    </span>
  );
}

export function LevelBadge({ ratio, threshold = 0.8 }: { ratio: number; threshold?: number }) {
  const level = consumptionLevel(ratio, threshold);
  const m = LEVEL_META[level];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", m.bg, m.text)}>
      <m.Icon className="h-3 w-3" /> {m.label}
    </span>
  );
}
