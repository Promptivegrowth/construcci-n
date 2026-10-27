"use server";
import { revalidatePath } from "next/cache";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { companyPath, getCompanyContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export type MaterialInput = { id?: string; code: string; name: string; unit: string; category: string; min_stock: number; description: string; active: boolean };

export async function saveMaterial(companyCode: string, input: MaterialInput): Promise<ActionResult> {
  try {
    const ctx = await getCompanyContext(companyCode);
    if (!can(ctx.role, "manageMaterials")) return { ok: false, error: "Tu rol no administra el catálogo de materiales." };
    if (!input.code.trim() || !input.name.trim() || !input.unit.trim()) return { ok: false, error: "Código, nombre y unidad son obligatorios." };
    if (input.min_stock < 0) return { ok: false, error: "El stock mínimo no puede ser negativo." };
    const sb = await supabaseServer();
    const row = {
      company_id: ctx.company.id, code: input.code.trim().toUpperCase(), name: input.name.trim(), unit: input.unit.trim(), category: input.category,
      min_stock: input.min_stock, description: input.description || null, active: input.active,
    };
    const res = input.id ? await sb.from("materials").update(row).eq("id", input.id) : await sb.from("materials").insert(row);
    if (res.error) return { ok: false, error: res.error.code === "23505" ? `Ya existe un material con el código ${row.code}.` : friendlyError(res.error) };
    revalidatePath(`${companyPath(companyCode)}/materiales`);
    return { ok: true, message: input.id ? "Material actualizado" : "Material agregado al catálogo" };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}
