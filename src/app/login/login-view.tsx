"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Building2, Eye, EyeOff, LoaderCircle, Lock, Mail, ShieldCheck, Sparkles, UserX, Zap } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BrandMark, CompanyLogo } from "@/components/brand";
import { SessionOverlay, SessionToasts } from "@/components/layout/session-overlay";
import { Avatar, Button, cn } from "@/components/ui/primitives";
import { loginAction, quickLoginAction } from "./actions";

export type LoginCompany = { id: string; code: string; name: string; legal_name: string | null; ruc: string | null; tagline: string | null; logo_key: string | null; accent_color: string };
export type QuickUser = { email: string; name: string; role: string; hint: string; color: string };

const HIGHLIGHTS = [
  { k: "Proyectado", v: "vs. Declarado vs. Pagado", c: "bg-brand-blue" },
  { k: "Semáforo", v: "alerta al 80% del WBS", c: "bg-warn-500" },
  { k: "Trazabilidad", v: "de cada sol, con sustento", c: "bg-brand-green" },
];

export function LoginView({ companies, quick, quickEnabled }: { companies: LoginCompany[]; quick: Record<string, QuickUser[]>; quickEnabled: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  // La empresa puede venir de ?empresa=01 o de un enlace profundo ?next=/empresa/02/...
  const fromNext = params.get("next")?.match(/^\/empresa\/([^/]+)/)?.[1];
  const [code, setCode] = useState<string | null>(params.get("empresa") ?? fromNext ?? null);
  const company = companies.find((c) => c.code === code) ?? null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<{ name: string; role?: string } | null>(null);

  useEffect(() => {
    const p = params.get("empresa") ?? fromNext ?? null;
    if (p !== code) setCode(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const choose = (c: string | null) => {
    setCode(c);
    const next = new URLSearchParams(params.toString());
    if (c) next.set("empresa", c); else next.delete("empresa");
    ["salida", "expirada", "denegado"].forEach((k) => next.delete(k));
    router.replace(next.size ? `/login?${next}` : "/login", { scroll: false });
  };

  const finish = async (res: Awaited<ReturnType<typeof loginAction>>) => {
    if (!res.ok) {
      setBusy(null);
      toast.error("No pudimos iniciar sesión", { description: res.error });
      return;
    }
    setOverlay({ name: res.name, role: `${res.role} · ${company?.tagline ?? ""}` });
    const next = params.get("next");
    const target = next && next.startsWith(`/empresa/${res.companyCode}`) ? next : `/empresa/${res.companyCode}`;
    await new Promise((r) => setTimeout(r, 1300));
    router.replace(`${target}${target.includes("?") ? "&" : "?"}bienvenida=1`);
    router.refresh();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    if (!email || !password) return toast.warning("Completa tu correo y contraseña");
    setBusy("form");
    finish(await loginAction(email, password, company.code));
  };
  const quickLogin = async (q: QuickUser) => {
    if (!company) return;
    setBusy(q.email);
    finish(await quickLoginAction(q.email, company.code));
  };
  const users = company ? quick[company.code] ?? [] : [];

  return (
    <main className="grid min-h-dvh grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
      <SessionToasts />
      <SessionOverlay mode={overlay ? "in" : null} name={overlay?.name} role={overlay?.role} />

      {/* Panel institucional */}
      <section className="relative hidden overflow-hidden bg-[radial-gradient(120%_90%_at_10%_0%,#0b4a85_0%,#062a4d_55%,#031426_100%)] p-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:48px_48px]" />
        <motion.div className="pointer-events-none absolute -right-24 top-24 h-80 w-80 rounded-full bg-brand-green/20 blur-3xl" animate={{ y: [0, 30, 0] }} transition={{ duration: 8, repeat: Infinity }} />
        <motion.div className="pointer-events-none absolute -bottom-20 left-10 h-72 w-72 rounded-full bg-brand-red/20 blur-3xl" animate={{ y: [0, -24, 0] }} transition={{ duration: 9, repeat: Infinity }} />
        <div className="relative flex items-center gap-3">
          <div className="rounded-2xl bg-white p-1.5 shadow-lg"><BrandMark size={44} /></div>
          <div>
            <p className="font-display text-xl font-bold tracking-[0.08em] text-brand-green">GRUPO CRUZ</p>
            <p className="text-xs uppercase tracking-[0.25em] text-white/60">Holding</p>
          </div>
        </div>
        <div className="relative my-auto max-w-xl">
          <motion.h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            Todo el control de tus obras, <span className="text-brand-green">en un solo lugar.</span>
          </motion.h1>
          <motion.p className="mt-5 text-lg text-white/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            Presupuestos, gastos, almacén y conciliación Obra–Contabilidad en tiempo real.
          </motion.p>
          <div className="mt-10 space-y-3">
            {HIGHLIGHTS.map((h, i) => (
              <motion.div key={h.k} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur"
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45 + i * 0.12 }}>
                <span className={cn("h-8 w-1.5 rounded-full", h.c)} />
                <p className="text-sm"><span className="font-semibold">{h.k}</span> <span className="text-white/60">{h.v}</span></p>
              </motion.div>
            ))}
          </div>
        </div>
        <div className="relative flex items-center justify-between text-xs text-white/40">
          <span>Ingeniería · Infraestructura · Edificaciones · Contratistas Generales</span>
          <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Plataforma interna y privada</span>
        </div>
      </section>

      <section className="flex min-w-0 flex-col justify-center px-5 py-10 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden"><CompanyLogo className="h-12" priority /></div>
          <Steps step={company ? 2 : 1} />

          <AnimatePresence mode="wait" initial={false}>
            {!company ? (
              /* ---------------------------------------------------- Paso 1: empresa */
              <motion.div key="empresas" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.3 }}>
                <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">Selecciona tu empresa</h2>
                <p className="mt-2 text-sm text-ink-muted">Ingresarás con tu usuario a la empresa del holding en la que trabajas.</p>
                <div className="mt-7 space-y-3">
                  {companies.map((c, i) => (
                    <motion.button key={c.id} onClick={() => choose(c.code)}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.06 }}
                      className="group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-line bg-white p-4 text-left shadow-card transition hover:-translate-y-0.5 hover:border-brand-blue/40 hover:shadow-pop">
                      <span className="absolute inset-y-0 left-0 w-1" style={{ background: c.accent_color }} />
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-navy-900 font-display text-sm font-bold text-white">{c.code}</span>
                      <span className="min-w-0 flex-1">
                        <CompanyLogo logoKey={c.logo_key} className="h-8 max-w-[210px]" />
                        <span className="mt-1 block truncate text-[11px] text-ink-muted">{c.legal_name} · RUC {c.ruc}</span>
                      </span>
                      <ArrowRight className="h-5 w-5 shrink-0 text-ink-muted transition group-hover:translate-x-1 group-hover:text-brand-blue" />
                    </motion.button>
                  ))}
                </div>
                <p className="mt-6 flex items-center gap-2 text-xs text-ink-muted"><ShieldCheck className="h-4 w-4 shrink-0" />Solo podrás ingresar a las empresas que tienes asignadas.</p>
              </motion.div>
            ) : (
              /* ---------------------------------------------------- Paso 2: ingreso */
              <motion.div key={`login-${company.code}`} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.3 }}>
                <button onClick={() => choose(null)} className="mb-5 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted transition hover:text-brand-blue">
                  <ArrowLeft className="h-3.5 w-3.5" />Cambiar de empresa
                </button>
                <div className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-line bg-white p-3 pl-4 shadow-card">
                  <span className="absolute inset-y-0 left-0 w-1" style={{ background: company.accent_color }} />
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy-900 font-display text-sm font-bold text-white">{company.code}</span>
                  <div className="min-w-0">
                    <CompanyLogo logoKey={company.logo_key} className="h-7 max-w-[200px]" />
                    <p className="truncate text-[11px] text-ink-muted">{company.legal_name}</p>
                  </div>
                </div>
                <h2 className="mt-6 font-display text-3xl font-semibold tracking-tight text-ink">Ingresa a tu cuenta</h2>
                <p className="mt-2 text-sm text-ink-muted">Usa tu correo corporativo de {company.tagline}.</p>

                <form onSubmit={submit} className="mt-6 space-y-4">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-ink-soft">Correo corporativo</span>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                      <input type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@grupocruz.pe"
                        className="h-12 w-full rounded-xl border border-line bg-white pl-10 pr-4 text-sm outline-none transition focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10" />
                    </div>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-ink-soft">Contraseña</span>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                      <input type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                        className="h-12 w-full rounded-xl border border-line bg-white pl-10 pr-11 text-sm outline-none transition focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10" />
                      <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-muted hover:text-ink" aria-label="Mostrar contraseña">
                        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </label>
                  <Button type="submit" size="lg" className="w-full" disabled={!!busy}>
                    {busy === "form" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <>Ingresar a {company.tagline} <ArrowRight className="h-4 w-4" /></>}
                  </Button>
                </form>

                {quickEnabled && (
                  <motion.div className="mt-9" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
                    <div className="mb-3 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-warn-50 px-2.5 py-1 text-[11px] font-bold text-[#9a5200] ring-1 ring-warn/20">
                        <Zap className="h-3 w-3" /> Acceso rápido · solo desarrollo
                      </span>
                      <span className="h-px flex-1 bg-line" />
                    </div>
                    {users.length ? (
                      <>
                        <p className="mb-3 text-xs text-ink-muted">Roles con usuario asignado en {company.tagline}.</p>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {users.map((q, i) => (
                            <motion.button key={q.email} data-quick-role={q.role} onClick={() => quickLogin(q)} disabled={!!busy}
                              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.04 }}
                              className="group flex min-w-0 items-center gap-3 rounded-2xl border border-line bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-brand-blue/40 hover:shadow-card disabled:opacity-60">
                              {busy === q.email ? <span className="grid h-9 w-9 place-items-center"><LoaderCircle className="h-5 w-5 animate-spin text-brand-blue" /></span> : <Avatar name={q.name} color={q.color} size={36} />}
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] font-semibold text-ink">{q.role}</span>
                                <span className="block truncate text-[11px] text-ink-muted">{q.name} · {q.hint}</span>
                              </span>
                              <ArrowRight className="h-4 w-4 shrink-0 text-ink-muted transition group-hover:translate-x-0.5 group-hover:text-brand-blue" />
                            </motion.button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line bg-white/60 p-4 text-xs text-ink-muted">
                        <UserX className="h-5 w-5 shrink-0" />Esta empresa aún no tiene usuarios asignados. Gerencia General puede crearlos en «Usuarios y accesos».
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <p className="mt-10 flex items-center justify-center gap-1.5 text-center text-[11px] text-ink-muted">
            <Sparkles className="h-3 w-3" /> Grupo Cruz · Plataforma de control presupuestal
          </p>
        </div>
      </section>
    </main>
  );
}

function Steps({ step }: { step: 1 | 2 }) {
  return (
    <div className="mb-7 flex items-center gap-2 text-[11px] font-semibold">
      {[{ n: 1, l: "Empresa", I: Building2 }, { n: 2, l: "Usuario", I: Lock }].map((s, i) => (
        <div key={s.n} className="flex items-center gap-2">
          {i > 0 && <span className={cn("h-px w-8 transition-colors", step >= s.n ? "bg-brand-blue" : "bg-line")} />}
          <span className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors", step === s.n ? "bg-brand-blue text-white" : step > s.n ? "bg-brand-blue-50 text-brand-blue" : "bg-slate-100 text-ink-muted")}>
            <s.I className="h-3 w-3" />{s.n}. {s.l}
          </span>
        </div>
      ))}
    </div>
  );
}
