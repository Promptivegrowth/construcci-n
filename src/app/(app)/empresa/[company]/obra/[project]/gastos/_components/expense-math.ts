// Mismas reglas que el trigger expense_before_write: solo la factura gravada separa IGV;
// boletas, recibos, tickets y otros se cargan por su importe total.
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type ExpenseMathInput = {
  docType: string; tax: string; total: number; currency: string; tc: number; retentionPct: number;
};

export function computeExpense({ docType, tax, total, currency, tc, retentionPct }: ExpenseMathInput) {
  const rate = currency === "USD" ? (tc > 0 ? tc : 3.75) : 1;
  const t = Number.isFinite(total) ? total : 0;
  let subtotal = t, igv = 0;
  if (docType === "FT" && tax === "gravado") {
    subtotal = r2(t / 1.18);
    igv = r2(t - subtotal);
  }
  const totalPen = r2(t * rate);
  const cost = r2(subtotal * rate);
  const retention = r2((totalPen * (retentionPct || 0)) / 100);
  return { rate, subtotal, igv, totalPen, cost, retention, payable: r2(totalPen - retention) };
}

export { r2 };
