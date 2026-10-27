import type { ReactNode } from "react";
import { CountUp } from "./motion";
import { cn } from "./primitives";

const ACCENT = {
  blue: "bg-brand-blue-50 text-brand-blue",
  green: "bg-ok-50 text-brand-green-700",
  violet: "bg-violet-50 text-violet-700",
  amber: "bg-warn-50 text-[#9a5200]",
  red: "bg-danger-50 text-danger",
  navy: "bg-navy-900 text-white",
  cyan: "bg-cyan-50 text-cyan-800",
} as const;

/** Tarjeta KPI con ícono y número animado. */
export function KpiCard({ label, value, format = "money", sub, icon, tone = "blue", className, children }: {
  label: string; value: number; format?: "money" | "moneyShort" | "int" | "pct" | "number"; sub?: ReactNode; icon?: ReactNode;
  tone?: keyof typeof ACCENT; className?: string; children?: ReactNode;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-line bg-card p-4 shadow-card", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        {icon && <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-xl", ACCENT[tone])}>{icon}</span>}
      </div>
      <p className="mt-1 truncate font-display text-[22px] font-semibold tracking-tight text-ink"><CountUp value={value} format={format} /></p>
      {sub && <div className="mt-0.5 text-[11px] text-ink-muted">{sub}</div>}
      {children}
    </div>
  );
}
