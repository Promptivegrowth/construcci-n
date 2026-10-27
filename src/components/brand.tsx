"use client";
import { motion } from "framer-motion";
import Image from "next/image";
import { cn } from "@/components/ui/primitives";

// Isotipo Grupo Cruz reconstruido en SVG: cubo isométrico con brazos rojo, azul y verde.
const FACES = [
  { id: "r1", d: "M50 10 L50 50 L15.4 30 Z", fill: "#F21D2F", from: { y: -26 } },
  { id: "r2", d: "M50 10 L84.6 30 L50 50 Z", fill: "#D11426", from: { y: -26 } },
  { id: "b1", d: "M15.4 30 L50 50 L15.4 70 Z", fill: "#0559B5", from: { x: -24, y: 14 } },
  { id: "b2", d: "M15.4 70 L50 50 L50 90 Z", fill: "#023F86", from: { x: -24, y: 14 } },
  { id: "g1", d: "M84.6 30 L84.6 70 L50 50 Z", fill: "#12AE55", from: { x: 24, y: 14 } },
  { id: "g2", d: "M84.6 70 L50 90 L50 50 Z", fill: "#036B34", from: { x: 24, y: 14 } },
];
const CUBE = [
  { d: "M50 34 L63.9 42 L50 50 L36.1 42 Z", fill: "#FFFFFF" },
  { d: "M36.1 42 L50 50 L50 66 L36.1 58 Z", fill: "#E9EBEE" },
  { d: "M50 50 L63.9 42 L63.9 58 L50 66 Z", fill: "#D3D7DD" },
];

export function BrandMark({ size = 40, animated = false, className, ring = true }: { size?: number; animated?: boolean; className?: string; ring?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-label="Grupo Cruz">
      {ring && <circle cx="50" cy="50" r="48" fill="#E8EAED" />}
      <g strokeLinejoin="round" strokeWidth="2.2">
        {FACES.map((f, i) =>
          animated ? (
            <motion.path key={f.id} d={f.d} fill={f.fill} stroke={f.fill}
              initial={{ opacity: 0, ...f.from }} animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 + Math.floor(i / 2) * 0.18, ease: [0.22, 1, 0.36, 1] }} />
          ) : <path key={f.id} d={f.d} fill={f.fill} stroke={f.fill} />,
        )}
        {CUBE.map((c, i) =>
          animated ? (
            <motion.path key={i} d={c.d} fill={c.fill} stroke={c.fill} initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }}
              style={{ transformOrigin: "50px 50px" }} transition={{ duration: 0.5, delay: 0.8 + i * 0.06 }} />
          ) : <path key={i} d={c.d} fill={c.fill} stroke={c.fill} />,
        )}
      </g>
    </svg>
  );
}

const LOGOS: Record<string, string> = {
  holding: "logo-holding",
  ingenieria: "logo-ingenieria",
  infraestructura: "logo-infraestructura",
  edificaciones: "logo-edificaciones",
  contratistas: "logo-contratistas",
};

/** Logotipo completo (wordmark + isotipo). `dark` usa la variante para fondos azul marino. */
export function CompanyLogo({ logoKey = "holding", dark = false, className, priority }: { logoKey?: string | null; dark?: boolean; className?: string; priority?: boolean }) {
  const file = LOGOS[logoKey ?? "holding"] ?? LOGOS.holding;
  return (
    <Image src={`/brand/${file}${dark ? "-dark" : ""}.png`} alt="Grupo Cruz" width={480} height={120} priority={priority}
      className={cn("h-auto w-auto object-contain", className)} />
  );
}

/** Wordmark tipográfico compacto para la barra lateral. */
export function Wordmark({ subtitle, light = true }: { subtitle?: string; light?: boolean }) {
  return (
    <div className="leading-none">
      <p className={cn("font-display text-[17px] font-bold tracking-[0.06em]", light ? "text-brand-green" : "text-brand-green-600")}>GRUPO CRUZ</p>
      {subtitle && <p className={cn("mt-1 text-[10.5px] font-medium tracking-[0.18em] uppercase", light ? "text-white/60" : "text-ink-muted")}>{subtitle}</p>}
    </div>
  );
}
