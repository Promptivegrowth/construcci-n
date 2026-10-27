import type { Metadata } from "next";
import { getProjectContext } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { toNum } from "@/lib/format";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/primitives";
import { CashView, type FundRow, type MovementRow, type RenderCandidate } from "./cash-view";

export const metadata: Metadata = { title: "Caja y fondos" };

export default async function CajaPage({ params }: { params: Promise<{ company: string; project: string }> }) {
  const { company, project } = await params;
  const ctx = await getProjectContext(company, project);
  const sb = await supabaseServer();
  const pid = ctx.project.id;

  const [{ data: boxes }, { data: balances }, { data: movs }, { data: reqs }, { data: candidates }] = await Promise.all([
    sb.from("cash_boxes").select("id, name, active, responsible_id").eq("project_id", pid).order("created_at"),
    sb.from("v_cash_box_balance").select("box_id, income, outcome, balance").eq("project_id", pid),
    sb.from("cash_movements").select("id, box_id, movement_type, amount, moved_at, concept, expense_id, fund_request_id, created_at").eq("project_id", pid).order("moved_at", { ascending: false }).limit(2000),
    sb.from("fund_requests").select("*").eq("project_id", pid).order("created_at", { ascending: false }),
    sb.from("expenses").select("id, issue_date, description, total_pen, doc_type, series, doc_number, status, origin, supplier:suppliers(name)")
      .eq("project_id", pid).in("doc_type", ["BV", "TK", "FT", "RH", "OT"]).lte("total_pen", 3000).not("status", "in", "(anulado,borrador)").order("issue_date", { ascending: false }).limit(300),
  ]);
  const ids = [...new Set((reqs ?? []).flatMap((r) => [r.requested_by, r.approved_by, r.deposited_by]).concat((boxes ?? []).map((b) => b.responsible_id)).filter(Boolean) as string[])];
  const { data: people } = ids.length ? await sb.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
  const name = (id: string | null) => people?.find((p) => p.id === id)?.full_name ?? "—";
  const linked = new Set((movs ?? []).map((m) => m.expense_id).filter(Boolean));
  const reqSeq = new Map((reqs ?? []).map((r) => [r.id, r.seq]));
  const box = boxes?.[0];
  const bal = balances?.find((b) => b.box_id === box?.id);

  const funds: FundRow[] = (reqs ?? []).map((r) => ({
    id: r.id, seq: r.seq ?? 0, amount: toNum(r.amount), reason: r.reason, status: r.status, needed_by: r.needed_by, created_at: r.created_at,
    requested_by: name(r.requested_by), approved_by: r.approved_by ? name(r.approved_by) : null, approved_at: r.approved_at, approval_note: r.approval_note,
    deposited_by: r.deposited_by ? name(r.deposited_by) : null, deposited_at: r.deposited_at, deposit_operation: r.deposit_operation,
    rendered_amount: r.rendered_amount === null ? null : toNum(r.rendered_amount), rendered_at: r.rendered_at, mine: r.requested_by === ctx.user.id,
  }));
  const movements: MovementRow[] = (movs ?? []).map((m) => ({
    id: m.id, type: m.movement_type, amount: toNum(m.amount), date: m.moved_at, concept: m.concept, expense_id: m.expense_id,
    request: m.fund_request_id ? `N° ${reqSeq.get(m.fund_request_id) ?? ""}` : "",
  }));
  const render: RenderCandidate[] = (candidates ?? []).filter((e) => !linked.has(e.id)).map((e) => ({
    id: e.id, date: e.issue_date, description: e.description, total: toNum(e.total_pen), ref: `${e.series ?? ""}${e.series ? "-" : ""}${e.doc_number ?? "S/N"}`,
    supplier: (e.supplier as unknown as { name: string } | null)?.name ?? "—", origin: e.origin,
  }));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`${ctx.project.code} · Administración`} title="Caja y solicitudes de fondos"
        description="Caja independiente por obra. El residente o administrador solicita fondos, Gerencia aprueba, Contabilidad deposita y la obra rinde con sus comprobantes: toda la cadena queda registrada." />
      <CashView
        companyCode={company} projectCode={project}
        box={box ? { id: box.id, name: box.name, responsible: name(box.responsible_id), income: toNum(bal?.income), outcome: toNum(bal?.outcome), balance: toNum(bal?.balance) } : null}
        funds={funds} movements={movements} render={render}
        perms={{
          request: can(ctx.role, "requestFunds"), approve: can(ctx.role, "approveFunds"), deposit: can(ctx.role, "depositFunds"),
          render: ["administrador", "gerente_proyectos", "contabilidad", "residente"].includes(ctx.role), createBox: ["gerente_general", "gerente_proyectos", "contabilidad"].includes(ctx.role),
        }}
        meta={{ company: ctx.company.name, project: `${ctx.project.code} · ${ctx.project.name}`, user: ctx.profile.full_name }}
      />
    </div>
  );
}
