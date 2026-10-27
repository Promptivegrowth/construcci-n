import type { Metadata } from "next";
import { ArrowRight, Building2, Lock, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { CompanyLogo } from "@/components/brand";
import { SessionToasts } from "@/components/layout/session-overlay";
import { CountUp, Stagger, StaggerItem } from "@/components/ui/motion";
import { Avatar, Badge, cn } from "@/components/ui/primitives";
import { ROLE_LABEL } from "@/lib/permissions";
import { getProjectsSummary } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";

export const metadata: Metadata = { title: "Empresas del holding" };

export default async function EmpresasPage() {
  const session = await getSession();
  const sb = await supabaseServer();
  const [{ data: companies }, { data: projects }] = await Promise.all([
    sb.from("companies").select("*").order("sort"),
    sb.from("projects").select("id, company_id, status"),
  ]);
  const summary = await getProjectsSummary((projects ?? []).map((p) => p.id));
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="relative min-h-dvh overflow-hidden bg-surface">
      <SessionToasts name={session.profile.full_name} />
      <div className="absolute inset-x-0 top-0 h-[340px] bg-[radial-gradient(120%_120%_at_0%_0%,#0b4a85_0%,#062a4d_55%,#031426_100%)]">
        <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:44px_44px]" />
      </div>
      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
        <header className="flex items-center justify-between gap-4">
          <div className="rounded-2xl bg-white px-4 py-2 shadow-lg"><CompanyLogo className="h-9 sm:h-10" priority /></div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-white">{session.profile.full_name}</p>
              <p className="text-xs text-white/60">{session.profile.position}</p>
            </div>
            <Avatar name={session.profile.full_name} color={session.profile.avatar_color} size={40} className="ring-white/30" />
            <LogoutButton name={session.profile.full_name} />
          </div>
        </header>

        <div className="mt-12 animate-fade-up text-white">
          <p className="text-sm font-medium text-brand-green">{greet}, {session.profile.full_name.split(" ")[0]}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">¿En qué empresa trabajarás hoy?</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/65">Solo puedes ingresar a las empresas que tienes asignadas. La información de cada empresa está aislada en la base de datos.</p>
        </div>

        {session.isHolding && (
          <Link href="/holding" className="group mt-8 flex items-center gap-4 rounded-2xl border border-white/15 bg-white/10 p-4 text-white backdrop-blur transition hover:bg-white/15">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-green text-navy-900"><Building2 className="h-5 w-5" /></span>
            <span className="flex-1">
              <span className="block font-display font-semibold">Vista consolidada del holding</span>
              <span className="block text-xs text-white/65">Comparativo de empresas y obras · exclusivo de Gerencia General</span>
            </span>
            <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
          </Link>
        )}

        <Stagger className="mt-8 grid gap-5 sm:grid-cols-2" delay={0.08}>
          {(companies ?? []).map((c) => {
            const membership = session.memberships.find((m) => m.company.id === c.id);
            const accessible = session.isHolding || !!membership;
            const projs = (projects ?? []).filter((p) => p.company_id === c.id);
            const t = projs.reduce((acc, p) => {
              const s = summary.get(p.id);
              return { budget: acc.budget + (s?.budget ?? 0), paid: acc.paid + (s?.paid ?? 0) };
            }, { budget: 0, paid: 0 });
            const active = projs.filter((p) => p.status === "ejecucion").length;
            const card = (
              <div className={cn("group relative h-full overflow-hidden rounded-3xl border bg-white p-6 shadow-card transition duration-300",
                accessible ? "border-line hover:-translate-y-1 hover:border-brand-blue/30 hover:shadow-pop" : "border-dashed border-line opacity-75")}>
                <div className="absolute inset-x-0 top-0 h-1" style={{ background: c.accent_color }} />
                <div className="flex items-start justify-between gap-3">
                  <CompanyLogo logoKey={c.logo_key} className={cn("h-11 max-w-[240px]", !accessible && "grayscale")} />
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-navy-900 font-display text-sm font-bold text-white">{c.code}</span>
                </div>
                <p className="mt-4 text-xs text-ink-muted">{c.legal_name} · RUC {c.ruc}</p>
                {accessible ? (
                  projs.length ? (
                    <div className="mt-5 grid grid-cols-3 gap-3 border-t border-line-soft pt-4">
                      <div><p className="text-[11px] text-ink-muted">Obras</p><p className="font-display text-xl font-semibold"><CountUp value={projs.length} format="int" /></p><p className="text-[11px] text-brand-green-700">{active} en ejecución</p></div>
                      <div><p className="text-[11px] text-ink-muted">Presupuesto</p><p className="font-display text-xl font-semibold"><CountUp value={t.budget} format="moneyShort" /></p></div>
                      <div><p className="text-[11px] text-ink-muted">Pagado</p><p className="font-display text-xl font-semibold"><CountUp value={t.paid} format="moneyShort" /></p></div>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-center">
                      <p className="font-display font-semibold text-ink">Sin proyectos</p>
                      <p className="text-xs text-ink-muted">Lista para registrar su primera obra · indicadores en S/ 0.00</p>
                    </div>
                  )
                ) : (
                  <div className="mt-5 flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
                    <Lock className="h-5 w-5 text-ink-muted" />
                    <p className="text-xs text-ink-muted">No tienes acceso a esta empresa. Solicítalo a Gerencia General.</p>
                  </div>
                )}
                <div className="mt-5 flex items-center justify-between">
                  {accessible ? <Badge tone="blue">{membership ? ROLE_LABEL[membership.role] : "Gerencia General"}</Badge> : <Badge tone="gray">Sin acceso</Badge>}
                  {accessible && <span className="flex items-center gap-1 text-sm font-semibold text-brand-blue">Ingresar <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>}
                </div>
              </div>
            );
            return (
              <StaggerItem key={c.id}>
                {accessible ? <Link href={`/empresa/${c.code}`} className="block h-full">{card}</Link> : card}
              </StaggerItem>
            );
          })}
        </Stagger>
        <p className="mt-10 flex items-center justify-center gap-2 text-xs text-ink-muted"><ShieldCheck className="h-4 w-4" />Accesos controlados por empresa y obra · Grupo Cruz Holding</p>
      </div>
    </div>
  );
}
