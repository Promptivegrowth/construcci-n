import type { Metadata } from "next";
import { ClipboardCheck, ClipboardList, Hourglass, Plus, ReceiptText } from "lucide-react";
import { KpiCard } from "@/components/ui/adm-kpi";
import { FilterBar, UrlSegment, UrlSelect } from "@/components/ui/filters";
import { Stagger, StaggerItem } from "@/components/ui/motion";
import { ButtonLink, Card, PageHeader } from "@/components/ui/primitives";
import { ORDER_STATUS } from "@/lib/calc";
import { toNum } from "@/lib/format";
import { can } from "@/lib/permissions";
import { getProjectContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { OrdersTable, type OrderRow } from "./orders-table";

export const metadata: Metadata = { title: "Órdenes de servicio y compra" };

export default async function OrdenesPage({ params, searchParams }: { params: Promise<{ company: string; project: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { company, project } = await params;
  const sp = await searchParams;
  const ctx = await getProjectContext(company, project);
  const sb = await supabaseServer();
  const pid = ctx.project.id;
  const base = `/empresa/${company}/obra/${project}`;

  const [{ data: orders }, { data: bal }] = await Promise.all([
    sb.from("orders").select("id, order_type, number, title, total, subtotal_pen, billing_frequency, start_date, end_date, status, created_at, supplier:suppliers(name, ruc), wbs:wbs_nodes(code, name)").eq("project_id", pid).order("created_at", { ascending: false }),
    sb.from("v_order_balance").select("order_id, invoiced_pen, paid_pen, invoices").eq("project_id", pid),
  ]);
  const b = new Map((bal ?? []).map((x) => [x.order_id, x]));
  const all: OrderRow[] = (orders ?? []).map((o) => {
    const x = b.get(o.id);
    const s = o.supplier as unknown as { name: string; ruc: string } | null;
    const w = o.wbs as unknown as { code: string; name: string } | null;
    const amount = toNum(o.subtotal_pen);
    const invoiced = toNum(x?.invoiced_pen);
    return {
      id: o.id, order_type: o.order_type, number: o.number ?? "", title: o.title, supplier: s?.name ?? "—", ruc: s?.ruc ?? "", wbs: w ? `${w.code} · ${w.name}` : "—",
      billing_frequency: o.billing_frequency, start_date: o.start_date, end_date: o.end_date, status: o.status, amount, total: toNum(o.total), invoiced, paid: toNum(x?.paid_pen),
      invoices: Number(x?.invoices ?? 0), committed: o.status === "aprobada" ? Math.max(0, amount - invoiced) : 0,
    };
  });
  const kpi = {
    vigentes: all.filter((o) => o.status === "aprobada").reduce((s, o) => s + o.amount, 0),
    invoiced: all.filter((o) => o.status !== "anulada").reduce((s, o) => s + o.invoiced, 0),
    committed: all.reduce((s, o) => s + o.committed, 0),
    pending: all.filter((o) => o.status === "solicitada").length,
  };
  const rows = all.filter((o) => (!sp.tipo || o.order_type === sp.tipo) && (!sp.estado || o.status === sp.estado));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`${ctx.project.code} · Administración`} title="Órdenes de servicio y de compra"
        description="O/S para alquileres y servicios (equipos menores, estación total, internet, laptops, transporte) y O/C para materiales, EPP e insumos. Cada factura descuenta el saldo de su orden; lo no facturado es presupuesto comprometido."
        actions={can(ctx.role, "requestOrder") && ctx.project.status !== "cerrada" ? <ButtonLink href={`${base}/ordenes/nueva`}><Plus className="h-4 w-4" />{can(ctx.role, "approveOrder") ? "Emitir orden" : "Solicitar orden"}</ButtonLink> : null} />
      <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StaggerItem><KpiCard label="Órdenes vigentes (sin IGV)" value={kpi.vigentes} format="moneyShort" icon={<ClipboardList className="h-4 w-4" />} tone="navy" sub={`${all.filter((o) => o.status === "aprobada").length} aprobadas`} /></StaggerItem>
        <StaggerItem><KpiCard label="Facturado contra órdenes" value={kpi.invoiced} format="moneyShort" icon={<ReceiptText className="h-4 w-4" />} tone="green" sub={`${all.reduce((s, o) => s + o.invoices, 0)} comprobantes`} /></StaggerItem>
        <StaggerItem><KpiCard label="Comprometido" value={kpi.committed} format="moneyShort" icon={<ClipboardCheck className="h-4 w-4" />} tone="amber" sub="Emitido aún no facturado" /></StaggerItem>
        <StaggerItem><KpiCard label="Solicitudes por aprobar" value={kpi.pending} format="int" icon={<Hourglass className="h-4 w-4" />} tone="violet" sub="Requieren visto de Gerencia" /></StaggerItem>
      </Stagger>
      <FilterBar>
        <UrlSegment name="tipo" options={[{ value: "", label: "Todas", count: all.length }, { value: "OS", label: "Servicio (O/S)", count: all.filter((o) => o.order_type === "OS").length }, { value: "OC", label: "Compra (O/C)", count: all.filter((o) => o.order_type === "OC").length }]} />
        <UrlSelect name="estado" placeholder="Todos los estados" options={Object.entries(ORDER_STATUS).map(([v, s]) => ({ value: v, label: s.label }))} />
      </FilterBar>
      <Card className="overflow-hidden">
        <OrdersTable rows={rows} base={base} meta={{ company: ctx.company.name, project: `${ctx.project.code} · ${ctx.project.name}`, user: ctx.profile.full_name }} />
      </Card>
    </div>
  );
}
