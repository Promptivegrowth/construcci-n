"use client";
import { ArrowDownToLine, ArrowLeft, ArrowUpFromLine, Building2, Coins, PackageSearch, Pencil, Plus, Route } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { PeriodBars, SERIES } from "@/components/charts";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/dialog";
import { ExportMenu } from "@/components/ui/export-menu";
import { DateRangeFilter, FilterBar, UrlSelect } from "@/components/ui/filters";
import { CountUp, FadeIn, Stagger, StaggerItem } from "@/components/ui/motion";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Input, PageHeader, Select, Textarea, cn } from "@/components/ui/primitives";
import { date, money, monthLabel, number } from "@/lib/format";
import type { ExportSheet } from "@/lib/export/types";
import { saveMaterial, type MaterialInput } from "../actions";

export type CatalogRow = {
  id: string; code: string; name: string; unit: string; category: string; min_stock: number; description: string | null; active: boolean;
  stock: number; qtyIn: number; costIn: number; avg: number; projects: number; last: string | null;
};
export type TraceRow = {
  id: string; project_id: string; project: string; type: string; date: string; qty: number; unit_cost: number; total: number;
  supplier: string | null; wbs: string | null; front: string | null; document_ref: string | null; responsible: string | null;
};

const CATEGORIES: Record<string, string> = { consumibles: "Consumibles", materiales: "Materiales", epp: "EPP", herramientas: "Herramientas", acero: "Acero", madera: "Madera", agregados: "Agregados" };
const UNITS = ["kg", "und", "tabla", "pza", "caja", "bolsa", "varilla", "m", "m2", "m3", "gl", "rollo", "par", "lote"];

export function MaterialsView({ companyCode, catalog, selected, trace, projects, canManage, meta }: {
  companyCode: string; catalog: CatalogRow[]; selected: CatalogRow | null; trace: TraceRow[]; projects: { value: string; label: string }[];
  canManage: boolean; meta: { companyName: string; userName: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [edit, setEdit] = useState<CatalogRow | "new" | null>(null);
  const [cat, setCat] = useState("");
  const chartRef = useRef<HTMLDivElement>(null);

  const rows = catalog.filter((c) => !cat || c.category === cat);
  const cols: Column<CatalogRow & Record<string, unknown>>[] = [
    { key: "code", header: "Código", cell: (r) => <span className="font-mono text-xs font-semibold text-brand-blue">{r.code}</span> },
    { key: "name", header: "Material", className: "min-w-[240px]", cell: (r) => <span className="leading-tight"><span className="block font-semibold text-ink">{r.name}</span>{r.description && <span className="text-[11px] text-ink-muted">{r.description}</span>}</span> },
    { key: "category", header: "Categoría", value: (r) => CATEGORIES[r.category] ?? r.category, cell: (r) => <Badge tone="gray" dot={false}>{CATEGORIES[r.category] ?? r.category}</Badge> },
    { key: "unit", header: "Unidad" },
    { key: "min_stock", header: "Mínimo/obra", type: "number", hideSm: true, value: (r) => r.min_stock },
    { key: "stock", header: "Stock total", type: "number", value: (r) => r.stock, cell: (r) => <span className="whitespace-nowrap font-semibold text-ink">{number(r.stock)} <span className="text-[11px] font-normal text-ink-muted">{r.unit}</span></span> },
    { key: "avg", header: "Precio prom.", type: "money", value: (r) => r.avg },
    { key: "costIn", header: "Compras", type: "money", total: true, hideSm: true, value: (r) => r.costIn },
    { key: "projects", header: "Obras", type: "int", hideSm: true, value: (r) => r.projects },
    { key: "active", header: "Estado", value: (r) => (r.active ? "Activo" : "Inactivo"), cell: (r) => <Badge tone={r.active ? "green" : "gray"}>{r.active ? "Activo" : "Inactivo"}</Badge> },
    ...(canManage ? [{ key: "edit", header: "", sortable: false, exportable: false, cell: (r: CatalogRow) => (
      <button onClick={(e) => { e.stopPropagation(); setEdit(r); }} className="rounded-lg p-1.5 text-ink-muted hover:bg-line-soft hover:text-brand-blue" aria-label="Editar"><Pencil className="h-4 w-4" /></button>
    ) }] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`${meta.companyName} · Almacén y logística`} title={selected ? selected.name : "Catálogo de materiales"}
        description={selected ? `Trazabilidad del material en todas las obras: ingresos, precios, proveedores y destinos (WBS y frente). Código ${selected.code} · unidad ${selected.unit}.`
          : "Materiales e insumos de la empresa con código, unidad y categoría. Selecciona uno para ver su trazabilidad entre obras."}
        actions={selected
          ? <Button variant="outline" onClick={() => router.push(pathname)}><ArrowLeft className="h-4 w-4" />Volver al catálogo</Button>
          : canManage ? <Button onClick={() => setEdit("new")}><Plus className="h-4 w-4" />Nuevo material</Button> : undefined} />

      {selected ? (
        <Trace selected={selected} trace={trace} projects={projects} chartRef={chartRef} meta={meta} />
      ) : (
        <>
          <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { l: "Materiales en catálogo", v: catalog.length, s: `${catalog.filter((c) => c.active).length} activos`, I: PackageSearch, f: "int" as const, t: "bg-brand-blue-50 text-brand-blue" },
              { l: "Con movimiento en obras", v: catalog.filter((c) => c.qtyIn > 0).length, s: "Materiales con ingresos registrados", I: Route, f: "int" as const, t: "bg-ok-50 text-brand-green-700" },
              { l: "Compras acumuladas", v: catalog.reduce((s, c) => s + c.costIn, 0), s: "Ingresos valorizados en todas las obras", I: Coins, f: "money" as const, t: "bg-navy-900 text-white" },
              { l: "Categorías", v: new Set(catalog.map((c) => c.category)).size, s: Object.values(CATEGORIES).slice(0, 4).join(" · "), I: Building2, f: "int" as const, t: "bg-warn-50 text-[#9a5200]" },
            ].map((k) => (
              <StaggerItem key={k.l}>
                <Card className="h-full p-5">
                  <div className="flex items-start justify-between gap-2"><p className="text-xs font-medium text-ink-muted">{k.l}</p><span className={cn("grid h-9 w-9 place-items-center rounded-xl", k.t)}><k.I className="h-4 w-4" /></span></div>
                  <p className="mt-2 font-display text-2xl font-semibold"><CountUp value={k.v} format={k.f} /></p>
                  <p className="mt-1 truncate text-[11px] text-ink-muted">{k.s}</p>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>
          <Card>
            <CardHeader title="Materiales e insumos" subtitle="Haz clic en un material para ver ingresos, salidas y destinos en todas las obras"
              actions={<div className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
                {["", ...Object.keys(CATEGORIES)].map((c) => <button key={c || "all"} onClick={() => setCat(c)} className={cn("h-7 rounded-lg px-2.5 text-[11px] font-semibold", cat === c ? "bg-white text-navy-900 shadow-sm" : "text-ink-muted")}>{c ? CATEGORIES[c] : "Todos"}</button>)}
              </div>} />
            <div className="mt-3">
              {catalog.length ? (
                <DataTable rows={rows as (CatalogRow & Record<string, unknown>)[]} columns={cols} pageSize={20} dense rowHref={(r) => `${pathname}?material=${r.id}`}
                  searchPlaceholder="Buscar código o material…"
                  exportSheet={{ name: "Catalogo", title: "Catálogo de materiales", subtitle: meta.companyName }}
                  exportMeta={{ filename: `Catalogo_materiales_${companyCode}`, company: meta.companyName, user: meta.userName }} />
              ) : (
                <EmptyState className="m-4" icon={<PackageSearch className="h-6 w-6" />} title="Catálogo vacío" description="Agrega los materiales e insumos que compra la empresa."
                  action={canManage ? <Button onClick={() => setEdit("new")}><Plus className="h-4 w-4" />Nuevo material</Button> : undefined} />
              )}
            </div>
          </Card>
        </>
      )}

      {edit && <MaterialModal item={edit === "new" ? null : edit} onClose={() => setEdit(null)} companyCode={companyCode} />}
    </div>
  );
}

function Trace({ selected, trace, projects, chartRef, meta }: {
  selected: CatalogRow; trace: TraceRow[]; projects: { value: string; label: string }[]; chartRef: React.RefObject<HTMLDivElement | null>; meta: { companyName: string; userName: string };
}) {
  const ins = trace.filter((t) => t.type === "ingreso");
  const outs = trace.filter((t) => t.type === "salida");
  const qIn = ins.reduce((s, r) => s + r.qty, 0), cIn = ins.reduce((s, r) => s + r.total, 0);
  const qOut = outs.reduce((s, r) => s + r.qty, 0), cOut = outs.reduce((s, r) => s + r.total, 0);
  const u = selected.unit;

  const byProject = useMemo(() => {
    const m = new Map<string, { project: string; qIn: number; cIn: number; qOut: number; cOut: number; sups: Set<string> }>();
    trace.forEach((t) => {
      const r = m.get(t.project) ?? { project: t.project, qIn: 0, cIn: 0, qOut: 0, cOut: 0, sups: new Set<string>() };
      if (t.type === "ingreso") { r.qIn += t.qty; r.cIn += t.total; if (t.supplier) r.sups.add(t.supplier); }
      if (t.type === "salida") { r.qOut += t.qty; r.cOut += t.total; }
      m.set(t.project, r);
    });
    return [...m.values()].sort((a, b) => b.cIn - a.cIn);
  }, [trace]);
  const byMonth = useMemo(() => {
    const m = new Map<string, { qIn: number; cIn: number; qOut: number }>();
    trace.forEach((t) => {
      const k = t.date.slice(0, 7);
      const r = m.get(k) ?? { qIn: 0, cIn: 0, qOut: 0 };
      if (t.type === "ingreso") { r.qIn += t.qty; r.cIn += t.total; }
      if (t.type === "salida") r.qOut += t.qty;
      m.set(k, r);
    });
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({ k, ...v }));
  }, [trace]);

  const cols: Column<TraceRow & Record<string, unknown>>[] = [
    { key: "date", header: "Fecha", type: "date", cell: (r) => <span className="whitespace-nowrap text-ink-soft">{date(r.date)}</span> },
    { key: "project", header: "Obra", cell: (r) => <Badge tone="navy" dot={false}>{r.project}</Badge> },
    { key: "type", header: "Tipo", value: (r) => (r.type === "ingreso" ? "Ingreso" : "Salida"), cell: (r) => r.type === "ingreso" ? <Badge tone="green">Ingreso</Badge> : <Badge tone="amber">Salida</Badge> },
    { key: "qty", header: `Cantidad (${u})`, type: "number", value: (r) => r.qty, cell: (r) => <span className={cn("font-semibold", r.type === "salida" ? "text-[#9a5200]" : "text-brand-green-700")}>{r.type === "salida" ? "−" : "+"}{number(r.qty)}</span> },
    { key: "unit_cost", header: "Precio unit.", type: "money" },
    { key: "total", header: "Importe", type: "money" },
    { key: "dest", header: "Proveedor / destino", className: "min-w-[220px]", value: (r) => (r.type === "ingreso" ? r.supplier ?? "" : `${r.wbs ?? ""} · ${r.front ?? ""}`),
      cell: (r) => <span className="block max-w-[280px] truncate text-xs text-ink-soft">{r.type === "ingreso" ? `${r.supplier ?? "—"}${r.document_ref ? ` · ${r.document_ref}` : ""}` : `${r.wbs ?? "—"}${r.front ? ` · ${r.front}` : ""}`}</span> },
    { key: "responsible", header: "Responsable", hideSm: true, className: "whitespace-nowrap text-xs text-ink-soft", value: (r) => r.responsible ?? "" },
  ];

  const sheets = (): ExportSheet[] => [
    {
      name: "Trazabilidad", title: `Trazabilidad · ${selected.name}`, subtitle: `Código ${selected.code} · unidad ${u}`,
      summary: [
        { label: "Ingresó", value: `${number(qIn)} ${u}`, tone: "green" }, { label: "Compras", value: money(cIn), tone: "navy" },
        { label: "Precio promedio", value: qIn ? money(cIn / qIn) : "—", tone: "blue" }, { label: "Salió", value: `${number(qOut)} ${u}`, tone: "amber" },
      ],
      columns: [{ key: "project", header: "Obra" }, { key: "qIn", header: `Ingresos (${u})`, type: "number" }, { key: "cIn", header: "Compras", type: "money" }, { key: "avg", header: "Precio prom.", type: "money" },
        { key: "qOut", header: `Salidas (${u})`, type: "number" }, { key: "cOut", header: "Consumo valorizado", type: "money" }, { key: "sups", header: "Proveedores", width: 40 }],
      rows: byProject.map((p) => ({ project: p.project, qIn: p.qIn, cIn: p.cIn, avg: p.qIn ? p.cIn / p.qIn : 0, qOut: p.qOut, cOut: p.cOut, sups: [...p.sups].join(", ") })),
      totals: { project: "TOTAL", qIn, cIn, qOut, cOut },
    },
    {
      name: "Movimientos", title: `Movimientos · ${selected.name}`,
      columns: [{ key: "date", header: "Fecha", type: "date" }, { key: "project", header: "Obra" }, { key: "type", header: "Tipo" }, { key: "qty", header: "Cantidad", type: "number" }, { key: "unit_cost", header: "Precio", type: "money" },
        { key: "total", header: "Importe", type: "money" }, { key: "dest", header: "Proveedor / destino", width: 40 }, { key: "responsible", header: "Responsable" }],
      rows: trace.map((t) => ({ ...t, type: t.type === "ingreso" ? "Ingreso" : "Salida", dest: t.type === "ingreso" ? t.supplier : `${t.wbs ?? ""} · ${t.front ?? ""}` })),
    },
  ];

  return (
    <div className="space-y-6">
      <FilterBar>
        <DateRangeFilter />
        <UrlSelect name="obra" placeholder="Todas las obras" options={projects} />
        <div className="ml-auto"><ExportMenu build={sheets} meta={() => ({ filename: `Trazabilidad_${selected.code}`, company: meta.companyName, user: meta.userName, charts: [chartRef.current] })} /></div>
      </FilterBar>

      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { l: `Ingresó (${u})`, v: qIn, s: `${ins.length} ingresos · ${money(cIn)}`, I: ArrowDownToLine, t: "bg-ok-50 text-brand-green-700", f: "number" as const },
          { l: "Precio promedio", v: qIn ? cIn / qIn : 0, s: `por ${u} · ${new Set(ins.map((i) => i.supplier)).size} proveedores`, I: Coins, t: "bg-brand-blue-50 text-brand-blue", f: "money" as const },
          { l: `Salió (${u})`, v: qOut, s: `${outs.length} despachos · ${money(cOut)}`, I: ArrowUpFromLine, t: "bg-warn-50 text-[#9a5200]", f: "number" as const },
          { l: "Obras que lo usan", v: byProject.length, s: `Stock total ${number(selected.stock)} ${u}`, I: Building2, t: "bg-navy-900 text-white", f: "int" as const },
        ].map((k) => (
          <StaggerItem key={k.l}>
            <Card className="h-full p-5">
              <div className="flex items-start justify-between gap-2"><p className="text-xs font-medium text-ink-muted">{k.l}</p><span className={cn("grid h-9 w-9 place-items-center rounded-xl", k.t)}><k.I className="h-4 w-4" /></span></div>
              <p className="mt-2 font-display text-2xl font-semibold"><CountUp value={k.v} format={k.f} /></p>
              <p className="mt-1 text-[11px] text-ink-muted">{k.s}</p>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>

      {!trace.length ? (
        <EmptyState icon={<Route className="h-6 w-6" />} title="Sin movimientos en el periodo" description="Ajusta el rango de fechas o la obra para ver ingresos y salidas de este material." />
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-5">
            <FadeIn className="xl:col-span-3">
              <Card className="h-full">
                <CardHeader title="Compras por mes" subtitle={`Importe comprado (S/) · cantidad en ${u} en el detalle`} />
                <CardBody>
                  <div ref={chartRef} className="bg-white"><PeriodBars data={byMonth.map((m) => ({ label: monthLabel(m.k), key: m.k, value: m.cIn }))} color={SERIES.proyectado} name="Compras" /></div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {byMonth.slice(-6).map((m) => <span key={m.k} className="rounded-lg bg-slate-50 px-2.5 py-1 text-[11px] text-ink-soft"><b className="text-ink">{monthLabel(m.k)}</b> · entró {number(m.qIn)} {u} · salió {number(m.qOut)} {u}</span>)}
                  </div>
                </CardBody>
              </Card>
            </FadeIn>
            <FadeIn delay={0.06} className="xl:col-span-2">
              <Card className="h-full">
                <CardHeader title="Resumen por obra" subtitle="Cantidad, costo y precio promedio" />
                <CardBody className="space-y-3">
                  {byProject.map((p) => {
                    const share = cIn ? p.cIn / cIn : 0;
                    return (
                      <div key={p.project} className="rounded-xl border border-line-soft p-3">
                        <div className="flex items-center justify-between gap-2">
                          <Badge tone="navy" dot={false}>{p.project}</Badge>
                          <span className="num text-sm font-semibold text-ink">{money(p.cIn)}</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-blue" style={{ width: `${share * 100}%` }} /></div>
                        <p className="mt-2 text-[11px] text-ink-muted">Entró {number(p.qIn)} {u} a {money(p.qIn ? p.cIn / p.qIn : 0)} prom. · salió {number(p.qOut)} {u} · saldo {number(p.qIn - p.qOut)} {u}</p>
                      </div>
                    );
                  })}
                </CardBody>
              </Card>
            </FadeIn>
          </div>
          <Card>
            <CardHeader title="Movimientos del material" subtitle="Cada ingreso con su proveedor y cada salida con su WBS y frente" />
            <div className="mt-3">
              <DataTable rows={trace as (TraceRow & Record<string, unknown>)[]} columns={cols} pageSize={20} dense searchPlaceholder="Buscar proveedor, WBS, frente, obra…" />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function MaterialModal({ item, onClose, companyCode }: { item: CatalogRow | null; onClose: () => void; companyCode: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState<MaterialInput>({
    id: item?.id, code: item?.code ?? "", name: item?.name ?? "", unit: item?.unit ?? "und", category: item?.category ?? "materiales",
    min_stock: item?.min_stock ?? 0, description: item?.description ?? "", active: item?.active ?? true,
  });
  const up = (p: Partial<MaterialInput>) => setF({ ...f, ...p });
  const submit = () => start(async () => {
    const res = await saveMaterial(companyCode, f);
    if (!res.ok) return void toast.error("No se guardó el material", { description: res.error });
    toast.success(res.message ?? "Guardado", { description: `${f.code.toUpperCase()} · ${f.name}` });
    onClose();
    router.refresh();
  });
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={item ? `Editar ${item.code}` : "Nuevo material"} description="Código, unidad de medida y categoría del catálogo de la empresa."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={submit} disabled={pending}>{pending ? "Guardando…" : "Guardar"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Código" required><Input value={f.code} onChange={(e) => up({ code: e.target.value })} placeholder="CLA-030" /></Field>
        <Field label="Categoría" required><Select value={f.category} onChange={(e) => up({ category: e.target.value })}>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Nombre" required className="sm:col-span-2"><Input value={f.name} onChange={(e) => up({ name: e.target.value })} placeholder='Clavo para madera 3"' /></Field>
        <Field label="Unidad de medida" required><Select value={f.unit} onChange={(e) => up({ unit: e.target.value })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</Select></Field>
        <Field label="Stock mínimo por obra" hint="Genera alerta de stock crítico"><Input inputMode="decimal" value={f.min_stock} onChange={(e) => up({ min_stock: Number(e.target.value) || 0 })} /></Field>
        <Field label="Descripción" className="sm:col-span-2"><Textarea value={f.description} onChange={(e) => up({ description: e.target.value })} className="min-h-[60px]" /></Field>
        <label className="flex items-center gap-2 text-sm text-ink-soft sm:col-span-2"><input type="checkbox" checked={f.active} onChange={(e) => up({ active: e.target.checked })} className="h-4 w-4 accent-brand-blue" />Material activo (disponible para registrar movimientos)</label>
      </div>
    </Modal>
  );
}
