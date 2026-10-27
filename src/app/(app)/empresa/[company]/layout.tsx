import { AppShell } from "@/components/layout/shell";
import { getCompanyContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export default async function CompanyLayout({ children, params }: { children: React.ReactNode; params: Promise<{ company: string }> }) {
  const { company: code } = await params;
  const ctx = await getCompanyContext(code);
  const sb = await supabaseServer();
  const [{ data: companies }, { data: projects }, { data: alerts, count }] = await Promise.all([
    sb.from("companies").select("id, code, name, tagline, logo_key").order("sort"),
    sb.from("projects").select("id, code, name, short_name, status").eq("company_id", ctx.company.id).order("code"),
    sb.from("alerts").select("id, title, message, severity, created_at, project:projects(code)", { count: "exact" })
      .eq("company_id", ctx.company.id).eq("resolved", false)
      .order("severity", { ascending: true }).order("created_at", { ascending: false }).limit(8),
  ]);
  const memberIds = new Set(ctx.memberships.map((m) => m.company.id));

  return (
    <AppShell
      user={{ name: ctx.profile.full_name, email: ctx.profile.email, position: ctx.profile.position, color: ctx.profile.avatar_color }}
      role={ctx.role}
      isHolding={ctx.isHolding}
      company={{ ...ctx.company, accessible: true }}
      companies={(companies ?? []).map((c) => ({ ...c, accessible: ctx.isHolding || memberIds.has(c.id) }))}
      projects={projects ?? []}
      alerts={(alerts ?? []).map((a) => ({ ...a, project_code: (a.project as unknown as { code: string } | null)?.code ?? null }))}
      alertCount={count ?? 0}
    >
      {children}
    </AppShell>
  );
}
