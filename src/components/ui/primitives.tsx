import Link from "next/link";
import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Tone } from "@/lib/calc";

export const cn = (...c: ClassValue[]) => twMerge(clsx(c));

// ------------------------------------------------------------------ Button
const BTN = {
  base: "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 select-none",
  variant: {
    primary: "bg-brand-blue text-white shadow-sm shadow-brand-blue/25 hover:bg-brand-blue-700",
    success: "bg-brand-green-600 text-white shadow-sm shadow-brand-green/25 hover:bg-brand-green-700",
    danger: "bg-danger text-white hover:bg-[#a50d26]",
    navy: "bg-navy-900 text-white hover:bg-navy-800",
    outline: "border border-line bg-white text-ink hover:border-brand-blue/40 hover:bg-brand-blue-50/60",
    ghost: "text-ink-soft hover:bg-line-soft hover:text-ink",
    subtle: "bg-brand-blue-50 text-brand-blue hover:bg-brand-blue-100",
  },
  size: { sm: "h-8 px-3 text-xs", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-[15px]", icon: "h-9 w-9" },
};
export type ButtonVariant = keyof typeof BTN.variant;
type BtnProps = { variant?: ButtonVariant; size?: keyof typeof BTN.size };

export const Button = forwardRef<HTMLButtonElement, ComponentProps<"button"> & BtnProps>(function Button(
  { className, variant = "primary", size = "md", ...props }, ref,
) {
  return <button ref={ref} className={cn(BTN.base, BTN.variant[variant], BTN.size[size], className)} {...props} />;
});

export function ButtonLink({ className, variant = "primary", size = "md", ...props }: ComponentProps<typeof Link> & BtnProps) {
  return <Link className={cn(BTN.base, BTN.variant[variant], BTN.size[size], className)} {...props} />;
}

// ------------------------------------------------------------------ Card
export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div className={cn("min-w-0 rounded-2xl border border-line bg-card shadow-card", className)} {...p} />;
}
export function CardHeader({ title, subtitle, actions, className, icon }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 px-5 pt-5", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-blue-50 text-brand-blue">{icon}</div>}
        <div className="min-w-0">
          <h3 className="font-display text-[15px] font-semibold leading-tight text-ink">{title}</h3>
          {subtitle && <p className="mt-1 text-xs text-ink-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
export function CardBody({ className, ...p }: ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...p} />;
}

// ------------------------------------------------------------------ Badge
const TONES: Record<Tone, string> = {
  blue: "bg-brand-blue-50 text-brand-blue ring-brand-blue/15",
  green: "bg-ok-50 text-brand-green-700 ring-brand-green/20",
  amber: "bg-warn-50 text-[#9a5200] ring-warn/20",
  red: "bg-danger-50 text-danger ring-danger/15",
  gray: "bg-slate-100 text-slate-600 ring-slate-300/40",
  violet: "bg-violet-50 text-violet-700 ring-violet-300/40",
  cyan: "bg-cyan-50 text-cyan-800 ring-cyan-300/40",
  navy: "bg-navy-900 text-white ring-navy-900",
};
const DOTS: Record<Tone, string> = {
  blue: "bg-brand-blue", green: "bg-brand-green-600", amber: "bg-warn-500", red: "bg-danger-500", gray: "bg-slate-400",
  violet: "bg-violet-500", cyan: "bg-cyan-600", navy: "bg-white",
};
export function Badge({ tone = "gray", children, className, dot = true }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset", TONES[tone], className)}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", DOTS[tone])} />}
      {children}
    </span>
  );
}

// ------------------------------------------------------------------ Form fields
const FIELD = "w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink placeholder:text-ink-muted/70 shadow-[inset_0_1px_1px_rgb(15_27_45/0.03)] transition focus:border-brand-blue focus:outline-none focus:ring-4 focus:ring-brand-blue/10 disabled:bg-slate-50";

export const Input = forwardRef<HTMLInputElement, ComponentProps<"input">>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(FIELD, "h-10", className)} {...p} />;
});
export const Select = forwardRef<HTMLSelectElement, ComponentProps<"select">>(function Select({ className, ...p }, ref) {
  return <select ref={ref} className={cn(FIELD, "h-10 cursor-pointer appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2366758a%22 stroke-width=%222.5%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[right_12px_center] bg-no-repeat pr-9", className)} {...p} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<"textarea">>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn(FIELD, "min-h-[84px] py-2.5", className)} {...p} />;
});
export function Field({ label, hint, error, children, className, required }: { label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string; required?: boolean }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-semibold text-ink-soft">
        {label} {required && <span className="text-danger-500">*</span>}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs font-medium text-danger">{error}</span> : hint ? <span className="mt-1 block text-[11px] text-ink-muted">{hint}</span> : null}
    </label>
  );
}

// ------------------------------------------------------------------ Skeleton / empty
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4 w-full", className)} />;
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-white/60 px-6 py-12 text-center", className)}>
      {icon && <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand-blue-50 text-brand-blue">{icon}</div>}
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ Page header
export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0 animate-fade-up">
        {eyebrow && <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-blue">{eyebrow}</p>}
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink md:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-3xl text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 no-print">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[11px] font-medium text-ink-muted">{label}</p>
      <p className="num mt-0.5 truncate font-display text-[17px] font-semibold text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-ink-muted">{sub}</p>}
    </div>
  );
}

export function Avatar({ name, color, size = 36, className }: { name?: string | null; color?: string | null; size?: number; className?: string }) {
  const ini = (name ?? "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  return (
    <span className={cn("inline-grid shrink-0 place-items-center rounded-full font-bold text-white ring-2 ring-white", className)}
      style={{ width: size, height: size, fontSize: size * 0.36, background: color ?? "#035AA6" }}>
      {ini}
    </span>
  );
}
