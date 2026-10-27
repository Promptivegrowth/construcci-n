"use client";
import { AlertOctagon, Camera, FileWarning, Link2, MapPin } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge, cn } from "@/components/ui/primitives";
import { EXPENSE_STATUS } from "@/lib/calc";
import { date, DOC_TYPE_LABEL, docRef, money } from "@/lib/format";

export type ExpenseRow = {
  id: string; seq: number; issue_date: string; due_date: string | null; doc_type: string; series: string | null; doc_number: string | null;
  description: string; category: string | null; currency: string; total: number; total_pen: number; cost_pen: number; payable_pen: number;
  paid_pen: number; balance: number; status: string; origin: string; exceeds_budget: boolean; supplier: string; ruc: string;
  wbs_code: string; wbs_name: string; phase: string; files: number; has_order: boolean;
};

export function ExpensesTable({ rows, base, meta }: { rows: ExpenseRow[]; base: string; meta: { company: string; project: string; user: string } }) {
  const columns: Column<ExpenseRow>[] = [
    
    { key: "issue_date", header: "Fecha", type: "date", value: (r) => r.issue_date, cell: (r) => <span className="num whitespace-nowrap text-xs">{date(r.issue_date)}</span> },
    {
      key: "doc", header: "Comprobante", value: (r) => `${DOC_TYPE_LABEL[r.doc_type]} ${docRef(r)}`,
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", r.files ? "bg-ok-50 text-brand-green-700" : r.doc_type === "PL" ? "bg-slate-100 text-ink-muted" : "bg-danger-50 text-danger")}
            title={r.files ? `${r.files} sustento(s) adjunto(s)` : r.doc_type === "PL" ? "Resumen de planilla" : "Sin sustento"}>
            {r.files ? <Camera className="h-4 w-4" /> : <FileWarning className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <p className="whitespace-nowrap text-[13px] font-semibold text-ink">{docRef(r)}</p>
            <p className="sr-only">N° {r.seq}</p>
            <p className="text-[11px] text-ink-muted">{DOC_TYPE_LABEL[r.doc_type]}{r.origin === "lima" ? " · Lima" : r.origin === "campo" ? " · Campo" : ""}</p>
          </div>
        </div>
      ),
    },
    {
      key: "supplier", header: "Proveedor / concepto", value: (r) => `${r.supplier} ${r.ruc} ${r.description}`,
      cell: (r) => (
        <div className="min-w-[200px] max-w-[280px]">
          <p className="truncate text-[13px] font-semibold text-ink">{r.supplier}</p>
          <p className="truncate text-xs text-ink-muted">{r.description}</p>
        </div>
      ),
    },
    {
      key: "wbs", header: "Fase · WBS", value: (r) => `${r.phase} ${r.wbs_code} ${r.wbs_name}`, hideSm: true,
      cell: (r) => (
        <div className="max-w-[170px]">
          <p className="text-xs font-semibold text-brand-blue">{r.phase} · {r.wbs_code}</p>
          <p className="truncate text-[11px] text-ink-muted">{r.wbs_name}</p>
        </div>
      ),
    },
    { key: "cost_pen", header: "Costo (sin IGV)", type: "money", total: true, value: (r) => r.cost_pen },
    { key: "paid_pen", header: "Pagado / a pagar", type: "money", total: true, value: (r) => r.paid_pen, hideSm: true,
      cell: (r) => (
        <span className="num block whitespace-nowrap">
          <span className={r.paid_pen >= r.payable_pen - 0.01 && r.payable_pen > 0 ? "font-semibold text-brand-green-700" : "font-semibold"}>{money(r.paid_pen)}</span>
          <span className="block text-[10px] text-ink-muted">de {money(r.payable_pen)}{r.currency === "USD" ? " · US$" : ""}</span>
        </span>
      ) },
    {
      key: "status", header: "Estado", value: (r) => EXPENSE_STATUS[r.status]?.label ?? r.status,
      cell: (r) => (
        <div className="flex flex-col items-start gap-1">
          <Badge tone={EXPENSE_STATUS[r.status]?.tone}>{EXPENSE_STATUS[r.status]?.label}</Badge>
          <div className="flex gap-1">
            {r.exceeds_budget && <span title="Deja el WBS en negativo: requiere aprobación de Gerencia" className="inline-flex items-center gap-0.5 rounded-md bg-danger-50 px-1.5 py-0.5 text-[10px] font-bold text-danger"><AlertOctagon className="h-3 w-3" />Excede WBS</span>}
            {r.has_order && <span title="Vinculado a O/S u O/C" className="inline-flex items-center gap-0.5 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft"><Link2 className="h-3 w-3" />Orden</span>}
            {r.origin === "campo" && <span title="Registrado desde la app de campo con GPS" className="inline-flex items-center rounded-md bg-cyan-50 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-800"><MapPin className="h-3 w-3" /></span>}
          </div>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowHref={(r) => `${base}/gastos/${r.id}`}
      searchPlaceholder="Buscar por número, proveedor, RUC, concepto…"
      exportSheet={{ name: "Gastos", title: "Registro de gastos y comprobantes", subtitle: `${rows.length} comprobantes` }}
      exportMeta={{ filename: `Gastos-${meta.project.split(" ")[0]}`, company: meta.company, project: meta.project, user: meta.user }}
      rowClassName={(r) => (r.status === "anulado" ? "opacity-50 line-through decoration-ink-muted/40" : undefined)}
      empty="No hay comprobantes con estos filtros."
      pageSize={20}
    />
  );
}
