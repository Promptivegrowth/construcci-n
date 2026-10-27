"use client";
import { animate, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { moneyShort, money } from "@/lib/format";

export type Bar3DSeries = { name: string; color: string };
export type Bar3DCategory = { label: string; values: number[]; sub?: string };

function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
  const r = ch(n >> 16), g = ch((n >> 8) & 255), b = ch(n & 255);
  return `rgb(${r},${g},${b})`;
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/**
 * Columnas agrupadas en 3D (frente, techo y lateral) con crecimiento animado,
 * etiquetas de valor selectivas, eje recesivo y tooltip por categoría.
 */
export function Bar3DChart({ categories, series, height = 320, valueLabels = true }: {
  categories: Bar3DCategory[]; series: Bar3DSeries[]; height?: number; valueLabels?: boolean;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [hover, setHover] = useState<number | null>(null);
  const inView = useInView(wrap, { once: true, margin: "-30px" });
  const [k, setK] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(0, 1, { duration: 1.4, ease: "linear", onUpdate: setK });
    return () => c.stop();
  }, [inView]);
  // progreso con retardo y easing por barra
  const grow = (delay: number) => {
    const x = Math.min(1, Math.max(0, (k * 1.4 - delay) / 0.9));
    return 1 - Math.pow(1 - x, 3);
  };
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const padL = width < 420 ? 46 : 64, padR = 18, padT = 26, padB = 44;
  const depth = Math.max(5, Math.min(12, width / 70));
  const innerW = width - padL - padR - depth;
  const innerH = height - padT - padB - depth;
  const max = niceMax(Math.max(...categories.flatMap((c) => c.values), 1) * 1.08);
  const ticks = 4;
  const groupW = innerW / Math.max(categories.length, 1);
  const barW = Math.min(46, (groupW * 0.72) / series.length);
  const gap = 4;
  const y = (v: number) => padT + depth + innerH - (v / max) * innerH;
  const base = padT + depth + innerH;

  return (
    <div ref={wrap} className="relative w-full select-none">
      <svg width={width} height={height} role="img" aria-label={`Gráfico de barras 3D: ${series.map((s) => s.name).join(", ")}`}>
        {/* piso en perspectiva */}
        <path d={`M${padL},${base} L${padL + depth},${base - depth} L${padL + depth + innerW},${base - depth} L${padL + innerW},${base} Z`} fill="#eef2f7" />
        {Array.from({ length: ticks + 1 }).map((_, i) => {
          const v = (max / ticks) * i;
          const yy = y(v);
          return (
            <g key={i}>
              <line x1={padL} x2={padL + depth} y1={yy} y2={yy - depth} stroke="#e2e8f0" />
              <line x1={padL + depth} x2={padL + depth + innerW} y1={yy - depth} y2={yy - depth} stroke="#e2e8f0" strokeDasharray={i ? "3 4" : undefined} />
              <text x={padL - 8} y={yy + 3} textAnchor="end" className="fill-ink-muted" fontSize={10.5}>{moneyShort(v)}</text>
            </g>
          );
        })}
        {categories.map((c, ci) => {
          const gx = padL + ci * groupW + (groupW - (barW * series.length + gap * (series.length - 1))) / 2;
          return (
            <g key={c.label} onMouseEnter={() => setHover(ci)} onMouseLeave={() => setHover(null)}>
              <rect x={padL + ci * groupW} y={padT} width={groupW} height={innerH + depth} fill={hover === ci ? "rgb(3 90 166 / 0.05)" : "transparent"} rx={8} />
              {series.map((s, si) => {
                const v = c.values[si] ?? 0;
                const delay = 0.08 * ci + 0.06 * si;
                const g = grow(delay);
                const h = Math.max(0, base - y(v)) * g;
                const x = gx + si * (barW + gap);
                const top = base - h;
                return (
                  <g key={s.name}>
                    {h > 0.5 && (
                      <>
                        <path d={`M${x + barW},${top} L${x + barW + depth},${top - depth} L${x + barW + depth},${base - depth} L${x + barW},${base} Z`} fill={shade(s.color, -0.32)} />
                        <rect x={x} y={top} width={barW} height={h} fill={s.color} />
                        <rect x={x} y={top} width={barW * 0.28} height={h} fill="rgb(255 255 255 / 0.12)" />
                        <path d={`M${x},${top} L${x + depth},${top - depth} L${x + barW + depth},${top - depth} L${x + barW},${top} Z`} fill={shade(s.color, 0.3)} />
                      </>
                    )}
                    {valueLabels && v > 0 && g > 0.98 && (hover === ci || (series.length <= 3 && barW + gap >= 44)) && (
                      <text x={x + barW / 2 + depth / 2} y={top - depth - 5} textAnchor="middle" fontSize={width < 520 ? 9 : 10.5} fontWeight={700} className="fill-ink num">
                        {moneyShort(v)}
                      </text>
                    )}
                  </g>
                );
              })}
              <text x={padL + ci * groupW + groupW / 2} y={base + 18} textAnchor="middle" fontSize={11.5} fontWeight={700} className="fill-ink">{c.label}</text>
              {c.sub && <text x={padL + ci * groupW + groupW / 2} y={base + 32} textAnchor="middle" fontSize={10} className="fill-ink-muted">{c.sub}</text>}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute z-10 min-w-48 rounded-xl border border-line bg-white/95 p-3 text-xs shadow-pop backdrop-blur"
          style={{ left: Math.min(width - 200, Math.max(0, padL + hover * groupW + groupW / 2 - 96)), top: 4 }}>
          <p className="mb-1.5 font-display text-[13px] font-semibold text-ink">{categories[hover].label}</p>
          {series.map((s, si) => (
            <div key={s.name} className="flex items-center justify-between gap-4 py-0.5">
              <span className="flex items-center gap-1.5 text-ink-soft"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />{s.name}</span>
              <span className="num font-semibold text-ink">{money(categories[hover].values[si] ?? 0)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5 text-[11px] font-medium text-ink-soft">
            <span className="h-3 w-3 rounded-[3px]" style={{ background: `linear-gradient(135deg, ${shade(s.color, 0.25)}, ${s.color})` }} />{s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
