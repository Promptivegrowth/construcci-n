import type { Metadata } from "next";
import { AlertOctagon, Clock, MessageSquareWarning, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { KpiCard } from "@/components/ui/adm-kpi";
import { FilterBar, UrlSegment, UrlSelect } from "@/components/ui/filters";
import { Stagger, StaggerItem } from "@/components/ui/motion";
import { PageHeader } from "@/components/ui/primitives";
import { toNum } from "@/lib/format";
import { can } from "@/lib/permissions";
import { getProjectContext } from "@/lib/session";
import { signedUrls } from "@/lib/storage";
import { supabaseServer } from "@/lib/supabase/server";
import { ApprovalsBoard, type ApprovalItem } from "./approvals-board";

export const metadata: Metadata = { title: "Aprobaciones" };

export default async function AprobacionesPage({ params, searchParams }: { params: Promise<{ company: string; project: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { company, project } = await params;
  const sp = await searchParams;
  const ctx = await getProjectContext(company, project);
  const base = `/empresa/${company}/obra/${project}`;
  if (!can(ctx.role, "approveExpense")) redirect(`${base}/gastos`);
  const sb = await supabaseServer();
  const pid = ctx.project.id;

  let q = sb.from("expenses")
    .select("id, seq, issue_date, declared_at, doc_type, series, doc_number, description, cost_pen, payable_pen, total, currency, exceeds_budget, order_override, origin, status, observation, wbs_id, phase_id, created_by, supplier:suppliers(name, ruc), wbs:wbs_nodes(code, name), phase:phases(code), files:expense_files(file_path, mime)")
    .eq("project_id", pid)
    .in("status", sp.vista === "observados" ? ["observado"] : ["declarado"])
    .order("declared_at", { ascending: true })
    .limit(500);
  if (sp.fase) q = q.eq("phase_id", sp.fase);
  if (sp.wbs) q = q.eq("wbs_id", sp.wbs);
  const [{ data: rows }, { data: stats }, { data: phases }, { data: leaves }, { count: obsCount }, { count: pendCount }] = await Promise.all([
    q,
    sb.from("v_wbs_stats").select("wbs_id, budget, registered, paid").eq("project_id", pid),
    sb.from("phases").select("id, code, name").eq("project_id", pid).order("sort"),
    sb.from("wbs_nodes").select("id, code, name").eq("project_id", pid).eq("is_leaf", true).order("sort"),
    sb.from("expenses").select("id", { count: "exact", head: true }).eq("project_id", pid).eq("status", "observado"),
    sb.from("expenses").select("id", { count: "exact", head: true }).eq("project_id", pid).eq("status", "declarado"),
  ]);
  const creators = [...new Set((rows ?? []).map((r) => r.created_by).filter(Boolean) as string[])];
  const { data: people } = creators.length ? await sb.from("profiles").select("id, full_name").in("id", creators) : { data: [] };
  const firstFiles = (rows ?? []).map((r) => (r.files as unknown as { file_path: string; mime: string }[])?.[0]).filter(Boolean);
  const urls = await signedUrls(firstFiles.filter((f) => f.mime?.startsWith("image/")).map((f) => f.file_path));
  const st = new Map((stats ?? []).map((s) => [s.wbs_id, s]));

  const items: ApprovalItem[] = (rows ?? []).map((r) => {
    const files = (r.files as unknown as { file_path: string; mime: string }[]) ?? [];
    const s = st.get(r.wbs_id ?? "");
    const w = r.wbs as unknown as { code: string; name: string } | null;
    const sup = r.supplier as unknown as { name: string; ruc: string } | null;
    return {
      id: r.id, seq: r.seq ?? 0, issue_date: r.issue_date, declared_at: r.declared_at, doc_type: r.doc_type, series: r.series, doc_number: r.doc_number,
      description: r.description, cost_pen: toNum(r.cost_pen), payable_pen: toNum(r.payable_pen), currency: r.currency, total: toNum(r.total),
      exceeds_budget: r.exceeds_budget, origin: r.origin, observation: r.observation, supplier: sup?.name ?? "—", ruc: sup?.ruc ?? "",
      wbs: w ? `${w.code} · ${w.name}` : "—", phase: (r.phase as unknown as { code: string } | null)?.code ?? "",
      budget: toNum(s?.budget), registered: toNum(s?.registered), paid: toNum(s?.paid), files: files.length,
      thumb: files[0] && files[0].mime?.startsWith("image/") ? urls.get(files[0].file_path) ?? null : null, pdf: files[0]?.mime === "application/pdf",
      by: people?.find((p) => p.id === r.created_by)?.full_name ?? "—",
    };
  });
  const total = items.reduce((s, i) => s + i.cost_pen, 0);
  const exceeding = items.filter((i) => i.exceeds_budget).length;
  const oldest = items[0]?.declared_at ? Math.floor((Date.now() - new Date(items[0].declared_at).getTime()) / 86400000) : 0;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`${ctx.project.code} · Administración`} title="Bandeja de aprobaciones"
        description="Revisa el sustento y el impacto en cada WBS. Lo aprobado pasa a Contabilidad para pago; lo observado vuelve a la obra con tu comentario." />
      <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StaggerItem><KpiCard label="Pendientes de aprobar" value={pendCount ?? 0} format="int" icon={<ShieldCheck className="h-4 w-4" />} tone="violet" sub="Comprobantes declarados" /></StaggerItem>
        <StaggerItem><KpiCard label="Monto en bandeja" value={sp.vista === "observados" ? 0 : total} format="moneyShort" icon={<Clock className="h-4 w-4" />} tone="blue" sub={sp.vista === "observados" ? "—" : `Más antiguo: hace ${oldest} día(s)`} /></StaggerItem>
        <StaggerItem><KpiCard label="Exceden su WBS" value={exceeding} format="int" icon={<AlertOctagon className="h-4 w-4" />} tone="red" sub="Requieren decisión de Gerencia" /></StaggerItem>
        <StaggerItem><KpiCard label="Observados" value={obsCount ?? 0} format="int" icon={<MessageSquareWarning className="h-4 w-4" />} tone="amber" sub="En corrección por la obra" /></StaggerItem>
      </Stagger>
      <FilterBar>
        <UrlSegment name="vista" options={[{ value: "pendientes", label: "Pendientes", count: pendCount ?? 0 }, { value: "observados", label: "Observados", count: obsCount ?? 0 }]} />
        <UrlSelect name="fase" placeholder="Todas las fases" options={(phases ?? []).map((p) => ({ value: p.id, label: `${p.code} · ${p.name.split("·")[1]?.trim() ?? p.name}` }))} />
        <UrlSelect name="wbs" placeholder="Todos los WBS" className="max-w-[240px]" options={(leaves ?? []).map((w) => ({ value: w.id, label: `${w.code} ${w.name}` }))} />
      </FilterBar>
      <ApprovalsBoard items={items} companyCode={company} projectCode={project} readOnly={sp.vista === "observados"} />
    </div>
  );
}
