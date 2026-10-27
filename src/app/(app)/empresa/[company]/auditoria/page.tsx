import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/primitives";
import { can } from "@/lib/permissions";
import { getCompanyContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { AuditView, type AuditRow } from "./_components/audit-view";
import { summarize } from "./audit-meta";
import { buildAuditQuery, PAGE_SIZE } from "./query";

export const metadata: Metadata = { title: "Trazabilidad" };

export default async function AuditoriaPage({ params, searchParams }: { params: Promise<{ company: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { company } = await params;
  const sp = await searchParams;
  const ctx = await getCompanyContext(company);
  if (!can(ctx.role, "viewAudit")) redirect(`/empresa/${company}`);
  const sb = await supabaseServer();
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const [{ data, count }, { data: projects }, { data: people }] = await Promise.all([
    buildAuditQuery(sb, ctx.company.id, sp, { count: true }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    sb.from("projects").select("id, code, short_name").eq("company_id", ctx.company.id).order("code"),
    sb.from("profiles").select("id, full_name, avatar_color, position").order("full_name"),
  ]);
  const pname = new Map((people ?? []).map((p) => [p.id, p]));
  const pcode = new Map((projects ?? []).map((p) => [p.id, p.code]));

  const rows: AuditRow[] = (data ?? []).map((a) => {
    const nd = a.new_data as Record<string, unknown> | null;
    const od = a.old_data as Record<string, unknown> | null;
    const who = a.changed_by ? pname.get(a.changed_by) : null;
    return {
      id: a.id, table_name: a.table_name, record_id: a.record_id, action: a.action, changed_at: a.changed_at,
      user: who?.full_name ?? "Sistema", user_color: who?.avatar_color ?? null, project_code: a.project_id ? pcode.get(a.project_id) ?? null : null,
      summary: summarize(a.table_name, nd ?? od), old_data: od, new_data: nd,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={ctx.company.tagline ?? ctx.company.name}
        title="Trazabilidad y auditoría"
        description="Historial inalterable: cada creación, modificación, aprobación, pago o anulación queda registrada con su autor, fecha, hora y los valores anteriores. Nadie puede editar ni borrar este historial."
      />
      <AuditView rows={rows} total={count ?? 0} page={page} pageSize={PAGE_SIZE} companyId={ctx.company.id} companyCode={ctx.company.code} companyName={ctx.company.name} userName={ctx.profile.full_name}
        projects={(projects ?? []).map((p) => ({ value: p.id, label: `${p.code} · ${p.short_name ?? ""}` }))}
        people={(people ?? []).map((p) => ({ value: p.id, label: p.full_name }))} />
    </div>
  );
}
