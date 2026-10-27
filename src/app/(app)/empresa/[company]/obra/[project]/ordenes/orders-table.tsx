"use client";
import { BatteryBar } from "@/components/ui/battery";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/primitives";
import { ORDER_STATUS } from "@/lib/calc";
import { money } from "@/lib/format";
import { FREQ_LABEL } from "./labels";

export type OrderRow = {
  id: string; order_type: string; number: string; title: string; supplier: string; ruc: string; wbs: string; billing_frequency: string;
  start_date: string | null; end_date: string | null; status: string; amount: number; total: number; invoiced: number; paid: number; invoices: number; committed: number;
};


export function OrdersTable({ rows, base, meta }: { rows: OrderRow[]; base: string; meta: { company: string; project: string; user: string } }) {
  const columns: Column<OrderRow>[] = [
    {
      key: "number", header: "Orden", value: (r) => r.number,
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <span className={r.order_type === "OS" ? "grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-blue-50 text-[11px] font-bold text-brand-blue" : "grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ok-50 text-[11px] font-bold text-brand-green-700"}>{r.order_type}</span>
          <div><p className="whitespace-nowrap text-[13px] font-semibold">{r.number}</p><p className="text-[11px] text-ink-muted">{FREQ_LABEL[r.billing_frequency]}</p></div>
        </div>
      ),
    },
    { key: "title", header: "Objeto / proveedor", value: (r) => `${r.title} ${r.supplier} ${r.ruc}`,
      cell: (r) => <div className="min-w-[220px] max-w-[320px]"><p className="truncate text-[13px] font-semibold text-ink">{r.title}</p><p className="truncate text-xs text-ink-muted">{r.supplier}</p></div> },
    { key: "wbs", header: "WBS", value: (r) => r.wbs, hideSm: true, cell: (r) => <p className="max-w-[170px] truncate text-xs text-brand-blue">{r.wbs}</p> },
    { key: "amount", header: "Monto (sin IGV)", type: "money", total: true, value: (r) => r.amount },
    { key: "invoiced", header: "Facturado", type: "money", total: true, value: (r) => r.invoiced, hideSm: true },
    { key: "committed", header: "Comprometido", type: "money", total: true, value: (r) => r.committed, hideSm: true },
    { key: "consumo", header: "Consumo", sortable: false, exportable: false, value: (r) => (r.amount ? r.invoiced / r.amount : 0),
      cell: (r) => <div className="w-36"><BatteryBar value={r.invoiced} total={r.amount} size="sm" threshold={0.9} label={`${r.invoices} fact.`} /></div> },
    { key: "status", header: "Estado", value: (r) => ORDER_STATUS[r.status]?.label ?? r.status, cell: (r) => <Badge tone={ORDER_STATUS[r.status]?.tone}>{ORDER_STATUS[r.status]?.label}</Badge> },
  ];
  return (
    <DataTable rows={rows} columns={columns} rowHref={(r) => `${base}/ordenes/${r.id}`} searchPlaceholder="Buscar orden, proveedor, objeto…"
      exportSheet={{ name: "Órdenes", title: "Órdenes de servicio y de compra", subtitle: `${rows.length} órdenes` }}
      exportMeta={{ filename: `Ordenes-${meta.project.split(" ")[0]}`, company: meta.company, project: meta.project, user: meta.user }}
      rowClassName={(r) => (r.status === "anulada" || r.status === "rechazada" ? "opacity-55" : undefined)}
      empty="No hay órdenes registradas con estos filtros." />
  );
}
