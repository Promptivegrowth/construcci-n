"use client";
import { ExportMenu } from "@/components/ui/export-menu";
import { money, pct } from "@/lib/format";

type Row = { code: string; name: string; status: string; contract: number; budget: number; declared: number; paid: number; committed: number; saldo: number; pct: number; plazo: number };

export function CompanyExport({ rows, company, user }: { rows: Row[]; company: string; user: string }) {
  const sum = (k: keyof Row) => rows.reduce((s, r) => s + Number(r[k]), 0);
  return (
    <ExportMenu
      meta={() => ({ filename: `Obras_${company.replace(/\s+/g, "_")}`, company, user, charts: [] })}
      build={() => [{
        name: "Obras", title: "Resumen de obras", subtitle: "Presupuesto, pagado y saldo por obra",
        summary: [
          { label: "Contratado", value: money(sum("contract")), tone: "navy" },
          { label: "Presupuesto", value: money(sum("budget")), tone: "blue" },
          { label: "Pagado", value: money(sum("paid")), tone: "green" },
          { label: "Consumo", value: pct(sum("paid") / (sum("budget") || 1)), tone: "amber" },
        ],
        columns: [
          { key: "code", header: "Código", width: 11 }, { key: "name", header: "Obra", width: 46 }, { key: "status", header: "Estado", width: 14 },
          { key: "contract", header: "Contrato", type: "money" }, { key: "budget", header: "Presupuesto", type: "money" }, { key: "declared", header: "Declarado obra", type: "money" },
          { key: "paid", header: "Pagado", type: "money" }, { key: "committed", header: "Comprometido", type: "money" }, { key: "saldo", header: "Saldo", type: "money" },
          { key: "pct", header: "% consumo", type: "pct" }, { key: "plazo", header: "% plazo", type: "pct" },
        ],
        rows,
        totals: { contract: sum("contract"), budget: sum("budget"), declared: sum("declared"), paid: sum("paid"), committed: sum("committed"), saldo: sum("saldo") },
      }]}
    />
  );
}
