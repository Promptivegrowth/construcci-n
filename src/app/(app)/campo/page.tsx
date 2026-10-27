import { getSession } from "@/lib/session";
import { signedUrls } from "@/lib/storage";
import { supabaseServer } from "@/lib/supabase/server";
import { toNum } from "@/lib/format";
import { CampoApp, type CampoData } from "./_components/campo-app";

export default async function CampoPage({ searchParams }: { searchParams: Promise<{ accion?: string }> }) {
  const { accion } = await searchParams;
  const s = await getSession();
  const sb = await supabaseServer();

  const { data: projects } = await sb.from("projects")
    .select("id, code, short_name, name, status, lat, lng, geofence_radius, company_id, company:companies(id, code, tagline, name)")
    .in("status", ["ejecucion", "preparacion", "paralizada"]).order("code");
  const ids = (projects ?? []).map((p) => p.id);
  const companyIds = [...new Set((projects ?? []).map((p) => p.company_id))];

  const since = new Date(Date.now() - 2 * 86400000).toISOString();
  const [{ data: phases }, { data: leaves }, { data: suppliers }, { data: materials }, { data: attendance }, { data: pending }] = await Promise.all([
    ids.length ? sb.from("phases").select("id, project_id, code, name, sort").in("project_id", ids).order("sort") : Promise.resolve({ data: [] }),
    ids.length ? sb.from("v_wbs_stats").select("wbs_id, project_id, code, name, phase_id, budget, paid, declared, sort").in("project_id", ids).eq("is_leaf", true).order("sort").limit(3000) : Promise.resolve({ data: [] }),
    companyIds.length ? sb.from("suppliers").select("id, company_id, ruc, name").in("company_id", companyIds).neq("kind", "trabajador").order("name") : Promise.resolve({ data: [] }),
    companyIds.length ? sb.from("materials").select("id, company_id, code, name, unit").in("company_id", companyIds).eq("active", true).order("name") : Promise.resolve({ data: [] }),
    sb.from("attendance").select("id, project_id, kind, marked_at, distance_m, within_geofence").eq("user_id", s.user.id).gte("marked_at", since).order("marked_at", { ascending: false }),
    ids.length ? sb.from("expenses").select("id, project_id, seq, description, doc_type, series, doc_number, total_pen, issue_date, origin, exceeds_budget, created_at, supplier:suppliers(name), creator:profiles!expenses_created_by_fkey(full_name), files:expense_files(file_path)")
      .in("project_id", ids).eq("status", "declarado").order("created_at", { ascending: false }).limit(40) : Promise.resolve({ data: [] }),
  ]);

  const roleByCompany = Object.fromEntries(s.memberships.map((m) => [m.company.id, m.role]));
  const urls = await signedUrls((pending ?? []).map((e) => (e.files as unknown as { file_path: string }[] | null)?.[0]?.file_path));

  const data: CampoData = {
    user: { id: s.user.id, name: s.profile.full_name, isHolding: s.isHolding },
    projects: (projects ?? []).map((p) => {
      const c = p.company as unknown as { id: string; code: string; tagline: string | null; name: string };
      return {
        id: p.id, code: p.code, name: p.short_name ?? p.name, status: p.status, lat: p.lat, lng: p.lng, radius: p.geofence_radius,
        companyId: c.id, companyCode: c.code, companyName: c.tagline ?? c.name, role: s.isHolding ? "gerente_general" : roleByCompany[c.id] ?? null,
      };
    }),
    phases: (phases ?? []).map((p) => ({ id: p.id, projectId: p.project_id, code: p.code, name: p.name })),
    leaves: (leaves ?? []).map((l) => ({ id: l.wbs_id!, projectId: l.project_id!, code: l.code!, name: l.name!, phaseId: l.phase_id, budget: toNum(l.budget), used: Math.max(toNum(l.paid), toNum(l.declared)) })),
    suppliers: (suppliers ?? []).map((x) => ({ id: x.id, companyId: x.company_id, ruc: x.ruc, name: x.name })),
    materials: (materials ?? []).map((m) => ({ id: m.id, companyId: m.company_id, code: m.code, name: m.name, unit: m.unit })),
    attendance: (attendance ?? []).map((a) => ({ id: a.id, projectId: a.project_id, kind: a.kind, markedAt: a.marked_at, distance: a.distance_m === null ? null : toNum(a.distance_m), within: a.within_geofence })),
    pending: (pending ?? []).map((e) => {
      const path = (e.files as unknown as { file_path: string }[] | null)?.[0]?.file_path;
      return {
        id: e.id, projectId: e.project_id, seq: e.seq, description: e.description, doc: `${e.doc_type} ${[e.series, e.doc_number].filter(Boolean).join("-")}`,
        total: toNum(e.total_pen), date: e.issue_date, origin: e.origin, exceeds: e.exceeds_budget,
        supplier: (e.supplier as unknown as { name: string } | null)?.name ?? "—", creator: (e.creator as unknown as { full_name: string } | null)?.full_name ?? "—",
        photo: path ? urls.get(path) ?? null : null,
      };
    }),
  };

  return <CampoApp data={data} initialAction={accion ?? null} />;
}
