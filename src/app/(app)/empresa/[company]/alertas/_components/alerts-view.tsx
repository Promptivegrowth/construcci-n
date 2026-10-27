"use client";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, ArrowUpRight, BatteryWarning, CalendarClock, CheckCheck, CircleCheck, ClipboardX, FileWarning, Gauge, Info,
  LoaderCircle, OctagonAlert, PackageX, RefreshCw, RotateCcw, Scale, type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ExportMenu } from "@/components/ui/export-menu";
import { DateRangeFilter, FilterBar, UrlSegment, UrlSelect } from "@/components/ui/filters";
import { CountUp } from "@/components/ui/motion";
import { Badge, Button, Card, EmptyState, cn } from "@/components/ui/primitives";
import { dateTime, timeAgo } from "@/lib/format";
import { refreshAlerts, resolveAlert } from "../actions";

export type AlertRow = {
  id: string; alert_type: string; severity: string; title: string; message: string | null; entity_type: string | null; entity_id: string | null;
  resolved: boolean; resolved_at: string | null; created_at: string; project_code: string | null; project_name: string | null; resolver: string | null;
};

export const ALERT_TYPES: Record<string, { label: string; Icon: LucideIcon }> = {
  consumo_80: { label: "Consumo sobre el umbral", Icon: BatteryWarning },
  sobrecosto: { label: "Sobrecosto", Icon: OctagonAlert },
  ritmo: { label: "Ritmo de gasto", Icon: Gauge },
  diferencia: { label: "Diferencias Obra vs. Contabilidad", Icon: Scale },
  documento: { label: "Documento por vencer", Icon: FileWarning },
  vencimiento: { label: "Comprobante por vencer", Icon: CalendarClock },
  orden_excedida: { label: "Orden excedida", Icon: ClipboardX },
  stock: { label: "Stock crítico", Icon: PackageX },
  fondos: { label: "Fondos por rendir", Icon: Info },
};

const SEV: Record<string, { label: string; tone: "red" | "amber" | "blue"; ring: string; dot: string; Icon: LucideIcon }> = {
  danger: { label: "Peligro", tone: "red", ring: "border-l-danger-500", dot: "bg-danger-500", Icon: OctagonAlert },
  warning: { label: "Alerta", tone: "amber", ring: "border-l-warn-500", dot: "bg-warn-500", Icon: AlertTriangle },
  info: { label: "Aviso", tone: "blue", ring: "border-l-brand-blue", dot: "bg-brand-blue", Icon: Info },
};

function entityHref(companyCode: string, a: AlertRow) {
  const obra = a.project_code ? `/empresa/${companyCode}/obra/${a.project_code}` : `/empresa/${companyCode}`;
  switch (a.entity_type) {
    case "wbs": return a.entity_id ? `${obra}/presupuesto/${a.entity_id}` : `${obra}/presupuesto`;
    case "expense": return a.entity_id ? `${obra}/gastos/${a.entity_id}` : `${obra}/gastos`;
    case "document": return `${obra}/configuracion?tab=documentos`;
    case "material": return a.entity_id ? `/empresa/${companyCode}/materiales?material=${a.entity_id}` : `${obra}/almacen`;
    case "stock": return `${obra}/almacen`;
    case "order": return a.entity_id ? `${obra}/ordenes/${a.entity_id}` : `${obra}/ordenes`;
    case "fund": return `${obra}/caja`;
    default: return obra;
  }
}

export function AlertsView({ rows, stats, companyCode, companyName, userName, projects, canResolve }: {
  rows: AlertRow[]; stats: { danger: number; warning: number; info: number; resolved: number };
  companyCode: string; companyName: string; userName: string; projects: { value: string; label: string }[]; canResolve: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, start] = useTransition();

  const toggle = async (a: AlertRow) => {
    setBusy(a.id);
    const r = await resolveAlert(companyCode, a.id, !a.resolved);
    setBusy(null);
    if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error("No se pudo actualizar", { description: r.error });
  };
  const recalc = () => start(async () => {
    const t = toast.loading("Recalculando semáforos de todas las obras…");
    const r = await refreshAlerts(companyCode);
    if (r.ok) { toast.success(r.message, { id: t, description: `${r.data?.count ?? 0} condiciones evaluadas` }); router.refresh(); }
    else toast.error("No se pudo recalcular", { id: t, description: r.error });
  });

  const tiles = [
    { k: "Peligro", v: stats.danger, c: "text-danger", bg: "bg-danger-50", Icon: OctagonAlert, sev: "danger" },
    { k: "Alertas", v: stats.warning, c: "text-[#9a5200]", bg: "bg-warn-50", Icon: AlertTriangle, sev: "warning" },
    { k: "Avisos", v: stats.info, c: "text-brand-blue", bg: "bg-brand-blue-50", Icon: Info, sev: "info" },
    { k: "Resueltas", v: stats.resolved, c: "text-brand-green-700", bg: "bg-ok-50", Icon: CircleCheck, sev: null },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t, i) => (
          <motion.div key={t.k} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Card className="flex items-center gap-4 p-4">
              <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", t.bg, t.c)}><t.Icon className="h-5 w-5" /></span>
              <div>
                <p className="text-xs font-medium text-ink-muted">{t.k}</p>
                <p className={cn("font-display text-2xl font-semibold", t.c)}><CountUp value={t.v} format="int" /></p>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <FilterBar>
        <UrlSegment name="estado" options={[{ value: "activas", label: "Activas" }, { value: "resueltas", label: "Resueltas" }, { value: "todas", label: "Todas" }]} />
        <UrlSelect name="tipo" placeholder="Todos los tipos" options={Object.entries(ALERT_TYPES).map(([value, t]) => ({ value, label: t.label }))} />
        <UrlSelect name="sev" placeholder="Toda severidad" options={[{ value: "danger", label: "Peligro" }, { value: "warning", label: "Alerta" }, { value: "info", label: "Aviso" }]} />
        <UrlSelect name="obra" placeholder="Todas las obras" options={projects} />
        <DateRangeFilter />
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={recalc} disabled={refreshing}>
            {refreshing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Recalcular
          </Button>
          <ExportMenu size="sm"
            meta={{ filename: `alertas-${companyCode}`, company: companyName, user: userName }}
            build={() => [{
              name: "Alertas", title: "Centro de alertas", subtitle: `${rows.length} alertas`,
              summary: [
                { label: "Peligro", value: String(stats.danger), tone: "red" }, { label: "Alertas", value: String(stats.warning), tone: "amber" },
                { label: "Avisos", value: String(stats.info), tone: "blue" }, { label: "Resueltas", value: String(stats.resolved), tone: "green" },
              ],
              columns: [
                { key: "fecha", header: "Fecha", type: "date" }, { key: "obra", header: "Obra" }, { key: "severidad", header: "Severidad" },
                { key: "tipo", header: "Tipo" }, { key: "titulo", header: "Alerta", width: 40 }, { key: "detalle", header: "Detalle", width: 50 }, { key: "estado", header: "Estado" },
              ],
              rows: rows.map((a) => ({
                fecha: a.created_at.slice(0, 10), obra: a.project_code ?? "Empresa", severidad: SEV[a.severity]?.label ?? a.severity,
                tipo: ALERT_TYPES[a.alert_type]?.label ?? a.alert_type, titulo: a.title, detalle: a.message ?? "", estado: a.resolved ? "Resuelta" : "Activa",
              })),
            }]} />
        </div>
      </FilterBar>

      {rows.length === 0 ? (
        <EmptyState icon={<CheckCheck className="h-6 w-6" />} title="Sin alertas con estos filtros" description="Todas las partidas están dentro de su presupuesto y plazo. Cuando un WBS llegue al 80% o se exceda, aparecerá aquí." />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          <AnimatePresence initial={false}>
            {rows.map((a, i) => {
              const sev = SEV[a.severity] ?? SEV.info;
              const type = ALERT_TYPES[a.alert_type] ?? { label: a.alert_type, Icon: Info };
              return (
                <motion.div key={a.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ delay: Math.min(i, 12) * 0.025 }}>
                  <Card className={cn("flex h-full gap-4 border-l-4 p-4 transition hover:shadow-pop", sev.ring, a.resolved && "opacity-70")}>
                    <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", a.severity === "danger" ? "bg-danger-50 text-danger" : a.severity === "warning" ? "bg-warn-50 text-[#9a5200]" : "bg-brand-blue-50 text-brand-blue")}>
                      <type.Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={sev.tone}>{sev.label}</Badge>
                        <Badge tone="gray" dot={false}>{type.label}</Badge>
                        {a.project_code && <Badge tone="navy" dot={false}>{a.project_code}</Badge>}
                        {a.resolved && <Badge tone="green">Resuelta</Badge>}
                      </div>
                      <p className="mt-2 text-sm font-semibold leading-snug text-ink">{a.title}</p>
                      {a.message && <p className="mt-0.5 text-[13px] text-ink-muted">{a.message}</p>}
                      <p suppressHydrationWarning className="mt-2 text-[11px] text-ink-muted" title={dateTime(a.created_at)}>
                        {timeAgo(a.created_at)}{a.project_name ? ` · ${a.project_name}` : ""}
                        {a.resolved && a.resolver ? ` · resuelta por ${a.resolver}` : ""}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link href={entityHref(companyCode, a)} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-blue-50 px-3 text-xs font-semibold text-brand-blue transition hover:bg-brand-blue-100">
                          Ver detalle <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                        {canResolve && (
                          <button onClick={() => toggle(a)} disabled={busy === a.id}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-ink-soft ring-1 ring-line transition hover:bg-slate-50 disabled:opacity-50">
                            {busy === a.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : a.resolved ? <RotateCcw className="h-3.5 w-3.5" /> : <CheckCheck className="h-3.5 w-3.5" />}
                            {a.resolved ? "Reabrir" : "Marcar como resuelta"}
                          </button>
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
