"use client";
import { animate, motion, useInView, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "./primitives";
import { money, moneyShort, number, pct } from "@/lib/format";

type Fmt = "money" | "moneyShort" | "number" | "pct" | "int";
const FORMAT: Record<Fmt, (n: number) => string> = {
  money: (n) => money(n),
  moneyShort: (n) => moneyShort(n),
  number: (n) => number(n),
  pct: (n) => pct(n),
  int: (n) => Math.round(n).toLocaleString("es-PE"),
};

/** Número que cuenta hasta su valor al entrar en pantalla. */
export function CountUp({ value, format = "money", className, duration = 1.1 }: { value: number; format?: Fmt; className?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => FORMAT[format](v));
  useEffect(() => {
    if (!inView) return;
    const c = animate(mv, value, { duration, ease: [0.22, 1, 0.36, 1] });
    return () => c.stop();
  }, [inView, value, duration, mv]);
  return <motion.span ref={ref} className={cn("num", className)}>{text}</motion.span>;
}

/** Entrada escalonada para grillas de tarjetas. */
export function Stagger({ children, className, delay = 0.05 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div className={className} initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: delay } } }}>
      {children}
    </motion.div>
  );
}
export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={cn("min-w-0", className)} variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } } }}>
      {children}
    </motion.div>
  );
}

export function FadeIn({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div className={cn("min-w-0", className)} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}
