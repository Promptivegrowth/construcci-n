"use server";
import { supabaseServer } from "@/lib/supabase/server";

type Result = { ok: true; name: string; position: string | null } | { ok: false; error: string };

async function signIn(email: string, password: string): Promise<Result> {
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error || !data.user) {
    return { ok: false, error: error?.message === "Invalid login credentials" ? "Correo o contraseña incorrectos." : error?.message ?? "No se pudo iniciar sesión." };
  }
  const { data: profile } = await sb.from("profiles").select("full_name, position, active").eq("id", data.user.id).single();
  if (profile && !profile.active) {
    await sb.auth.signOut();
    return { ok: false, error: "Tu usuario está desactivado. Contacta a Gerencia General." };
  }
  await sb.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", data.user.id);
  return { ok: true, name: profile?.full_name ?? email, position: profile?.position ?? null };
}

export async function loginAction(email: string, password: string) {
  return signIn(email, password);
}

/** Acceso rápido para pruebas: solo disponible con NEXT_PUBLIC_QUICK_LOGIN=true. */
export async function quickLoginAction(email: string) {
  if (process.env.NEXT_PUBLIC_QUICK_LOGIN !== "true") return { ok: false, error: "Acceso rápido deshabilitado." } as Result;
  if (!email.endsWith("@grupocruz.pe")) return { ok: false, error: "Usuario no permitido." } as Result;
  return signIn(email, process.env.QUICK_LOGIN_PASSWORD ?? "GrupoCruz2026!");
}

export async function logoutAction() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
}
