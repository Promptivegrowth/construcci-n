"use server";
import { ROLE_LABEL } from "@/lib/permissions";
import { supabaseServer } from "@/lib/supabase/server";

type Result =
  | { ok: true; name: string; position: string | null; role: string; companyCode: string }
  | { ok: false; error: string };

/**
 * Inicia sesión dentro de una empresa del holding. Si el usuario no pertenece a la empresa elegida
 * (y no es Gerencia General del holding), se cierra la sesión y se rechaza el ingreso.
 */
async function signIn(email: string, password: string, companyCode: string): Promise<Result> {
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error || !data.user) {
    return { ok: false, error: error?.message === "Invalid login credentials" ? "Correo o contraseña incorrectos." : error?.message ?? "No se pudo iniciar sesión." };
  }
  const [{ data: profile }, { data: company }] = await Promise.all([
    sb.from("profiles").select("full_name, position, active, is_holding_admin").eq("id", data.user.id).single(),
    sb.from("companies").select("id, code, tagline, name").eq("code", companyCode).maybeSingle(),
  ]);
  if (profile && !profile.active) {
    await sb.auth.signOut();
    return { ok: false, error: "Tu usuario está desactivado. Contacta a Gerencia General." };
  }
  if (!company) {
    await sb.auth.signOut();
    return { ok: false, error: "Selecciona una empresa válida del holding." };
  }
  let role: string | null = profile?.is_holding_admin ? ROLE_LABEL.gerente_general : null;
  if (!role) {
    const { data: m } = await sb.from("company_members").select("role").eq("company_id", company.id).eq("user_id", data.user.id).maybeSingle();
    if (m) role = ROLE_LABEL[m.role];
  }
  if (!role) {
    await sb.auth.signOut();
    return { ok: false, error: `No tienes acceso a ${company.tagline ?? company.name}. Ingresa por la empresa en la que trabajas o solicita acceso a Gerencia General.` };
  }
  await sb.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", data.user.id);
  return { ok: true, name: profile?.full_name ?? email, position: profile?.position ?? null, role, companyCode: company.code };
}

export async function loginAction(email: string, password: string, companyCode: string) {
  return signIn(email, password, companyCode);
}

/** Acceso rápido para pruebas: solo disponible con NEXT_PUBLIC_QUICK_LOGIN=true. */
export async function quickLoginAction(email: string, companyCode: string) {
  if (process.env.NEXT_PUBLIC_QUICK_LOGIN !== "true") return { ok: false, error: "Acceso rápido deshabilitado." } as Result;
  if (!email.endsWith("@grupocruz.pe")) return { ok: false, error: "Usuario no permitido." } as Result;
  return signIn(email, process.env.QUICK_LOGIN_PASSWORD ?? "GrupoCruz2026!", companyCode);
}

export async function logoutAction() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
}
