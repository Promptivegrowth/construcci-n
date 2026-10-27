"use client";
// Gráficos con carga diferida (lazy loading) y skeleton mientras cargan.
import dynamic from "next/dynamic";

const ChartSkeleton = ({ h = 280 }: { h?: number }) => (
  <div className="flex items-end gap-3 px-2" style={{ height: h }}>
    {[45, 70, 55, 85, 60, 75, 40].map((v, i) => <div key={i} className="skeleton flex-1" style={{ height: `${v}%` }} />)}
  </div>
);
const DonutSkeleton = () => (
  <div className="flex items-center gap-6"><div className="skeleton h-52 w-52 rounded-full" /><div className="flex-1 space-y-3">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-4" />)}</div></div>
);

export const Bar3DChart = dynamic(() => import("./bar3d").then((m) => m.Bar3DChart), { ssr: false, loading: () => <ChartSkeleton h={320} /> });
export const DonutChart = dynamic(() => import("./recharts").then((m) => m.DonutChart), { ssr: false, loading: () => <DonutSkeleton /> });
export const SCurveChart = dynamic(() => import("./recharts").then((m) => m.SCurveChart), { ssr: false, loading: () => <ChartSkeleton h={300} /> });
export const PeriodBars = dynamic(() => import("./recharts").then((m) => m.PeriodBars), { ssr: false, loading: () => <ChartSkeleton h={240} /> });
export const CashFlowChart = dynamic(() => import("./recharts").then((m) => m.CashFlowChart), { ssr: false, loading: () => <ChartSkeleton h={300} /> });
export { BudgetBars, Gauge } from "./budget-bars";
export type { Bar3DCategory, Bar3DSeries } from "./bar3d";
export type { Slice, SPoint, PeriodBar } from "./recharts";
export type { BudgetRow } from "./budget-bars";

/** Colores de series validados (orden categórico fijo). */
export const SERIES = {
  proyectado: "#035AA6",
  pagado: "#0A9F4C",
  declarado: "#7C3AED",
  comprometido: "#E07B00",
  extra: "#0891B2",
  saldo: "#94A3B8",
} as const;
