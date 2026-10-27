"use client";
import { ArrowDownToLine, ArrowUpFromLine, Camera, MessageSquareQuote, RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Drawer } from "@/components/ui/dialog";
import { DateRangeFilter, FilterBar, UrlSelect, useUrlFilters } from "@/components/ui/filters";
import { FadeIn } from "@/components/ui/motion";
import { Badge, Card, PageHeader, cn } from "@/components/ui/primitives";
import { date, dateShort, money, number } from "@/lib/format";
import type { Material, Movement } from "../../_lib/data";
import { StockButtons, type FormCtx } from "../../_components/stock-forms";

type Row = Movement & { photo_url: string | null };
type Opt = { value: string; label: string };

const CHIPS = [
  { key: "alambre", label: "Alambre" }, { key: "clavo", label: "Clavos" }, { key: "madera", label: "Madera" },
  { key: "agua", label: "Agua" }, { key: "cemento", label: "Cemento" }, { key: "acero", label: "Acero" }, { key: "epp", label: "EPP" },
];

export function MovementsView({ rows, materials, materialName, keyword, range, filtersActive, options, canMove, meta, form }: {
  rows: Row[]; materials: Material[]; materialName: string | null; keyword: string | null; range: { desde: string | null; hasta: string | null };
  filtersActive: boolean; options: { materials: Opt[]; suppliers: Opt[]; wbs: Opt[]; phases: Opt[] }; canMove: boolean;
  meta: { companyName: string; projectLabel: string; userName: string }; form: FormCtx;
}) {
  const { set, params } = useUrlFilters();
  const [detail, setDetail] = useState<Row | null>(null);
  const unitOf = (id: string) => materials.find((m) => m.id === id)?.unit ?? "";
  const nameOf = (id: string) => materials.find((m) => m.id === id)?.name ?? "";
  const codeOf = (id: string) => materials.find((m) => m.id === id)?.code ?? "";

  const ins = rows.filter((r) => r.type === "ingreso");
  const outs = rows.filter((r) => r.type === "salida");
  const units = [...new Set(rows.map((r) => unitOf(r.material_id)))];
  const singleUnit = units.length === 1 ? units[0] : null;
  const qIn = ins.reduce((s, r) => s + r.qty, 0), cIn = ins.reduce((s, r) => s + r.total, 0);
  const qOut = outs.reduce((s, r) => s + r.qty, 0), cOut = outs.reduce((s, r) => s + r.total, 0);
  const wbsCount = new Set(outs.map((r) => r.wbs_id)).size;
  const supCount = new Set(ins.map((r) => r.supplier_id).filter(Boolean)).size;
  const subject = materialName ?? (keyword ? keyword.toLowerCase() : "materiales");
  const period = range.desde && range.hasta ? `entre el ${dateShort(range.desde)} y el ${dateShort(range.hasta)}` : range.desde ? `desde el ${dateShort(range.desde)}` : range.hasta ? `hasta el ${dateShort(range.hasta)}` : "en toda la obra";

  const cols: Column<Row & Record<string, unknown>>[] = [
    { key: "date", header: "Fecha", type: "date", value: (r) => r.date, cell: (r) => <span className="whitespace-nowrap text-ink-soft">{date(r.date)}</span> },
    { key: "type", header: "Tipo", value: (r) => (r.type === "ingreso" ? "Ingreso" : r.type === "salida" ? "Salida" : r.type),
      cell: (r) => r.type === "ingreso" ? <Badge tone="green">Ingreso</Badge> : r.type === "salida" ? <Badge tone="amber">Salida</Badge> : <Badge tone="gray">{r.type}</Badge> },
    { key: "material", header: "Material", className: "min-w-[220px]", value: (r) => `${codeOf(r.material_id)} ${nameOf(r.material_id)}`,
      cell: (r) => <span className="leading-tight"><span className="block font-semibold text-ink">{nameOf(r.material_id)}</span><span className="font-mono text-[11px] text-brand-blue">{codeOf(r.material_id)}</span></span> },
    { key: "qty", header: "Cantidad", type: "number", total: !!singleUnit, value: (r) => r.qty,
      cell: (r) => <span className={cn("whitespace-nowrap font-semibold", r.type === "salida" ? "text-[#9a5200]" : "text-brand-green-700")}>{r.type === "salida" ? "−" : "+"}{number(r.qty)} <span className="text-[11px] font-normal text-ink-muted">{unitOf(r.material_id)}</span></span> },
    { key: "unit_cost", header: "C. unit.", type: "money", value: (r) => r.unit_cost },
    { key: "total", header: "Importe", type: "money", total: true, value: (r) => r.total },
    { key: "origen", header: "Proveedor / destino", className: "min-w-[200px]", value: (r) => (r.type === "salida" ? `${r.wbs ?? ""} ${r.front ?? ""}` : `${r.supplier ?? ""} ${r.document_ref ?? ""}`),
      cell: (r) => r.type === "salida"
        ? <span className="leading-tight"><span className="block text-xs font-semibold text-ink">{r.wbs?.split(" · ")[0]}</span><span className="block max-w-[240px] truncate text-[11px] text-ink-muted">{r.wbs?.split(" · ")[1]} · {r.front ?? "—"}</span></span>
        : <span className="leading-tight"><span className="block max-w-[240px] truncate text-xs font-semibold text-ink">{r.supplier ?? "—"}</span><span className="text-[11px] text-ink-muted">{r.document_ref ?? ""}{r.order ? ` · ${r.order}` : ""}</span></span> },
    { key: "responsible", header: "Responsable", hideSm: true, value: (r) => r.responsible ?? "", cell: (r) => <span className="whitespace-nowrap text-xs text-ink-soft">{r.responsible ?? "—"}</span> },
    { key: "phase", header: "Fase", hideSm: true, value: (r) => r.phase ?? "", cell: (r) => r.phase ? <Badge tone="navy" dot={false}>{r.phase}</Badge> : "—" },
    { key: "photo", header: "", sortable: false, exportable: false, cell: (r) => r.photo_url ? <Camera className="h-4 w-4 text-brand-blue" aria-label="Con foto" /> : null },
  ];

  return (
    <div className="space-y-5">
      <PageHeader eyebrow={`${form.projectCode} · Almacén y logística`} title="Ingresos y salidas"
        description="Trazabilidad de cada material: quién lo recibió, a qué precio, de qué proveedor y a qué WBS y frente se cargó."
        actions={canMove ? <StockButtons ctx={form} /> : undefined} />

      <FilterBar className="flex-col items-stretch gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-bold text-navy-900"><Sparkles className="h-3.5 w-3.5 text-brand-green-600" />Fíltrame:</span>
          {CHIPS.map((c) => {
            const on = params.get("busca") === c.key;
            return (
              <button key={c.key} onClick={() => set({ busca: on ? null : c.key, material: null })}
                className={cn("h-8 rounded-full px-3.5 text-xs font-semibold transition", on ? "bg-navy-900 text-white shadow" : "bg-white text-ink-soft ring-1 ring-line hover:text-ink hover:ring-brand-blue/40")}>
                {c.label}
              </button>
            );
          })}
          {filtersActive && (
            <button onClick={() => set({ busca: null, material: null, tipo: null, proveedor: null, wbs: null, fase: null, desde: null, hasta: null })}
              className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-danger"><RotateCcw className="h-3.5 w-3.5" />Limpiar filtros</button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter />
          <UrlSelect name="tipo" placeholder="Ingresos y salidas" options={[{ value: "ingreso", label: "Solo ingresos" }, { value: "salida", label: "Solo salidas" }]} />
          <UrlSelect name="material" placeholder="Todos los materiales" options={options.materials} className="max-w-[230px]" />
          <UrlSelect name="proveedor" placeholder="Todos los proveedores" options={options.suppliers} className="max-w-[200px]" />
          <UrlSelect name="wbs" placeholder="Todos los WBS" options={options.wbs} className="max-w-[220px]" />
          <UrlSelect name="fase" placeholder="Fase" options={options.phases} />
        </div>
      </FilterBar>

      {filtersActive && rows.length > 0 && (
        <FadeIn>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy-900 to-brand-blue-700 p-5 text-white shadow-pop">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-green/20 blur-2xl" />
            <div className="relative flex gap-4">
              <span className="hidden h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15 sm:grid"><MessageSquareQuote className="h-5 w-5" /></span>
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-green">Respuesta</p>
                <p className="text-[15px] leading-relaxed sm:text-base">
                  {ins.length > 0 ? (
                    <>Entraron <b className="num">{singleUnit ? `${number(qIn)} ${singleUnit}` : `${ins.length} ingresos`}</b> de <b>{subject}</b> {period} por <b className="num">{money(cIn)}</b>
                      {singleUnit && qIn > 0 && <> a <b className="num">{money(cIn / qIn)}/{singleUnit}</b> promedio</>}, de {supCount} proveedor{supCount === 1 ? "" : "es"}.</>
                  ) : <>No hubo ingresos de <b>{subject}</b> {period}.</>}
                </p>
                {outs.length > 0 && (
                  <p className="text-sm text-white/80">
                    Salieron <b className="num text-white">{singleUnit ? `${number(qOut)} ${singleUnit}` : `${outs.length} despachos`}</b> valorizados en <b className="num text-white">{money(cOut)}</b>, cargados a {wbsCount} WBS.
                    {singleUnit && <> Saldo del periodo: <b className="num text-white">{number(qIn - qOut)} {singleUnit}</b>.</>}
                  </p>
                )}
              </div>
            </div>
          </div>
        </FadeIn>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { l: "Ingresos", v: money(cIn), s: `${ins.length} movimientos`, I: ArrowDownToLine, t: "text-brand-green-700 bg-ok-50" },
          { l: "Salidas valorizadas", v: money(cOut), s: `${outs.length} movimientos`, I: ArrowUpFromLine, t: "text-[#9a5200] bg-warn-50" },
          { l: "Diferencia (ingreso − salida)", v: money(cIn - cOut), s: singleUnit ? `${number(qIn - qOut)} ${singleUnit}` : "Mezcla de unidades", I: RotateCcw, t: "text-brand-blue bg-brand-blue-50" },
        ].map((k) => (
          <Card key={k.l} className="flex items-center gap-3 p-4">
            <span className={cn("grid h-10 w-10 place-items-center rounded-xl", k.t)}><k.I className="h-4 w-4" /></span>
            <div className="min-w-0"><p className="text-[11px] text-ink-muted">{k.l}</p><p className="num font-display text-lg font-semibold text-ink">{k.v}</p><p className="text-[11px] text-ink-muted">{k.s}</p></div>
          </Card>
        ))}
      </div>

      <Card>
        <DataTable rows={rows as (Row & Record<string, unknown>)[]} columns={cols} pageSize={20} dense onRowClick={(r) => setDetail(r)}
          searchPlaceholder="Buscar material, proveedor, guía, frente, responsable…"
          empty="No hay movimientos con estos filtros."
          exportSheet={{ name: "Movimientos", title: "Ingresos y salidas de almacén", subtitle: [materialName ?? keyword, range.desde && `desde ${date(range.desde)}`, range.hasta && `hasta ${date(range.hasta)}`].filter(Boolean).join(" · ") || "Todos los movimientos" }}
          exportMeta={{ filename: `Almacen_movimientos_${form.projectCode}`, company: meta.companyName, project: meta.projectLabel, user: meta.userName }} />
      </Card>

      <Drawer open={!!detail} onOpenChange={(o) => !o && setDetail(null)} title={detail ? `${detail.type === "ingreso" ? "Ingreso" : "Salida"} · ${nameOf(detail.material_id)}` : ""}
        description={detail ? `${date(detail.date)} · registrado ${new Date(detail.created_at).toLocaleString("es-PE")}` : undefined}>
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Cantidad", `${number(detail.qty)} ${unitOf(detail.material_id)}`], ["Costo unitario", money(detail.unit_cost)], ["Importe", money(detail.total)],
                ["Responsable", detail.responsible ?? "—"], detail.type === "ingreso" ? ["Proveedor", detail.supplier ?? "—"] : ["WBS", detail.wbs ?? "—"],
                detail.type === "ingreso" ? ["Guía / O/C", [detail.document_ref, detail.order].filter(Boolean).join(" · ") || "—"] : ["Frente", detail.front ?? "—"],
                ["Fase", detail.phase ?? "—"], ["Observaciones", detail.notes ?? "—"],
              ].map(([l, v]) => <div key={l} className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-ink-muted">{l}</p><p className="font-semibold text-ink">{v}</p></div>)}
            </div>
            {detail.photo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={detail.photo_url} alt="Foto de la guía o del material" className="w-full rounded-xl border border-line" />
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
