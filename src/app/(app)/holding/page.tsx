import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CompanyLogo } from "@/components/brand";
import { Avatar } from "@/components/ui/primitives";
import { elapsed, PROJECT_STATUS } from "@/lib/calc";
import { toNum } from "@/lib/format";
import { getProjectsSummary } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { LogoutButton } from "../empresas/logout-button";
import { HoldingView } from "./holding-view";

export const metadata: Metadata = { title: "Holding consolidado" };

export default async function HoldingPage() {
  const s = await getSession();
  if (!s.isHolding) redirect("/empresas?denegado=holding");
  const sb = await supabaseServer();
  const [{ data: companies }, { data: projects }, { data: alerts }, { data: colls }] = await Promise.all([
    sb.from("companies").select("*").order("sort"),
    sb.from("projects").select("*").order("code"),
    sb.from("alerts").select("project_id, severity, company_id").eq("resolved", false),
    sb.from("collections").select("project_id, amount"),
  ]);
  const summary = await getProjectsSummary((projects ?? []).map((p) => p.id));
  const rows = (projects ?? []).map((p) => {
    const t = summary.get(p.id)!;
    const a = (alerts ?? []).filter((x) => x.project_id === p.id);
    const c = (companies ?? []).find((x) => x.id === p.company_id)!;
    return {
      id: p.id, code: p.code, name: p.short_name ?? p.name, company: c.code, companyName: c.tagline ?? c.name, status: p.status, statusLabel: PROJECT_STATUS[p.status].label,
      contract: toNum(p.contract_amount), budget: t.budget, paid: t.paid, declared: t.declared, committed: t.committed, elapsed: elapsed(p), threshold: p.alert_threshold / 100,
      danger: a.filter((x) => x.severity === "danger").length, warning: a.filter((x) => x.severity === "warning").length,
      collected: (colls ?? []).filter((x) => x.project_id === p.id).reduce((sum, x) => sum + toNum(x.amount), 0),
    };
  });
  return (
    <div className="min-h-dvh bg-surface">
      <header className="bg-navy-900 text-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link href="/empresas" className="grid h-10 w-10 place-items-center rounded-xl border border-white/20 hover:bg-white/10" aria-label="Volver"><ArrowLeft className="h-4 w-4" /></Link>
            <div className="rounded-xl bg-white px-3 py-1.5"><CompanyLogo className="h-8" /></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block"><p className="text-sm font-semibold">{s.profile.full_name}</p><p className="text-xs text-white/60">Gerencia General</p></div>
            <Avatar name={s.profile.full_name} color={s.profile.avatar_color} size={38} className="ring-white/30" />
            <LogoutButton name={s.profile.full_name} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1500px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <HoldingView rows={rows} companies={(companies ?? []).map((c) => ({ id: c.id, code: c.code, name: c.tagline ?? c.name, color: c.accent_color }))} user={s.profile.full_name}
          alertsByCompany={Object.fromEntries((companies ?? []).map((c) => [c.code, (alerts ?? []).filter((a) => a.company_id === c.id).length]))} />
      </main>
    </div>
  );
}
