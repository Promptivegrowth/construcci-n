"use client";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeftRight, Bell, Building2, Check, ChevronDown, ChevronRight, LayoutGrid, Lock, LogOut, Menu, Search, Smartphone, X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BrandMark } from "@/components/brand";
import { Icon } from "@/components/ui/icon";
import { Avatar, Badge, cn } from "@/components/ui/primitives";
import { companyNav, filterNav, projectNav, type NavSection } from "@/lib/nav";
import { ROLE_LABEL, type Role } from "@/lib/permissions";
import { PROJECT_STATUS } from "@/lib/calc";
import { timeAgo } from "@/lib/format";
import { logoutAction } from "@/app/login/actions";
import { CommandPalette } from "./command-palette";
import { SessionOverlay, SessionToasts } from "./session-overlay";

export type ShellProject = { id: string; code: string; name: string; short_name: string | null; status: string };
export type ShellAlert = { id: string; title: string; message: string | null; severity: string; created_at: string; project_code: string | null };
export type ShellCompany = { id: string; code: string; name: string; tagline: string | null; logo_key: string | null; accessible: boolean };

type Props = {
  children: ReactNode;
  user: { name: string; email: string; position: string | null; color: string | null };
  role: Role;
  isHolding: boolean;
  company: ShellCompany;
  companies: ShellCompany[];
  projects: ShellProject[];
  alerts: ShellAlert[];
  alertCount: number;
};

export function AppShell(props: Props) {
  const pathname = usePathname();
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const router = useRouter();

  const base = `/empresa/${props.company.code}`;
  const projectCode = pathname.match(/\/obra\/([^/]+)/)?.[1];
  const project = props.projects.find((p) => p.code === decodeURIComponent(projectCode ?? ""));
  const sections: NavSection[] = useMemo(
    () => filterNav(project ? projectNav(`${base}/obra/${project.code}`) : companyNav(base), props.role),
    [project, base, props.role],
  );

  useEffect(() => setMobile(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch((s) => !s);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const logout = async () => {
    setLeaving(true);
    await Promise.all([logoutAction(), new Promise((r) => setTimeout(r, 1200))]);
    try { sessionStorage.removeItem("gc-preloaded"); } catch {}
    router.replace(`/login?salida=1&empresa=${props.company.code}`);
    router.refresh();
  };

  const sidebar = (
    <Sidebar {...props} sections={sections} project={project} base={base} pathname={pathname} onClose={() => setMobile(false)} />
  );

  return (
    <div className="min-h-dvh">
      <SessionToasts name={props.user.name} />
      <SessionOverlay mode={leaving ? "out" : null} name={props.user.name} />
      <CommandPalette open={search} onOpenChange={setSearch} companyId={props.company.id} companyCode={props.company.code} projects={props.projects} sections={sections} />

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[272px] lg:block">{sidebar}</aside>
      <AnimatePresence>
        {mobile && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-navy-950/50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobile(false)} />
            <motion.aside className="fixed inset-y-0 left-0 z-50 w-[86%] max-w-[300px] lg:hidden" initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }}>
              {sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="lg:pl-[272px]">
        <Topbar {...props} project={project} onMenu={() => setMobile(true)} onSearch={() => setSearch(true)} onLogout={logout} base={base} />
        <main className="mx-auto w-full max-w-[1500px] px-4 pb-16 pt-5 sm:px-6 lg:px-8">{props.children}</main>
      </div>
    </div>
  );
}

function Sidebar({ user, role, company, companies, projects, sections, project, base, pathname, onClose, isHolding }: Props & {
  sections: NavSection[]; project?: ShellProject; base: string; pathname: string; onClose: () => void;
}) {
  const [showProjects, setShowProjects] = useState(true);
  const active = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  return (
    <div className="flex h-full flex-col bg-navy-900 text-white">
      <div className="flex items-center justify-between gap-2 px-5 pb-4 pt-5">
        <Link href="/empresas" className="flex items-center gap-3">
          <span className="rounded-xl bg-white p-1 shadow"><BrandMark size={34} /></span>
          <span className="leading-tight">
            <span className="block font-display text-[15px] font-bold tracking-[0.06em] text-brand-green">GRUPO CRUZ</span>
            <span className="block text-[11px] text-white/55">Control de presupuestos</span>
          </span>
        </Link>
        <button onClick={onClose} className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 lg:hidden" aria-label="Cerrar menú"><X className="h-5 w-5" /></button>
      </div>

      {/* Empresa actual + cambio */}
      <div className="px-3">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger className="flex w-full items-center gap-3 rounded-2xl bg-white/[0.06] px-3 py-2.5 text-left ring-1 ring-white/10 transition hover:bg-white/10">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-blue font-display text-sm font-bold">{company.code}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">Empresa</span>
              <span className="block truncate text-[13px] font-semibold">{company.tagline ?? company.name}</span>
            </span>
            <ArrowLeftRight className="h-4 w-4 shrink-0 text-white/50" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="start" sideOffset={8} className="z-50 w-[260px] rounded-2xl border border-line bg-white p-1.5 shadow-pop">
              <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">Cambiar de empresa</p>
              {companies.map((c) => (
                <DropdownMenu.Item key={c.id} disabled={!c.accessible} asChild>
                  <Link href={c.accessible ? `/empresa/${c.code}` : "#"} className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm outline-none data-[highlighted]:bg-brand-blue-50", !c.accessible && "cursor-not-allowed opacity-50")}>
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-navy-900 text-[11px] font-bold text-white">{c.code}</span>
                    <span className="flex-1 truncate font-medium text-ink">{c.tagline}</span>
                    {c.id === company.id ? <Check className="h-4 w-4 text-brand-blue" /> : !c.accessible ? <Lock className="h-3.5 w-3.5 text-ink-muted" /> : null}
                  </Link>
                </DropdownMenu.Item>
              ))}
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <DropdownMenu.Item asChild>
                <Link href="/empresas" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-ink-soft outline-none data-[highlighted]:bg-slate-50"><LayoutGrid className="h-4 w-4" />Selector del holding</Link>
              </DropdownMenu.Item>
              {isHolding && (
                <DropdownMenu.Item asChild>
                  <Link href="/holding" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-ink-soft outline-none data-[highlighted]:bg-slate-50"><Building2 className="h-4 w-4" />Vista consolidada del holding</Link>
                </DropdownMenu.Item>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      <nav className="scrollbar-thin mt-3 flex-1 overflow-y-auto px-3 pb-4">
        {project && (
          <Link href={base} className="mb-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-white/60 transition hover:bg-white/5 hover:text-white">
            <ChevronRight className="h-3.5 w-3.5 rotate-180" /> Todas las obras
          </Link>
        )}
        {project && (
          <div className="mb-4 rounded-2xl bg-gradient-to-br from-brand-blue to-navy-700 p-3.5 shadow-lg shadow-black/20">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">Obra</p>
            <p className="mt-0.5 font-display text-lg font-bold">{project.code}</p>
            <p className="line-clamp-2 text-xs text-white/75">{project.short_name ?? project.name}</p>
            <span className="mt-2 inline-block rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold">{PROJECT_STATUS[project.status]?.label}</span>
          </div>
        )}
        {sections.map((s) => (
          <div key={s.title} className="mb-4">
            <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">{s.title}</p>
            {s.items.map((it) => {
              const on = active(it.href, it.exact);
              return (
                <Link key={it.href} href={it.href} className={cn("group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition",
                  on ? "bg-white text-navy-900 shadow-sm" : "text-white/75 hover:bg-white/[0.07] hover:text-white")}>
                  {on && <motion.span layoutId="nav-active" className="absolute -left-3 top-1.5 h-[calc(100%-12px)] w-1 rounded-r-full bg-brand-green" />}
                  <Icon name={it.icon} className={cn("h-[18px] w-[18px] shrink-0", on ? "text-brand-blue" : "text-white/50 group-hover:text-white/80")} />
                  {it.label}
                </Link>
              );
            })}
          </div>
        ))}
        {!project && projects.length > 0 && (
          <div className="mb-4">
            <button onClick={() => setShowProjects(!showProjects)} className="mb-1.5 flex w-full items-center justify-between px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
              Obras ({projects.length}) <ChevronDown className={cn("h-3.5 w-3.5 transition", !showProjects && "-rotate-90")} />
            </button>
            {showProjects && projects.map((p) => (
              <Link key={p.id} href={`${base}/obra/${p.code}`} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[12.5px] text-white/75 transition hover:bg-white/[0.07] hover:text-white">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", { ejecucion: "bg-brand-green", preparacion: "bg-sky-400", cancelada: "bg-brand-red", paralizada: "bg-warn-500", cerrada: "bg-slate-400" }[p.status])} />
                <span className="font-semibold">{p.code}</span>
                <span className="truncate text-white/50">{p.short_name}</span>
              </Link>
            ))}
          </div>
        )}
      </nav>

      <div className="border-t border-white/10 p-3">
        <Link href="/campo" className="mb-2 flex items-center gap-3 rounded-xl bg-brand-green/15 px-3 py-2.5 text-[13px] font-semibold text-brand-green ring-1 ring-brand-green/25 transition hover:bg-brand-green/25">
          <Smartphone className="h-[18px] w-[18px]" /> App de campo
        </Link>
        <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
          <Avatar name={user.name} color={user.color} size={34} className="ring-white/20" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold">{user.name}</p>
            <p className="truncate text-[11px] text-white/50">{ROLE_LABEL[role]}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Topbar({ user, role, company, alerts, alertCount, project, onMenu, onSearch, onLogout, base }: Props & {
  project?: ShellProject; onMenu: () => void; onSearch: () => void; onLogout: () => void; base: string;
}) {
  const pathname = usePathname();
  const crumbs = useMemo(() => {
    const parts: { label: string; href?: string }[] = [{ label: company.tagline ?? company.name, href: base }];
    if (project) parts.push({ label: project.code, href: `${base}/obra/${project.code}` });
    const rest = pathname.replace(project ? `${base}/obra/${project.code}` : base, "").split("/").filter(Boolean);
    const LABELS: Record<string, string> = {
      presupuesto: "Presupuesto", gastos: "Gastos", nuevo: "Nuevo", aprobaciones: "Aprobaciones", ordenes: "Órdenes", caja: "Caja y fondos", pagos: "Pagos",
      conciliacion: "Conciliación", "cuentas-por-pagar": "Cuentas por pagar", valorizaciones: "Valorizaciones", "flujo-caja": "Flujo de caja", resultados: "Estado de resultados",
      "mano-de-obra": "Mano de obra", almacen: "Almacén", movimientos: "Movimientos", equipos: "Equipos", asistencia: "Asistencia", configuracion: "Ficha de obra",
      reportes: "Reportes", alertas: "Alertas", proveedores: "Proveedores", materiales: "Materiales", usuarios: "Usuarios", auditoria: "Trazabilidad", importar: "Importar", obras: "Obras", nueva: "Nueva obra",
    };
    rest.forEach((r) => parts.push({ label: LABELS[r] ?? (r.length > 20 ? "Detalle" : decodeURIComponent(r)) }));
    return parts;
  }, [pathname, project, base, company]);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/80 backdrop-blur-xl no-print">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button onClick={onMenu} className="grid h-10 w-10 place-items-center rounded-xl border border-line text-ink-soft lg:hidden" aria-label="Abrir menú"><Menu className="h-5 w-5" /></button>
        <nav className="hidden min-w-0 flex-1 items-center gap-1.5 text-sm md:flex" aria-label="Ruta">
          {crumbs.map((c, i) => (
            <span key={i} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-muted/60" />}
              {c.href && i < crumbs.length - 1 ? <Link href={c.href} className="truncate font-medium text-ink-muted hover:text-brand-blue">{c.label}</Link>
                : <span className="truncate font-semibold text-ink">{c.label}</span>}
            </span>
          ))}
        </nav>
        <div className="min-w-0 flex-1 md:hidden"><p className="truncate font-display text-sm font-semibold">{crumbs[crumbs.length - 1]?.label}</p></div>

        <button onClick={onSearch} className="hidden h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm text-ink-muted transition hover:border-brand-blue/40 sm:flex sm:w-64">
          <Search className="h-4 w-4" /> <span className="flex-1 text-left">Buscar comprobante, RUC, orden…</span>
          <kbd className="rounded-md border border-line bg-white px-1.5 text-[10px] font-semibold">Ctrl K</kbd>
        </button>
        <button onClick={onSearch} className="grid h-10 w-10 place-items-center rounded-xl border border-line text-ink-soft sm:hidden" aria-label="Buscar"><Search className="h-5 w-5" /></button>

        <Popover.Root>
          <Popover.Trigger className="relative grid h-10 w-10 place-items-center rounded-xl border border-line text-ink-soft transition hover:text-ink" aria-label="Alertas">
            <Bell className="h-5 w-5" />
            {alertCount > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 animate-pulse-ring place-items-center rounded-full bg-brand-red px-1 text-[10px] font-bold text-white">{alertCount > 99 ? "99+" : alertCount}</span>}
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content align="end" sideOffset={8} className="z-50 w-[min(380px,calc(100vw-24px))] rounded-2xl border border-line bg-white shadow-pop">
              <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
                <p className="font-display text-sm font-semibold">Alertas activas</p>
                <Badge tone="red">{alertCount}</Badge>
              </div>
              <div className="scrollbar-thin max-h-[360px] overflow-y-auto p-2">
                {alerts.map((a) => (
                  <Link key={a.id} href={a.project_code ? `${base}/obra/${a.project_code}` : `${base}/alertas`} className="flex gap-3 rounded-xl p-2.5 transition hover:bg-slate-50">
                    <span className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", a.severity === "danger" ? "bg-danger-500" : a.severity === "warning" ? "bg-warn-500" : "bg-brand-blue")} />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold leading-snug text-ink">{a.title}</span>
                      <span className="line-clamp-2 block text-xs text-ink-muted">{a.message}</span>
                      <span className="mt-0.5 block text-[10px] font-medium text-ink-muted/80">{a.project_code} · {timeAgo(a.created_at)}</span>
                    </span>
                  </Link>
                ))}
                {!alerts.length && <p className="p-6 text-center text-sm text-ink-muted">Sin alertas activas.</p>}
              </div>
              <Link href={`${base}/alertas`} className="block border-t border-line-soft px-4 py-3 text-center text-xs font-semibold text-brand-blue hover:bg-brand-blue-50/50">Ver centro de alertas</Link>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger className="flex items-center gap-2 rounded-xl p-1 pr-2 transition hover:bg-slate-100">
            <Avatar name={user.name} color={user.color} size={34} />
            <span className="hidden text-left leading-tight xl:block">
              <span className="block text-[13px] font-semibold text-ink">{user.name.split(" ").slice(0, 2).join(" ")}</span>
              <span className="block text-[11px] text-ink-muted">{ROLE_LABEL[role]}</span>
            </span>
            <ChevronDown className="hidden h-4 w-4 text-ink-muted xl:block" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={8} className="z-50 w-64 rounded-2xl border border-line bg-white p-1.5 shadow-pop">
              <div className="px-3 py-2.5">
                <p className="text-sm font-semibold text-ink">{user.name}</p>
                <p className="truncate text-xs text-ink-muted">{user.email}</p>
                <p className="mt-1.5"><Badge tone="blue">{ROLE_LABEL[role]}</Badge></p>
              </div>
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <DropdownMenu.Item asChild><Link href="/empresas" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm outline-none data-[highlighted]:bg-slate-50"><LayoutGrid className="h-4 w-4 text-ink-muted" />Cambiar de empresa</Link></DropdownMenu.Item>
              <DropdownMenu.Item asChild><Link href="/campo" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm outline-none data-[highlighted]:bg-slate-50"><Smartphone className="h-4 w-4 text-ink-muted" />App de campo</Link></DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <DropdownMenu.Item onSelect={onLogout} className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-danger outline-none data-[highlighted]:bg-danger-50"><LogOut className="h-4 w-4" />Cerrar sesión</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
