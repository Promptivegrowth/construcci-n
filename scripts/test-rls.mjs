// Prueba de aislamiento multiempresa (RLS) contra la API de Supabase con la clave pública.
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local", override: true, quiet: true });
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const as = async (email) => {
  const sb = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await sb.auth.signInWithPassword({ email, password: "GrupoCruz2026!" });
  if (error) throw error;
  return sb;
};
const check = (label, ok) => console.log(ok ? "✓" : "✗ FALLA", label);
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: c1 } = await admin.from("companies").select("id").eq("code", "01").single();
const { data: p010 } = await admin.from("projects").select("id, company_id").eq("code", "010-HCVC").single();
const { data: p012 } = await admin.from("projects").select("id").eq("code", "012-IEPC").single();
const { data: anyWbs } = await admin.from("wbs_nodes").select("id").eq("project_id", p010.id).eq("is_leaf", true).limit(1).single();

// 1) Anónimo no ve nada
const anon = createClient(URL, ANON, { auth: { persistSession: false } });
check("anónimo no lee obras", ((await anon.from("projects").select("id")).data ?? []).length === 0);

// 2) Usuario de la empresa 02 no ve datos de la empresa 01
const mp = await as("mparedes@grupocruz.pe");
check("empresa 02 no lee obras de la 01", ((await mp.from("projects").select("id").eq("company_id", c1.id)).data ?? []).length === 0);
check("empresa 02 no lee comprobantes de la 01", ((await mp.from("expenses").select("id").eq("company_id", c1.id)).data ?? []).length === 0);
check("empresa 02 no lee v_wbs_stats de la 01", ((await mp.from("v_wbs_stats").select("wbs_id").eq("project_id", p010.id)).data ?? []).length === 0);
const ins = await mp.from("expenses").insert({ company_id: p010.company_id, project_id: p010.id, description: "intrusión", total: 10, wbs_id: anyWbs.id });
check("empresa 02 no puede registrar gastos en la 01", !!ins.error);
const files = await mp.storage.from("evidencias").list(c1.id);
check("empresa 02 no lista sustentos de la 01", (files.data ?? []).length === 0);

// 3) Residente de la 01 solo ve sus obras asignadas; Almacén no puede pagar
const al = await as("almacen@grupocruz.pe");
const vis = (await al.from("projects").select("code")).data?.map((p) => p.code) ?? [];
check(`almacén ve solo sus obras (${vis.join(", ")})`, !vis.includes("012-IEPC") && vis.includes("010-HCVC"));
const { data: someExp } = await admin.from("expenses").select("id").eq("project_id", p010.id).eq("status", "aprobado").limit(1).single();
const pay = await al.from("payments").insert({ expense_id: someExp.id, amount_pen: 1 });
check("almacén no puede registrar pagos", !!pay.error);
check("almacén no lee la obra 012", ((await al.from("projects").select("id").eq("id", p012.id)).data ?? []).length === 0);

// 4) Auditoría inalterable incluso para Gerencia General
const gg = await as("gerencia@grupocruz.pe");
const del = await gg.from("audit_log").delete().gt("id", 0).select("id");
check("gerencia no puede borrar auditoría", (del.data ?? []).length === 0);
const upd = await gg.from("audit_log").update({ action: "X" }).gt("id", 0).select("id");
check("gerencia no puede modificar auditoría", (upd.data ?? []).length === 0);
