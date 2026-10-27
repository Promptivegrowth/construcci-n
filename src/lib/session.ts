import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import type { Role } from "@/lib/permissions";

export type Company = Database["public"]["Tables"]["companies"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Project = Database["public"]["Tables"]["projects"]["Row"];

export type Membership = { role: Role; all_projects: boolean; company: Company };

export const getSession = cache(async () => {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, { data: rows }] = await Promise.all([
    sb.from("profiles").select("*").eq("id", user.id).single(),
    sb.from("company_members").select("role, all_projects, company:companies(*)").eq("user_id", user.id),
  ]);
  if (!profile) redirect("/login");
  const memberships = (rows ?? []) as unknown as Membership[];
  return { user, profile: profile as Profile, memberships, isHolding: profile.is_holding_admin };
});

/** Empresa del holding a la que el usuario intenta entrar. Si no pertenece, vuelve al selector. */
export const getCompanyContext = cache(async (code: string) => {
  const session = await getSession();
  const sb = await supabaseServer();
  const { data: company } = await sb.from("companies").select("*").eq("code", code).maybeSingle();
  if (!company) notFound();
  const membership = session.memberships.find((m) => m.company.id === company.id);
  const role: Role | undefined = session.isHolding ? "gerente_general" : membership?.role;
  if (!role) redirect(`/empresas?denegado=${code}`);
  return { ...session, company, role };
});

export const getProjectContext = cache(async (companyCode: string, projectCode: string) => {
  const ctx = await getCompanyContext(companyCode);
  const sb = await supabaseServer();
  const { data: project } = await sb
    .from("projects")
    .select("*")
    .eq("company_id", ctx.company.id)
    .eq("code", decodeURIComponent(projectCode))
    .maybeSingle();
  if (!project) notFound();
  return { ...ctx, project };
});

export const companyPath = (code: string) => `/empresa/${code}`;
export const projectPath = (companyCode: string, projectCode: string) => `/empresa/${companyCode}/obra/${projectCode}`;
