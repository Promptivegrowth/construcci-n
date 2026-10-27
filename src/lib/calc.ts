// Cálculos de control presupuestal compartidos por tableros, reportes y exportaciones.
import { toNum } from "./format";

export type WbsStatRow = {
  wbs_id: string; parent_id: string | null; code: string; name: string; level: number; phase_id: string | null;
  cost_type: string | null; budget: number; margin: number; is_leaf: boolean; sort: number;
  declared: number; registered: number; approved: number; pending_approval: number; paid: number; docs: number; committed: number;
};

export type WbsNode = WbsStatRow & { children: WbsNode[] };

const SUMS = ["budget", "margin", "declared", "registered", "approved", "pending_approval", "paid", "docs", "committed"] as const;

export function normalizeStats(rows: Record<string, unknown>[]): WbsStatRow[] {
  return rows.map((r) => ({
    ...(r as unknown as WbsStatRow),
    ...Object.fromEntries(SUMS.map((k) => [k, toNum(r[k])])),
    level: Number(r.level),
    sort: Number(r.sort),
  }));
}

/** Construye el árbol WBS y acumula los montos de las hojas hacia los padres. */
export function buildTree(rows: WbsStatRow[]): WbsNode[] {
  const map = new Map<string, WbsNode>();
  rows.forEach((r) => map.set(r.wbs_id, { ...r, children: [] }));
  const roots: WbsNode[] = [];
  for (const n of map.values()) {
    if (n.parent_id && map.has(n.parent_id)) map.get(n.parent_id)!.children.push(n);
    else roots.push(n);
  }
  const roll = (n: WbsNode) => {
    n.children.sort((a, b) => a.sort - b.sort);
    if (n.children.length) {
      n.children.forEach(roll);
      for (const k of SUMS) (n as Record<string, unknown>)[k] = n.children.reduce((s, c) => s + (c[k] as number), 0);
    }
  };
  roots.sort((a, b) => a.sort - b.sort).forEach(roll);
  return roots;
}

export function flatten(nodes: WbsNode[], out: WbsNode[] = []) {
  for (const n of nodes) {
    out.push(n);
    flatten(n.children, out);
  }
  return out;
}

export type Totals = { budget: number; declared: number; paid: number; committed: number; approved: number; pending: number; margin: number };
export function totals(rows: WbsStatRow[]): Totals {
  const leaves = rows.filter((r) => r.is_leaf);
  const s = (k: keyof WbsStatRow) => leaves.reduce((a, r) => a + toNum(r[k]), 0);
  return { budget: s("budget"), declared: s("declared"), paid: s("paid"), committed: s("committed"), approved: s("approved"), pending: s("pending_approval"), margin: s("margin") };
}

export type Level = "normal" | "alerta" | "peligro";
export function consumptionLevel(r: number, threshold = 0.8): Level {
  if (r >= 1) return "peligro";
  if (r >= threshold) return "alerta";
  return "normal";
}
export const ratio = (a: number, b: number) => (b > 0 ? a / b : a > 0 ? 1 : 0);

export type Conciliation = "conciliado" | "por_conciliar" | "revisar" | "sin_movimiento";
export function conciliation(declared: number, paid: number): Conciliation {
  if (declared < 0.5 && paid < 0.5) return "sin_movimiento";
  const diff = paid - declared;
  if (Math.abs(diff) < 1) return "conciliado";
  return diff < 0 ? "por_conciliar" : "revisar";
}
export const CONCILIATION_LABEL: Record<Conciliation, string> = {
  conciliado: "Conciliado", por_conciliar: "Por conciliar", revisar: "Revisar diferencias", sin_movimiento: "Sin movimiento",
};

type Dated = { start_date: string | null; end_date: string | null; extended_end_date?: string | null };
export const projectEnd = (p: Dated) => p.extended_end_date ?? p.end_date;

/** Porcentaje de plazo transcurrido (0–1). */
export function elapsed(p: Dated, today = new Date()) {
  const end = projectEnd(p);
  if (!p.start_date || !end) return 0;
  const s = new Date(`${p.start_date}T00:00:00`).getTime();
  const e = new Date(`${end}T23:59:59`).getTime();
  if (e <= s) return 1;
  return Math.min(1, Math.max(0, (today.getTime() - s) / (e - s)));
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-9 * (x - 0.5)));
/** Avance proyectado tipo curva S (0–1) para una fracción del plazo. */
export function sCurve(x: number) {
  const a = sigmoid(0), b = sigmoid(1);
  return (sigmoid(Math.min(1, Math.max(0, x))) - a) / (b - a);
}

export function monthsBetween(from: string, to: string) {
  const out: string[] = [];
  let [y, m] = from.slice(0, 7).split("-").map(Number);
  const [ty, tm] = to.slice(0, 7).split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

/** Quincena: 2026-10-Q1 (1–15) / 2026-10-Q2 (16–fin) */
export const fortnightOf = (d: string) => `${d.slice(0, 7)}-Q${Number(d.slice(8, 10)) <= 15 ? 1 : 2}`;
export const fortnightLabel = (q: string) => {
  const [y, m, n] = q.split("-");
  const M = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"][Number(m) - 1];
  return `${n === "Q1" ? "1ra" : "2da"} ${M} ${y.slice(2)}`;
};

export const COST_TYPE_LABEL: Record<string, string> = {
  mano_obra: "Mano de obra", alquileres: "Alquileres", materiales: "Materiales", servicios: "Servicios",
  seguridad: "Seguridad", transporte: "Transporte", gastos_generales: "Gastos generales", contingencias: "Contingencias",
};

export const LABOR_LABEL: Record<string, string> = { capataz: "Capataz", operario: "Operario", oficial: "Oficial", peon: "Peón", staff: "Staff" };

export type Tone = "blue" | "green" | "amber" | "red" | "gray" | "violet" | "cyan" | "navy";

export const PROJECT_STATUS: Record<string, { label: string; tone: Tone }> = {
  preparacion: { label: "En preparación", tone: "blue" },
  ejecucion: { label: "En ejecución", tone: "green" },
  paralizada: { label: "Paralizada", tone: "amber" },
  cancelada: { label: "Cancelada", tone: "red" },
  cerrada: { label: "Cerrada", tone: "gray" },
};

export const EXPENSE_STATUS: Record<string, { label: string; tone: Tone }> = {
  borrador: { label: "Borrador", tone: "gray" },
  declarado: { label: "Declarado", tone: "violet" },
  observado: { label: "Observado", tone: "amber" },
  aprobado: { label: "Por pagar", tone: "blue" },
  pagado_parcial: { label: "Pago parcial", tone: "cyan" },
  pagado: { label: "Pagado", tone: "green" },
  anulado: { label: "Anulado", tone: "red" },
};

export const ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  solicitada: { label: "Solicitada", tone: "violet" },
  aprobada: { label: "Aprobada", tone: "green" },
  rechazada: { label: "Rechazada", tone: "red" },
  cerrada: { label: "Cerrada", tone: "gray" },
  anulada: { label: "Anulada", tone: "red" },
};

export const FUND_STATUS: Record<string, { label: string; tone: Tone }> = {
  pendiente: { label: "Pendiente", tone: "violet" },
  aprobada: { label: "Aprobada · por depositar", tone: "blue" },
  rechazada: { label: "Rechazada", tone: "red" },
  depositada: { label: "Depositada · por rendir", tone: "amber" },
  rendida: { label: "Rendida", tone: "green" },
};

export const VALUATION_STATUS: Record<string, { label: string; tone: Tone }> = {
  presentada: { label: "Presentada", tone: "violet" },
  aprobada: { label: "Aprobada · por facturar", tone: "blue" },
  facturada: { label: "Facturada · por cobrar", tone: "amber" },
  cobrada_parcial: { label: "Cobro parcial", tone: "cyan" },
  cobrada: { label: "Cobrada", tone: "green" },
  observada: { label: "Observada", tone: "red" },
};
