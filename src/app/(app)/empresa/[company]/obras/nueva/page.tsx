import type { Metadata } from "next";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader } from "@/components/ui/primitives";
import { can } from "@/lib/permissions";
import { getCompanyContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { NewProjectForm } from "./_components/new-project-form";

export const metadata: Metadata = { title: "Nueva obra" };

export default async function NuevaObraPage({ params }: { params: Promise<{ company: string }> }) {
  const { company } = await params;
  const ctx = await getCompanyContext(company);
  if (!can(ctx.role, "createProject")) return <NoAccess role={ctx.role} what="la creación de obras (solo Gerencia)" back={`/empresa/${company}/alertas`} />;
  const sb = await supabaseServer();
  const [{ data: projects }, { data: members }, { data: nodes }] = await Promise.all([
    sb.from("projects").select("id, code, short_name, name, project_type").eq("company_id", ctx.company.id).order("code"),
    sb.from("company_members").select("role, user:profiles(id, full_name, position, active)").eq("company_id", ctx.company.id),
    sb.from("wbs_nodes").select("project_id, is_leaf").limit(5000),
  ]);

  const nums = (projects ?? []).map((p) => parseInt(p.code.slice(0, 3), 10)).filter((n) => !Number.isNaN(n));
  const base = parseInt(`${ctx.company.code}0`, 10);
  const next = String(nums.length ? Math.max(...nums) + 1 : base).padStart(3, "0");

  const people = (members ?? []).map((m) => ({ role: m.role, ...(m.user as unknown as { id: string; full_name: string; position: string | null; active: boolean }) })).filter((p) => p.active);
  const { data: gg } = await sb.from("profiles").select("id, full_name, position").eq("is_holding_admin", true);
  const managers = [...(gg ?? []).map((p) => ({ id: p.id, label: `${p.full_name} · ${p.position ?? "Gerencia General"}` })),
    ...people.filter((p) => p.role === "gerente_proyectos" || p.role === "gerente_general").map((p) => ({ id: p.id, label: `${p.full_name} · ${p.position ?? ""}` }))]
    .filter((v, i, a) => a.findIndex((x) => x.id === v.id) === i);

  const templates = (projects ?? []).map((p) => {
    const ns = (nodes ?? []).filter((n) => n.project_id === p.id);
    return { id: p.id, label: `${p.code} · ${p.short_name ?? p.name}`, type: p.project_type, nodes: ns.length, leaves: ns.filter((n) => n.is_leaf).length };
  }).filter((t) => t.nodes > 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader eyebrow={ctx.company.tagline ?? ctx.company.name} title="Nueva obra"
        description="Registra la obra con su código, cliente y responsables. Puedes replicar la estructura de fases y WBS de una obra anterior (sin copiar montos) e importar luego el presupuesto aprobado." />
      <NewProjectForm companyCode={ctx.company.code} nextNumber={next} managers={managers}
        admins={people.filter((p) => p.role === "administrador").map((p) => ({ id: p.id, label: p.full_name }))}
        residents={people.filter((p) => p.role === "residente").map((p) => ({ id: p.id, label: p.full_name }))}
        templates={templates} defaultManager={ctx.role === "gerente_proyectos" ? ctx.user.id : managers[0]?.id ?? ""} />
    </div>
  );
}
