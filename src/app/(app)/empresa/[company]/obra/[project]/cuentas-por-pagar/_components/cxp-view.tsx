"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DonutChart, PeriodBars } from "@/components/charts";
import { Panel } from "@/components/ui/cont-kit";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge, Card, cn } from "@/components/ui/primitives";
import { DOC_TYPE_LABEL, date, docRef, money, pct } from "@/lib/format";

export type CxpRow = {
  id: string; seq: number; doc_type: string; series: string | null; doc_number: string | null; description: string; issue_date: string; due_date: string;
  supplier_id: string; supplier: string; ruc: string; wbs: string; payable: number; paid: number; balance: number; bucket: number; origin: string;
};
export type RetentionRow = { id: string; supplier: string; ruc: string; doc: string; issue_date: string; description: string; pct: number; amount: number; status: string; releasable: boolean };
type Meta = { filename: string; company: string; project: string; user: string };

const BUCKET_TONE = ["green", "amber", "amber", "red", "red"] as const;
const DONUT = ["#035AA6", "#0A9F4C", "#7C3AED", "#E07B00", "#0891B2", "#94A3B8"];

export function CxpView({ rows, retention, buckets, meta, base }: { rows: CxpRow[]; retention: RetentionRow[]; buckets: string[]; meta: Meta; base: string }) {
  const [tab, setTab] = useState<"proveedor" | "vencimiento" | "garantia">("proveedor");
  const [bucket, setBucket] = useState<number | null>(null);

  const byBucket = buckets.map((label, i) => ({ label, key: String(i), value: rows.filter((r) => r.bucket === i).reduce((s, r) => s + r.balance, 0) }));
  const filtered = bucket === null ? rows : rows.filter((r) => r.bucket === bucket);

  const bySupplier = useMemo(() => {
    const m = new Map<string, Record<string, number | string> & { supplier: string; ruc: string; docs: number; total: number }>();
    for (const r of filtered) {
      const x = m.get(r.supplier_id) ?? { id: r.supplier_id, supplier: r.supplier, ruc: r.ruc, docs: 0, total: 0, b0: 0, b1: 0, b2: 0, b3: 0, b4: 0, oldest: r.due_date };
      x.docs += 1;
      x.total += r.balance;
      x[`b${r.bucket}`] = (x[`b${r.bucket}`] as number) + r.balance;
      if (r.due_date < (x.oldest as string)) x.oldest = r.due_date;
      m.set(r.supplier_id, x);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [filtered]);

  const donut = useMemo(() => {
    const top = bySupplier.slice(0, 5).map((s, i) => ({ name: s.supplier, value: s.total, color: DONUT[i] }));
    const rest = bySupplier.slice(5).reduce((s, x) => s + x.total, 0);
    return rest > 0 ? [...top, { name: "Otros proveedores", value: rest, color: DONUT[5] }] : top;
  }, [bySupplier]);

  const supCols: Column<(typeof bySupplier)[number]>[] = [
    { key: "supplier", header: "Proveedor", cell: (r) => <div className="max-w-[260px]"><p className="truncate font-semibold text-ink">{r.supplier}</p><p className="text-[11px] text-ink-muted">RUC {r.ruc} · {r.docs} comprobantes</p></div> },
    ...buckets.map((b, i) => ({ key: `b${i}`, header: b, type: "money" as const, total: true, hideSm: i > 0 && i < 4, className: "whitespace-nowrap",
      cell: (r: (typeof bySupplier)[number]) => <span className={cn("num", Number(r[`b${i}`]) > 0 ? (i === 0 ? "text-ink" : i >= 3 ? "font-semibold text-danger" : "text-[#9a5200]") : "text-ink-muted/50")}>{money(r[`b${i}`])}</span> })),
    { key: "total", header: "Total", type: "money", total: true, className: "whitespace-nowrap", cell: (r) => <span className="num font-bold text-navy-900">{money(r.total)}</span> },
  ];

  const docCols: Column<CxpRow>[] = [
    { key: "due_date", header: "Vencimiento", type: "date", className: "whitespace-nowrap", cell: (r) => <div><p className="num font-semibold">{date(r.due_date)}</p><Badge tone={BUCKET_TONE[r.bucket]}>{buckets[r.bucket]}</Badge></div> },
    { key: "doc", header: "Comprobante", value: (r) => docRef(r), cell: (r) => <Link onClick={(e) => e.stopPropagation()} href={`${base}/gastos/${r.id}`} className="hover:text-brand-blue"><p className="num font-semibold">{docRef(r)}</p><p className="text-[11px] text-ink-muted">{DOC_TYPE_LABEL[r.doc_type]} · emitido {date(r.issue_date)}</p></Link> },
    { key: "supplier", header: "Proveedor", cell: (r) => <div className="max-w-[240px]"><p className="truncate font-medium">{r.supplier}</p><p className="truncate text-[11px] text-ink-muted">{r.description}</p></div> },
    { key: "wbs", header: "WBS", hideSm: true, cell: (r) => <span className="line-clamp-2 max-w-[180px] text-xs text-ink-soft">{r.wbs}</span> },
    { key: "payable", header: "Monto", type: "money", total: true, hideSm: true, className: "whitespace-nowrap" },
    { key: "paid", header: "Amortizado", type: "money", total: true, hideSm: true, className: "whitespace-nowrap" },
    { key: "balance", header: "Saldo", type: "money", total: true, className: "whitespace-nowrap", cell: (r) => <span className="num font-bold">{money(r.balance)}</span> },
  ];

  const retCols: Column<RetentionRow>[] = [
    { key: "issue_date", header: "Fecha", type: "date", cell: (r) => <span className="num">{date(r.issue_date)}</span> },
    { key: "supplier", header: "Subcontratista", cell: (r) => <div className="max-w-[260px]"><p className="truncate font-medium">{r.supplier}</p><p className="text-[11px] text-ink-muted">RUC {r.ruc}</p></div> },
    { key: "doc", header: "Comprobante" },
    { key: "description", header: "Concepto", hideSm: true, cell: (r) => <span className="line-clamp-2 max-w-[240px] text-xs">{r.description}</span> },
    { key: "pct", header: "%", type: "number", cell: (r) => <span className="num">{r.pct}%</span> },
    { key: "amount", header: "Retenido", type: "money", total: true, className: "whitespace-nowrap" },
    { key: "status", header: "Estado", cell: (r) => <Badge tone={r.releasable ? "green" : "amber"}>{r.status}</Badge> },
  ];

  const totalPending = rows.reduce((s, r) => s + r.balance, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Antigüedad de la deuda" subtitle="Saldo por tramo de vencimiento · clic en una barra para filtrar">
          <PeriodBars data={byBucket} name="Saldo" color="#035AA6" highlightLast={false} selected={bucket === null ? null : String(bucket)}
            onSelect={(k) => setBucket(bucket === Number(k) ? null : Number(k))} height={250} />
          <div className="mt-3 grid grid-cols-5 gap-1.5 text-center">
            {byBucket.map((b, i) => (
              <button key={b.label} onClick={() => setBucket(bucket === i ? null : i)}
                className={cn("rounded-xl px-1 py-2 transition", bucket === i ? "bg-navy-900 text-white" : "bg-slate-50 hover:bg-slate-100")}>
                <p className={cn("text-[10px] font-medium", bucket === i ? "text-white/70" : "text-ink-muted")}>{b.label}</p>
                <p className="num text-xs font-bold">{pct(totalPending ? b.value / totalPending : 0, 0)}</p>
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="Concentración por proveedor" subtitle={bucket === null ? "Top 5 por saldo pendiente" : `Tramo: ${buckets[bucket]}`}>
          {donut.length ? <DonutChart data={donut} centerLabel="Por pagar" height={210} /> : <p className="py-16 text-center text-sm text-ink-muted">Sin deuda pendiente.</p>}
        </Panel>
      </div>

      <div className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
        {([["proveedor", `Por proveedor (${bySupplier.length})`], ["vencimiento", `Por vencimiento (${filtered.length})`], ["garantia", `Fondo de garantía (${retention.length})`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cn("h-9 rounded-lg px-3.5 text-xs font-semibold transition", tab === k ? "bg-white text-navy-900 shadow-sm" : "text-ink-muted hover:text-ink")}>{l}</button>
        ))}
        {bucket !== null && <button onClick={() => setBucket(null)} className="h-9 rounded-lg px-3 text-xs font-semibold text-brand-blue">Quitar filtro “{buckets[bucket]}”</button>}
      </div>

      <Card>
        {tab === "proveedor" && (
          <DataTable rows={bySupplier} columns={supCols} searchPlaceholder="Proveedor o RUC…" initialSort={{ key: "total", dir: "desc" }}
            exportSheet={{ name: "CxP por proveedor", title: "Cuentas por pagar por proveedor", subtitle: "Saldo por tramo de antigüedad" }} exportMeta={meta} />
        )}
        {tab === "vencimiento" && (
          <DataTable rows={filtered} columns={docCols} searchPlaceholder="Comprobante, proveedor…" initialSort={{ key: "due_date", dir: "asc" }}
            rowClassName={(r) => (r.bucket >= 3 ? "bg-danger-50/30" : undefined)}
            exportSheet={{ name: "CxP por vencimiento", title: "Cuentas por pagar por vencimiento", subtitle: "Comprobantes aprobados con saldo" }} exportMeta={meta} />
        )}
        {tab === "garantia" && (
          <DataTable rows={retention} columns={retCols} searchPlaceholder="Subcontratista…" initialSort={{ key: "issue_date", dir: "desc" }}
            exportSheet={{ name: "Fondo de garantía", title: "Fondo de garantía retenido", subtitle: "Retenciones a subcontratistas · por devolver al cierre de la partida" }} exportMeta={meta}
            empty="No hay retenciones de fondo de garantía en esta obra." />
        )}
      </Card>
    </div>
  );
}
