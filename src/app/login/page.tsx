import type { Metadata } from "next";
import { Suspense } from "react";
import { ROLE_LABEL } from "@/lib/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { LoginView, type LoginCompany, type QuickUser } from "./login-view";

export const metadata: Metadata = { title: "Ingresar" };
export const dynamic = "force-dynamic";

const ROLE_ORDER = ["gerente_general", "gerente_proyectos", "residente", "administrador", "contabilidad", "almacen"];

export default async function LoginPage() {
  // Datos públicos del holding (nombre, logo, RUC) para el selector previo al inicio de sesión.
  const admin = supabaseAdmin();
  const { data: companies } = await admin.from("companies").select("id, code, name, legal_name, ruc, tagline, logo_key, accent_color").eq("active", true).order("sort");

  // Acceso rápido (solo desarrollo): usuarios reales de cada empresa según sus membresías.
  const quick: Record<string, QuickUser[]> = {};
  if (process.env.NEXT_PUBLIC_QUICK_LOGIN === "true") {
    const [{ data: profiles }, { data: members }, { data: pm }] = await Promise.all([
      admin.from("profiles").select("id, full_name, email, position, avatar_color, is_holding_admin").eq("active", true),
      admin.from("company_members").select("company_id, user_id, role, all_projects"),
      admin.from("project_members").select("user_id, project:projects(code, company_id)"),
    ]);
    for (const c of companies ?? []) {
      const list: (QuickUser & { order: number })[] = [];
      for (const p of profiles ?? []) {
        const m = (members ?? []).find((x) => x.company_id === c.id && x.user_id === p.id);
        if (!m && !p.is_holding_admin) continue;
        const role = p.is_holding_admin ? "gerente_general" : m!.role;
        const obras = (pm ?? []).map((x) => x.project as unknown as { code: string; company_id: string } | null)
          .filter((x, i) => x && x.company_id === c.id && (pm ?? [])[i].user_id === p.id).map((x) => x!.code);
        list.push({
          email: p.email, name: p.full_name, color: p.avatar_color ?? "#035AA6", role: ROLE_LABEL[role],
          hint: p.is_holding_admin ? "Holding · todas las empresas" : m!.all_projects ? `${p.position ?? ""} · todas las obras` : obras.length ? obras.join(" · ") : p.position ?? "",
          order: ROLE_ORDER.indexOf(role),
        });
      }
      quick[c.code] = list.sort((a, b) => a.order - b.order).map(({ order: _o, ...u }) => u);
    }
  }

  return (
    <Suspense>
      <LoginView companies={(companies ?? []) as LoginCompany[]} quick={quick} quickEnabled={process.env.NEXT_PUBLIC_QUICK_LOGIN === "true"} />
    </Suspense>
  );
}
