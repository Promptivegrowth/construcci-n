import type { ReactNode } from "react";
import { CountUp } from "./motion";
import { cn } from "./primitives";

type Tone = "blue" | "green" | "red" | "amber" | "navy" | "violet";
const TONE: Record<Tone, { icon: string; bar: string; text: string }> = {
  blue: { icon: "bg-brand-blue-50 text-brand-blue", bar: "bg-brand-blue", text: "text-ink" },
  green: { icon: "bg-ok-50 text-brand-green-700", bar: "bg-brand-green-600", text: "text-ink" },
  red: { icon: "bg-danger-50 text-danger", bar: "bg-danger-500", text: "text-danger" },
  amber: { icon: "bg-warn-50 text-[#9a5200]", bar: "bg-warn-500", text: "text-ink" },
  navy: { icon: "bg-navy-900 text-white", bar: "bg-navy-900", text: "text-ink" },
  violet: { icon: "bg-violet-50 text-violet-700", bar: "bg-violet-500", text: "text-ink" },
};

/** Tarjeta KPI con número animado (usable desde Server Components). */
export function KpiCard({ label, value, format = "money", sub, tone = "blue", icon, className }: {
  label: string; value: number; format?: "money" | "moneyShort" | "number" | "pct" | "int"; sub?: ReactNode; tone?: Tone; icon?: ReactNode; className?: string;
}) {
  const t = TONE[tone];
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-line bg-card p-4 shadow-card sm:p-5", className)}>
      <span className={cn("absolute inset-y-0 left-0 w-1", t.bar)} />
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-medium text-ink-muted">{label}</p>
        {icon && <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-xl", t.icon)}>{icon}</span>}
      </div>
      <p className={cn("mt-1 whitespace-nowrap font-display text-[clamp(17px,1.55vw,24px)] font-semibold leading-tight", t.text)}>
        <CountUp value={value} format={format} />
      </p>
      {sub && <div className="mt-1 text-[11px] text-ink-muted">{sub}</div>}
    </div>
  );
}

/** Sección con título dentro de una tarjeta. */
export function Panel({ title, subtitle, actions, children, className, bodyClassName }: {
  title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string;
}) {
  return (
    <section className={cn("min-w-0 rounded-2xl border border-line bg-card shadow-card", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <h3 className="font-display text-[15px] font-semibold text-ink">{title}</h3>
          {subtitle && <p className="mt-1 text-xs text-ink-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
