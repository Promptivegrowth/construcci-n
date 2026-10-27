import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/primitives";
import { getCompanyContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { AlertsView, type AlertRow } from "./_components/alerts-view";

export const metadata: Metadata = { title: "Centro de alertas" };

export default async function AlertasPage({ params, searchParams }: {
  params: Promise<{ company: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { company } = await params;
  const sp = await searchParams;
  const ctx = await getCompanyContext(company);
  const sb = await supabaseServer();

  const estado = sp.estado ?? "activas";
  let q = sb.from("alerts")
    .select("id, alert_type, severity, title, message, entity_type, entity_id, resolved, resolved_at, created_at, project:projects(id, code, short_name), resolver:profiles!alerts_resolved_by_fkey(full_name)")
    .eq("company_id", ctx.company.id)
    .order("created_at", { ascending: false })
    .limit(800);
  if (estado === "activas") q = q.eq("resolved", false);
  if (estado === "resueltas") q = q.eq("resolved", true);
  if (sp.tipo) q = q.eq("alert_type", sp.tipo);
  if (sp.sev) q = q.eq("severity", sp.sev);
  if (sp.obra) q = q.eq("project_id", sp.obra);
  if (sp.desde) q = q.gte("created_at", `${sp.desde}T00:00:00`);
  if (sp.hasta) q = q.lte("created_at", `${sp.hasta}T23:59:59`);

  const [{ data }, { data: projects }, { data: counts }] = await Promise.all([
    q,
    sb.from("projects").select("id, code, short_name").eq("company_id", ctx.company.id).order("code"),
    sb.from("alerts").select("severity, resolved").eq("company_id", ctx.company.id).limit(5000),
  ]);

  const rows: AlertRow[] = (data ?? []).map((a) => {
    const p = a.project as unknown as { id: string; code: string; short_name: string | null } | null;
    const r = a.resolver as unknown as { full_name: string } | null;
    return {
      id: a.id, alert_type: a.alert_type, severity: a.severity, title: a.title, message: a.message,
      entity_type: a.entity_type, entity_id: a.entity_id, resolved: a.resolved, resolved_at: a.resolved_at,
      created_at: a.created_at, project_code: p?.code ?? null, project_name: p?.short_name ?? null, resolver: r?.full_name ?? null,
    };
  });
  const active = (counts ?? []).filter((c) => !c.resolved);
  const stats = {
    danger: active.filter((c) => c.severity === "danger").length,
    warning: active.filter((c) => c.severity === "warning").length,
    info: active.filter((c) => c.severity === "info").length,
    resolved: (counts ?? []).filter((c) => c.resolved).length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={ctx.company.tagline ?? ctx.company.name}
        title="Centro de alertas"
        description="Semáforo de consumo por WBS, ritmo de gasto vs. plazo, diferencias Obra–Contabilidad, vencimientos, órdenes excedidas y stock crítico. Las alertas se recalculan con cada pago o registro."
      />
      <AlertsView
        rows={rows}
        stats={stats}
        companyCode={ctx.company.code}
        companyName={ctx.company.name}
        userName={ctx.profile.full_name}
        projects={(projects ?? []).map((p) => ({ value: p.id, label: `${p.code} · ${p.short_name ?? ""}` }))}
        canResolve={["gerente_general", "gerente_proyectos", "administrador", "contabilidad"].includes(ctx.role)}
      />
    </div>
  );
}
