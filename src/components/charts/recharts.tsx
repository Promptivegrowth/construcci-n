"use client";
import { useState } from "react";
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ReferenceLine, ResponsiveContainer, Sector, Tooltip, XAxis, YAxis,
} from "recharts";
import { money, moneyShort, pct } from "@/lib/format";
import { cn } from "@/components/ui/primitives";

const AXIS = { fontSize: 11, fill: "#66758a" };

function TipBox({ title, rows }: { title?: string; rows: { label: string; value: string; color?: string; dashed?: boolean }[] }) {
  return (
    <div className="min-w-44 rounded-xl border border-line bg-white/95 p-3 text-xs shadow-pop backdrop-blur">
      {title && <p className="mb-1.5 font-display text-[13px] font-semibold text-ink">{title}</p>}
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-ink-soft">
            {r.color && <span className={cn("h-2.5 w-2.5 rounded-sm", r.dashed && "h-0.5 w-3 rounded-none")} style={{ background: r.color }} />}
            {r.label}
          </span>
          <span className="num font-semibold text-ink">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ Dona / torta
export type Slice = { name: string; value: number; color: string };
export function DonutChart({ data, centerLabel = "Total", height = 230, format = money }: { data: Slice[]; centerLabel?: string; height?: number; format?: (n: number) => string }) {
  const [active, setActive] = useState<number | undefined>(undefined);
  const total = data.reduce((s, d) => s + d.value, 0);
  const shown = active !== undefined ? data[active] : null;
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative shrink-0" style={{ width: height, height }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={data.length > 1 ? 2 : 0} stroke="#fff" strokeWidth={2}
              animationDuration={1100} startAngle={90} endAngle={-270}
              activeShape={(p: unknown) => {
                const props = p as React.ComponentProps<typeof Sector> & { outerRadius: number };
                return <Sector {...props} outerRadius={props.outerRadius + 7} />;
              }}
              onMouseEnter={(_, i) => setActive(i)} onMouseLeave={() => setActive(undefined)}
              {...({ activeIndex: active } as object)}>
              {data.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-medium text-ink-muted">{shown ? shown.name : centerLabel}</span>
          <span className="num font-display text-lg font-semibold text-ink">{moneyShort(shown ? shown.value : total)}</span>
          {shown && <span className="num text-[11px] font-semibold text-ink-soft">{pct(total ? shown.value / total : 0)}</span>}
        </div>
      </div>
      <ul className="grid w-full min-w-0 gap-y-0.5">
        {data.map((d, i) => (
          <li key={d.name} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(undefined)}
            className={cn("flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-xs transition", active === i && "bg-slate-50")}>
            <span className="flex min-w-0 items-center gap-2 text-ink-soft"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} /><span className="truncate">{d.name}</span></span>
            <span className="num shrink-0 text-right"><span className="font-semibold text-ink">{format(d.value)}</span> <span className="ml-1 text-ink-muted">{pct(total ? d.value / total : 0, 0)}</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------ Curva S
export type SPoint = { label: string; date: string; projected: number; paid?: number | null; declared?: number | null };
export function SCurveChart({ data, todayLabel, budget, height = 300 }: { data: SPoint[]; todayLabel?: string; budget?: number; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="gPaid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0a9f4c" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#0a9f4c" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#eef2f7" vertical={false} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} interval="preserveStartEnd" minTickGap={18} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={moneyShort} width={70} />
          {budget ? <ReferenceLine y={budget} stroke="#062a4d" strokeDasharray="6 4" label={{ value: "Presupuesto", position: "insideTopLeft", fontSize: 10, fill: "#062a4d" }} /> : null}
          {todayLabel && <ReferenceLine x={todayLabel} stroke="#f21d2f" strokeWidth={1.5} label={{ value: "Hoy", position: "top", fontSize: 10, fill: "#c8102e", fontWeight: 700 }} />}
          <Tooltip cursor={{ stroke: "#94a3b8", strokeDasharray: "3 3" }}
            content={({ active, payload, label }) => active && payload?.length ? (
              <TipBox title={String(label)} rows={[
                { label: "Proyectado", value: money(payload[0]?.payload.projected), color: "#035aa6", dashed: true },
                ...(payload[0]?.payload.paid != null ? [{ label: "Real pagado", value: money(payload[0].payload.paid), color: "#0a9f4c" }] : []),
                ...(payload[0]?.payload.declared != null ? [{ label: "Declarado por obra", value: money(payload[0].payload.declared), color: "#7c3aed" }] : []),
              ]} />
            ) : null} />
          <Area type="monotone" dataKey="paid" stroke="#0a9f4c" strokeWidth={2.5} fill="url(#gPaid)" animationDuration={1400} connectNulls={false} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }} />
          <Line type="monotone" dataKey="declared" stroke="#7c3aed" strokeWidth={2} dot={false} animationDuration={1400} connectNulls={false} activeDot={{ r: 4 }} />
          <Line type="monotone" dataKey="projected" stroke="#035aa6" strokeWidth={2} strokeDasharray="7 5" dot={false} animationDuration={1600} activeDot={{ r: 4 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ------------------------------------------------------------------ Barras por periodo
export type PeriodBar = { label: string; value: number; key?: string; secondary?: number };
export function PeriodBars({ data, height = 240, color = "#0a9f4c", highlightLast = true, onSelect, selected, secondaryName, name = "Gasto" }: {
  data: PeriodBar[]; height?: number; color?: string; highlightLast?: boolean; onSelect?: (key: string) => void; selected?: string | null; secondaryName?: string; name?: string;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 18, right: 6, left: 4, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid stroke="#eef2f7" vertical={false} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} interval={0} angle={data.length > 10 ? -35 : 0} textAnchor={data.length > 10 ? "end" : "middle"} height={data.length > 10 ? 46 : 26} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={moneyShort} width={64} />
          <Tooltip cursor={{ fill: "rgb(3 90 166 / 0.06)" }}
            content={({ active, payload, label }) => active && payload?.length ? (
              <TipBox title={String(label)} rows={[
                { label: name, value: money(payload[0].payload.value), color },
                ...(secondaryName ? [{ label: secondaryName, value: money(payload[0].payload.secondary ?? 0), color: "#035aa6" }] : []),
              ]} />
            ) : null} />
          {secondaryName && <Bar dataKey="secondary" fill="#035aa6" radius={[4, 4, 0, 0]} animationDuration={1000} />}
          <Bar dataKey="value" radius={[4, 4, 0, 0]} animationDuration={1100} onClick={(d) => onSelect?.((d as unknown as PeriodBar).key ?? (d as unknown as PeriodBar).label)} className={onSelect ? "cursor-pointer" : undefined}
            label={data.length <= 12 ? { position: "top", fontSize: 10, fill: "#3d4b5f", formatter: (v: unknown) => (Number(v) ? moneyShort(Number(v)).replace("S/ ", "") : "") } : undefined}>
            {data.map((d, i) => {
              const isSel = selected ? (d.key ?? d.label) === selected : highlightLast && i === data.length - 1;
              return <Cell key={d.label} fill={color} fillOpacity={selected ? (isSel ? 1 : 0.35) : isSel ? 1 : 0.42} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ------------------------------------------------------------------ Flujo (ingresos vs egresos)
export function CashFlowChart({ data, height = 300 }: { data: { label: string; ingresos: number; egresos: number; saldo: number }[]; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 12, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid stroke="#eef2f7" vertical={false} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={moneyShort} width={70} />
          <ReferenceLine y={0} stroke="#94a3b8" />
          <Tooltip cursor={{ fill: "rgb(3 90 166 / 0.05)" }}
            content={({ active, payload, label }) => active && payload?.length ? (
              <TipBox title={String(label)} rows={[
                { label: "Ingresos (cobros)", value: money(payload[0].payload.ingresos), color: "#0a9f4c" },
                { label: "Egresos (pagos)", value: money(payload[0].payload.egresos), color: "#e07b00" },
                { label: "Saldo acumulado", value: money(payload[0].payload.saldo), color: "#035aa6", dashed: true },
              ]} />
            ) : null} />
          <Bar dataKey="ingresos" fill="#0a9f4c" radius={[4, 4, 0, 0]} animationDuration={1000} />
          <Bar dataKey="egresos" fill="#e07b00" radius={[4, 4, 0, 0]} animationDuration={1000} />
          <Line type="monotone" dataKey="saldo" stroke="#035aa6" strokeWidth={2.5} dot={{ r: 3, fill: "#035aa6" }} animationDuration={1400} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-1 flex flex-wrap justify-center gap-4 text-[11px] font-medium text-ink-soft">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#0a9f4c]" />Ingresos (cobros)</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#e07b00]" />Egresos (pagos)</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-[#035aa6]" />Saldo acumulado</span>
      </div>
    </div>
  );
}
