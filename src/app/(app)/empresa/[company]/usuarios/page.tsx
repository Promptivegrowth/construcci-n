import type { Metadata } from "next";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader } from "@/components/ui/primitives";
import { getCompanyContext } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { UsersView, type UserRow } from "./_components/users-view";

export const metadata: Metadata = { title: "Usuarios y accesos" };

export default async function UsuariosPage({ params }: { params: Promise<{ company: string }> }) {
  const { company } = await params;
  const ctx = await getCompanyContext(company);
  if (!ctx.isHolding) return <NoAccess role={ctx.role} what="la gestión de usuarios (solo Gerencia General del holding)" back={`/empresa/${company}/alertas`} />;
  // Verificado Gerencia General: se usa service role para listar todos los usuarios del holding.
  const admin = supabaseAdmin();
  const [{ data: profiles }, { data: members }, { data: pm }, { data: companies }, { data: projects }] = await Promise.all([
    admin.from("profiles").select("*").order("full_name"),
    admin.from("company_members").select("company_id, user_id, role, all_projects"),
    admin.from("project_members").select("project_id, user_id"),
    admin.from("companies").select("id, code, name, tagline").order("sort"),
    admin.from("projects").select("id, code, short_name, company_id").order("code"),
  ]);

  const rows: UserRow[] = (profiles ?? []).map((p) => ({
    id: p.id, full_name: p.full_name, email: p.email, position: p.position, phone: p.phone, dni: p.dni, avatar_color: p.avatar_color,
    is_holding_admin: p.is_holding_admin, active: p.active, last_seen_at: p.last_seen_at, created_at: p.created_at,
    access: (members ?? []).filter((m) => m.user_id === p.id).map((m) => ({
      company_id: m.company_id, role: m.role, all_projects: m.all_projects,
      project_ids: (pm ?? []).filter((x) => x.user_id === p.id && (projects ?? []).some((pr) => pr.id === x.project_id && pr.company_id === m.company_id)).map((x) => x.project_id),
    })),
  }));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Gerencia General · Holding" title="Usuarios y accesos"
        description="Crea usuarios, asígnalos a las empresas del holding con su rol y, si corresponde, limita las obras que pueden ver. El aislamiento se aplica en la base de datos." />
      <UsersView rows={rows} me={ctx.user.id} companies={companies ?? []} projects={projects ?? []} />
    </div>
  );
}
