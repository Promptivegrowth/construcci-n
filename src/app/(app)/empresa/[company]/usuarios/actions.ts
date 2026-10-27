"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ROLES = ["gerente_general", "gerente_proyectos", "residente", "administrador", "contabilidad", "almacen"] as const;

const accessSchema = z.object({
  company_id: z.string().uuid(),
  role: z.enum(ROLES).nullable(),
  all_projects: z.boolean(),
  project_ids: z.array(z.string().uuid()),
});

const userSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  full_name: z.string().trim().min(5, "Ingresa nombres y apellidos"),
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  position: z.string().trim().max(80).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  dni: z.string().trim().regex(/^(\d{8})?$/, "DNI de 8 dígitos").optional().nullable(),
  avatar_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  is_holding_admin: z.boolean(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").optional().nullable().or(z.literal("")),
  access: z.array(accessSchema),
});

export type UserInput = z.infer<typeof userSchema>;

async function guard() {
  const s = await getSession();
  if (!s.isHolding) throw new Error("Solo Gerencia General puede gestionar usuarios y accesos.");
  return s;
}

async function syncAccess(userId: string, access: UserInput["access"]) {
  const admin = supabaseAdmin();
  const wanted = access.filter((a) => a.role);
  const { error: d1 } = await admin.from("company_members").delete().eq("user_id", userId);
  if (d1) throw d1;
  if (wanted.length) {
    const { error } = await admin.from("company_members").insert(wanted.map((a) => ({ company_id: a.company_id, user_id: userId, role: a.role!, all_projects: a.all_projects })));
    if (error) throw error;
  }
  const { error: d2 } = await admin.from("project_members").delete().eq("user_id", userId);
  if (d2) throw d2;
  const pm = wanted.filter((a) => !a.all_projects).flatMap((a) => a.project_ids.map((project_id) => ({ project_id, user_id: userId })));
  if (pm.length) {
    const { error } = await admin.from("project_members").insert(pm);
    if (error) throw error;
  }
}

export async function saveUser(input: UserInput): Promise<ActionResult<{ id: string }>> {
  try {
    const s = await guard();
    const parsed = userSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const u = parsed.data;
    if (!u.is_holding_admin && !u.access.some((a) => a.role)) return { ok: false, error: "Asigna al menos una empresa con su rol (o marca Gerencia General del holding)." };
    for (const a of u.access) if (a.role && !a.all_projects && !a.project_ids.length) return { ok: false, error: "Selecciona las obras o marca “Todas las obras” en cada empresa asignada." };
    const admin = supabaseAdmin();
    const meta = { full_name: u.full_name, position: u.position || null, phone: u.phone || null, dni: u.dni || null, avatar_color: u.avatar_color || "#035AA6", is_holding_admin: u.is_holding_admin };

    let id = u.id ?? null;
    if (!id) {
      if (!u.password) return { ok: false, error: "Define una contraseña inicial." };
      const { data, error } = await admin.auth.admin.createUser({ email: u.email, password: u.password, email_confirm: true, user_metadata: meta });
      if (error) return { ok: false, error: error.message.includes("already") ? "Ya existe un usuario con ese correo." : error.message };
      id = data.user.id;
    } else {
      if (id === s.user.id && !u.is_holding_admin) return { ok: false, error: "No puedes quitarte a ti mismo el rol de Gerencia General." };
      const { error } = await admin.auth.admin.updateUserById(id, { email: u.email, user_metadata: meta });
      if (error) return { ok: false, error: error.message };
    }
    const { error: pe } = await admin.from("profiles").upsert({ id, email: u.email, ...meta });
    if (pe) return { ok: false, error: friendlyError(pe) };
    await syncAccess(id, u.access);
    revalidatePath("/empresa", "layout");
    return { ok: true, data: { id }, message: u.id ? "Usuario y accesos actualizados" : "Usuario creado con sus accesos" };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function setUserActive(userId: string, active: boolean): Promise<ActionResult> {
  try {
    const s = await guard();
    if (userId === s.user.id) return { ok: false, error: "No puedes desactivar tu propio usuario." };
    const admin = supabaseAdmin();
    const { error } = await admin.from("profiles").update({ active }).eq("id", userId);
    if (error) return { ok: false, error: friendlyError(error) };
    await admin.auth.admin.updateUserById(userId, { ban_duration: active ? "none" : "876000h" });
    revalidatePath("/empresa", "layout");
    return { ok: true, message: active ? "Usuario reactivado" : "Usuario desactivado: ya no podrá ingresar" };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function resetUserPassword(userId: string, password: string): Promise<ActionResult> {
  try {
    await guard();
    if (password.length < 8) return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." };
    const { error } = await supabaseAdmin().auth.admin.updateUserById(userId, { password });
    if (error) return { ok: false, error: error.message };
    return { ok: true, message: "Contraseña restablecida" };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}
