const pen = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pen0 = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 0 });

export const toNum = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number(v));

/** S/ 1,234.56 */
export function money(v: unknown, opts: { decimals?: boolean } = {}) {
  return (opts.decimals === false ? pen0 : pen).format(toNum(v)).replace(/ /g, " ");
}

/** S/ 1.25 M · S/ 845 k */
export function moneyShort(v: unknown) {
  const n = toNum(v);
  const a = Math.abs(n);
  if (a >= 1_000_000) return `S/ ${(n / 1_000_000).toLocaleString("es-PE", { maximumFractionDigits: 2 })} M`;
  if (a >= 10_000) return `S/ ${(n / 1000).toLocaleString("es-PE", { maximumFractionDigits: 0 })} k`;
  return money(n, { decimals: a < 1000 });
}

export function number(v: unknown, decimals = 2) {
  return toNum(v).toLocaleString("es-PE", { maximumFractionDigits: decimals });
}

export function pct(v: number, decimals = 1) {
  if (!Number.isFinite(v)) return "—";
  return `${(v * 100).toLocaleString("es-PE", { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}%`;
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];
const MONTHS_LONG = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre"];

function parse(d: string | Date | null | undefined) {
  if (!d) return null;
  if (d instanceof Date) return d;
  return new Date(d.length === 10 ? `${d}T12:00:00` : d);
}

/** 27/10/2026 */
export function date(d: string | Date | null | undefined) {
  const x = parse(d);
  if (!x) return "—";
  return `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}/${x.getFullYear()}`;
}
/** 27 oct 2026 */
export function dateShort(d: string | Date | null | undefined) {
  const x = parse(d);
  if (!x) return "—";
  return `${x.getDate()} ${MONTHS[x.getMonth()]} ${x.getFullYear()}`;
}
/** 27 de octubre de 2026 */
export function dateLong(d: string | Date | null | undefined) {
  const x = parse(d);
  if (!x) return "—";
  return `${x.getDate()} de ${MONTHS_LONG[x.getMonth()]} de ${x.getFullYear()}`;
}
export function dateTime(d: string | Date | null | undefined) {
  const x = parse(d);
  if (!x) return "—";
  return `${date(x)} ${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
}
export function time(d: string | Date | null | undefined) {
  const x = parse(d);
  if (!x) return "—";
  return `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
}
export const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[m - 1]} ${String(y).slice(2)}`;
};
export const monthLong = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS_LONG[m - 1][0].toUpperCase()}${MONTHS_LONG[m - 1].slice(1)} ${y}`;
};

export function timeAgo(d: string | Date | null | undefined) {
  const x = parse(d);
  if (!x) return "—";
  const s = Math.round((Date.now() - x.getTime()) / 1000);
  if (s < 60) return "hace un momento";
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const days = Math.round(h / 24);
  if (days < 30) return `hace ${days} d`;
  return dateShort(x);
}

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const addDaysISO = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const initials = (name?: string | null) =>
  (name ?? "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

export const DOC_TYPE_LABEL: Record<string, string> = {
  FT: "Factura", BV: "Boleta", RH: "Recibo por honorarios", TK: "Ticket", PL: "Planilla", OT: "Otro",
};
export const docRef = (e: { doc_type: string; series?: string | null; doc_number?: string | null }) =>
  e.doc_type === "PL" ? e.doc_number ?? "Planilla" : [e.series, e.doc_number].filter(Boolean).join("-") || "S/N";
