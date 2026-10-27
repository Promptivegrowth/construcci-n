"use client";
import { History } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { Badge, Card, CardHeader } from "@/components/ui/primitives";
import { dateTime, money } from "@/lib/format";

type Change = { id: string; type: string; amount: number; prev: number; next: number; reason: string | null; at: string; wbs: { code: string; name: string } | null; author: string };

const TONE = { importacion: "blue", adicional: "green", deductivo: "red", reasignacion: "violet", ajuste: "gray" } as const;
const LABEL: Record<string, string> = { importacion: "Importación", adicional: "Adicional", deductivo: "Deductivo", reasignacion: "Reasignación", ajuste: "Ajuste" };

export function BudgetChanges({ changes }: { changes: Change[] }) {
  return (
    <Card>
      <CardHeader title="Versiones del presupuesto" subtitle="Importaciones, adicionales y deductivos con autor, fecha y motivo" icon={<History className="h-4 w-4" />} />
      <div className="mt-3">
        <DataTable<Change & Record<string, unknown>> rows={changes as (Change & Record<string, unknown>)[]} pageSize={8} searchPlaceholder="Buscar WBS, motivo, autor…"
          initialSort={{ key: "at", dir: "desc" }}
          exportSheet={{ name: "Versiones", title: "Historial de cambios de presupuesto" }}
          columns={[
            { key: "at", header: "Fecha", value: (r) => r.at, cell: (r) => <span className="whitespace-nowrap text-xs">{dateTime(r.at)}</span>, type: "date" },
            { key: "wbs", header: "WBS", value: (r) => `${r.wbs?.code ?? ""} ${r.wbs?.name ?? ""}`, cell: (r) => <span className="text-[13px]"><b>{r.wbs?.code}</b> · {r.wbs?.name}</span> },
            { key: "type", header: "Tipo", value: (r) => LABEL[r.type] ?? r.type, cell: (r) => <Badge tone={TONE[r.type as keyof typeof TONE] ?? "gray"}>{LABEL[r.type] ?? r.type}</Badge> },
            { key: "amount", header: "Monto", type: "money", value: (r) => r.amount, cell: (r) => <span className={r.amount < 0 ? "text-danger" : "text-ink"}>{money(r.amount)}</span> },
            { key: "next", header: "Nuevo presupuesto", type: "money", value: (r) => r.next, hideSm: true },
            { key: "reason", header: "Motivo", value: (r) => r.reason ?? "", cell: (r) => <span className="line-clamp-2 text-xs text-ink-soft">{r.reason}</span>, hideSm: true },
            { key: "author", header: "Autor", value: (r) => r.author, hideSm: true },
          ]} />
      </div>
    </Card>
  );
}
