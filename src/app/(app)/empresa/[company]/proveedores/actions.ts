"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { getCompanyContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

const schema = z.object({
  id: z.string().uuid().optional().nullable(),
  ruc: z.string().trim().regex(/^(\d{8}|\d{11}|PLANILLA-[A-Z]{3})$/, "RUC (11 dígitos) o DNI (8 dígitos) inválido"),
  name: z.string().trim().min(3, "Ingresa la razón social o nombre"),
  kind: z.enum(["proveedor", "subcontratista", "trabajador", "entidad"]),
  phone: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email("Correo inválido").optional().nullable().or(z.literal("")),
  address: z.string().trim().max(200).optional().nullable(),
  bank: z.string().trim().max(40).optional().nullable(),
  account_number: z.string().trim().max(40).optional().nullable(),
});

export type SupplierInput = z.infer<typeof schema>;

export async function saveSupplier(companyCode: string, input: SupplierInput): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await getCompanyContext(companyCode);
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const { id, ...data } = parsed.data;
    const row = { ...data, email: data.email || null, company_id: ctx.company.id, name: data.name.toUpperCase() };
    const sb = await supabaseServer();
    if (id) {
      if (!["gerente_general", "gerente_proyectos", "administrador", "contabilidad"].includes(ctx.role)) return { ok: false, error: "Tu rol no puede editar proveedores." };
      const { error } = await sb.from("suppliers").update(row).eq("id", id).eq("company_id", ctx.company.id);
      if (error) return { ok: false, error: friendlyError(error) };
      revalidatePath(`/empresa/${companyCode}/proveedores`);
      return { ok: true, data: { id }, message: "Proveedor actualizado" };
    }
    const { data: created, error } = await sb.from("suppliers").insert(row).select("id").single();
    if (error) return { ok: false, error: error.code === "23505" ? "Ya existe un proveedor con ese RUC/DNI en la empresa." : friendlyError(error) };
    revalidatePath(`/empresa/${companyCode}/proveedores`);
    return { ok: true, data: { id: created.id }, message: "Proveedor registrado" };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}
