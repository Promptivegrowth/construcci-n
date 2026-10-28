import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { Badge, PageHeader } from "@/components/ui/primitives";
import { PROJECT_STATUS } from "@/lib/calc";
import { can, canView } from "@/lib/permissions";
import { getProjectContext } from "@/lib/session";
import { signedUrls } from "@/lib/storage";
import { supabaseServer } from "@/lib/supabase/server";
import { ConfigView } from "./_components/config-view";
import { NoAccess } from "@/components/ui/no-access";

export const metadata: Metadata = { title: "Ficha de obra" };

export default async function ConfiguracionPage({ params }: { params: Promise<{ company: string; project: string }> }) {
  const { company, project: code } = await params;
  const ctx = await getProjectContext(company, code);
  if (!canView(ctx.role, "finance")) return <NoAccess role={ctx.role} area="finance" back={`/empresa/${company}/obra/${code}`} backLabel="Volver a la obra" />;
  const sb = await supabaseServer();
  const p = ctx.project;

  const [{ data: docs }, { data: closures }, { data: members }, { data: pm }, { data: gg }] = await Promise.all([
    sb.from("project_documents").select("*").eq("project_id", p.id).order("doc_kind").order("issue_date"),
    sb.from("period_closures").select("*, closer:profiles!period_closures_closed_by_fkey(full_name)").eq("project_id", p.id).order("period_start", { ascending: false }),
    sb.from("company_members").select("role, all_projects, user:profiles(id, full_name, position, avatar_color, email, active, last_seen_at)").eq("company_id", ctx.company.id),
    sb.from("project_members").select("user_id").eq("project_id", p.id),
    sb.from("profiles").select("id, full_name, position").eq("is_holding_admin", true),
  ]);
  const urls = await signedUrls((docs ?? []).map((d) => d.file_path));
  const assigned = new Set((pm ?? []).map((x) => x.user_id));
  type U = { id: string; full_name: string; position: string | null; avatar_color: string | null; email: string; active: boolean; last_seen_at: string | null };
  const team = (members ?? [])
    .map((m) => ({ role: m.role, all_projects: m.all_projects, ...(m.user as unknown as U) }))
    .filter((m) => m.active && (m.all_projects || assigned.has(m.id)));
  const people = (members ?? []).map((m) => ({ role: m.role, ...(m.user as unknown as U) })).filter((u) => u.active);

  const st = PROJECT_STATUS[p.status];
  const editable = can(ctx.role, "editBudget");

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`Obra ${p.code}`} title="Ficha de obra"
        description="Datos generales, responsables, geocerca de asistencia, checklist documental (contrato, orden de servicio, cartas fianza, póliza) y cierres de periodo."
        actions={<Badge tone={st.tone}>{st.label}</Badge>} />
      {p.status === "cerrada" && (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-ink-soft">
          <Lock className="h-4 w-4" /> Obra cerrada: toda la información está en solo lectura. Gerencia puede reabrirla cambiando su estado.
        </div>
      )}
      <ConfigView
        companyCode={ctx.company.code}
        companyId={ctx.company.id}
        project={{ ...p, contract_amount: Number(p.contract_amount), exchange_rate: Number(p.exchange_rate) }}
        role={ctx.role}
        editable={editable}
        canDocs={can(ctx.role, "manageDocuments") && p.status !== "cerrada"}
        canClose={can(ctx.role, "closePeriod")}
        docs={(docs ?? []).map((d) => ({ ...d, amount: d.amount === null ? null : Number(d.amount), url: d.file_path ? urls.get(d.file_path) ?? null : null }))}
        closures={(closures ?? []).map((c) => ({ id: c.id, period_start: c.period_start, period_end: c.period_end, label: c.label, closed_at: c.closed_at,
          closer: (c.closer as unknown as { full_name: string } | null)?.full_name ?? null }))}
        team={team}
        managers={[...(gg ?? []).map((g) => ({ id: g.id, label: g.full_name })), ...people.filter((u) => u.role === "gerente_proyectos").map((u) => ({ id: u.id, label: u.full_name }))]
          .filter((v, i, a) => a.findIndex((x) => x.id === v.id) === i)}
        admins={people.filter((u) => u.role === "administrador").map((u) => ({ id: u.id, label: u.full_name }))}
        residents={people.filter((u) => u.role === "residente").map((u) => ({ id: u.id, label: u.full_name }))}
      />
    </div>
  );
}
