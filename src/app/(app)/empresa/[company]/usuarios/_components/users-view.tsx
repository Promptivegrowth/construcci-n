"use client";
import { motion } from "framer-motion";
import { Building2, Crown, KeyRound, LoaderCircle, Pencil, Plus, Power, RefreshCw, Search, ShieldCheck, UserRoundCheck, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/dialog";
import { CountUp } from "@/components/ui/motion";
import { Avatar, Badge, Button, Card, EmptyState, Field, Input, Select, cn } from "@/components/ui/primitives";
import { timeAgo } from "@/lib/format";
import { ROLE_LABEL, type Role } from "@/lib/permissions";
import { resetUserPassword, saveUser, setUserActive, type UserInput } from "../actions";

type Access = { company_id: string; role: Role | null; all_projects: boolean; project_ids: string[] };
export type UserRow = {
  id: string; full_name: string; email: string; position: string | null; phone: string | null; dni: string | null; avatar_color: string | null;
  is_holding_admin: boolean; active: boolean; last_seen_at: string | null; created_at: string; access: Access[];
};
type Co = { id: string; code: string; name: string; tagline: string | null };
type Pr = { id: string; code: string; short_name: string | null; company_id: string };

const COLORS = ["#062A4D", "#035AA6", "#04BF55", "#F21D2F", "#7C3AED", "#035928", "#0EA5E9", "#D97706"];
const genPassword = () => `GC-${Math.random().toString(36).slice(2, 6).toUpperCase()}${Math.floor(1000 + Math.random() * 8999)}!`;

export function UsersView({ rows, me, companies, projects }: { rows: UserRow[]; me: string; companies: Co[]; projects: Pr[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [form, setForm] = useState<UserInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [pwd, setPwd] = useState<{ user: UserRow; value: string } | null>(null);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => !t || `${r.full_name} ${r.email} ${r.position ?? ""}`.toLowerCase().includes(t));
  }, [rows, q]);
  const company = (id: string) => companies.find((c) => c.id === id);

  const blankAccess = (existing: Access[] = []): Access[] =>
    companies.map((c) => existing.find((a) => a.company_id === c.id) ?? { company_id: c.id, role: null, all_projects: true, project_ids: [] });

  const openNew = () => setForm({ id: null, full_name: "", email: "", position: "", phone: "", dni: "", avatar_color: COLORS[1], is_holding_admin: false, password: genPassword(), access: blankAccess() });
  const openEdit = (u: UserRow) => setForm({ id: u.id, full_name: u.full_name, email: u.email, position: u.position ?? "", phone: u.phone ?? "", dni: u.dni ?? "",
    avatar_color: u.avatar_color ?? COLORS[1], is_holding_admin: u.is_holding_admin, password: "", access: blankAccess(u.access) });

  const submit = async () => {
    if (!form) return;
    setSaving(true);
    const r = await saveUser({ ...form, access: form.access.map((a) => ({ ...a, project_ids: a.all_projects ? [] : a.project_ids })) });
    setSaving(false);
    if (!r.ok) return toast.error("No se pudo guardar", { description: r.error });
    toast.success(r.message, { description: !form.id ? `Comparte la contraseña inicial: ${form.password}` : undefined, duration: 9000 });
    setForm(null);
    router.refresh();
  };
  const toggleActive = async (u: UserRow) => {
    setBusy(u.id);
    const r = await setUserActive(u.id, !u.active);
    setBusy(null);
    if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error);
  };
  const doReset = async () => {
    if (!pwd) return;
    setBusy(pwd.user.id);
    const r = await resetUserPassword(pwd.user.id, pwd.value);
    setBusy(null);
    if (r.ok) { toast.success(r.message, { description: `Nueva contraseña para ${pwd.user.full_name}: ${pwd.value}`, duration: 9000 }); setPwd(null); } else toast.error(r.error);
  };
  const setAccess = (i: number, patch: Partial<Access>) => setForm((f) => f && { ...f, access: f.access.map((a, j) => (j === i ? { ...a, ...patch } : a)) });

  const stats = [
    { k: "Usuarios", v: rows.length, Icon: UsersRound, c: "bg-brand-blue-50 text-brand-blue" },
    { k: "Activos", v: rows.filter((r) => r.active).length, Icon: UserRoundCheck, c: "bg-ok-50 text-brand-green-700" },
    { k: "Gerencia General", v: rows.filter((r) => r.is_holding_admin).length, Icon: Crown, c: "bg-navy-900 text-white" },
    { k: "Empresas", v: companies.length, Icon: Building2, c: "bg-violet-50 text-violet-700" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div key={s.k} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="flex items-center gap-4 p-4">
              <span className={cn("grid h-11 w-11 place-items-center rounded-xl", s.c)}><s.Icon className="h-5 w-5" /></span>
              <div><p className="text-xs text-ink-muted">{s.k}</p><p className="font-display text-2xl font-semibold"><CountUp value={s.v} format="int" /></p></div>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-4 py-3">
          <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, correo o cargo…" className="h-9 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm outline-none focus:border-brand-blue focus:bg-white" />
          </div>
          <Button size="sm" className="ml-auto" onClick={openNew}><Plus className="h-4 w-4" />Nuevo usuario</Button>
        </div>
        {list.length === 0 ? <EmptyState className="m-4 border-0" icon={<UsersRound className="h-6 w-6" />} title="Sin usuarios" /> : (
          <ul className="divide-y divide-line-soft">
            {list.map((u, i) => (
              <motion.li key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                className={cn("flex flex-col gap-3 px-4 py-4 sm:px-5 lg:flex-row lg:items-center", !u.active && "bg-slate-50/70 opacity-70")}>
                <div className="flex min-w-0 items-center gap-3 lg:w-[300px]">
                  <Avatar name={u.full_name} color={u.avatar_color} size={42} />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-ink">{u.full_name}{u.is_holding_admin && <Crown className="h-3.5 w-3.5 text-warn-500" aria-label="Gerencia General" />}</p>
                    <p className="truncate text-xs text-ink-muted">{u.email}</p>
                    <p className="truncate text-[11px] text-ink-muted">{u.position ?? "—"}</p>
                  </div>
                </div>
                <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                  {u.is_holding_admin && <Badge tone="navy">Gerencia General · todo el holding</Badge>}
                  {u.access.map((a) => {
                    const c = company(a.company_id);
                    const obras = a.all_projects ? "todas las obras" : projects.filter((p) => a.project_ids.includes(p.id)).map((p) => p.code).join(", ");
                    return (
                      <span key={a.company_id} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-blue-50 px-2.5 py-1 text-[11px] text-brand-blue ring-1 ring-brand-blue/10">
                        <b className="rounded-md bg-navy-900 px-1.5 text-white">{c?.code}</b>
                        <span className="font-semibold">{a.role ? ROLE_LABEL[a.role] : ""}</span>
                        <span className="text-ink-muted">· {obras || "sin obras"}</span>
                      </span>
                    );
                  })}
                  {!u.is_holding_admin && !u.access.length && <Badge tone="amber">Sin accesos</Badge>}
                </div>
                <div className="flex shrink-0 items-center justify-between gap-2 lg:justify-end">
                  <span suppressHydrationWarning className="text-[11px] text-ink-muted lg:mr-2 lg:w-24 lg:text-right">{u.active ? (u.last_seen_at ? `Visto ${timeAgo(u.last_seen_at)}` : "Nunca ingresó") : <Badge tone="red">Inactivo</Badge>}</span>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(u)} className="rounded-lg p-2 text-ink-muted hover:bg-brand-blue-50 hover:text-brand-blue" title="Editar accesos"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => setPwd({ user: u, value: genPassword() })} className="rounded-lg p-2 text-ink-muted hover:bg-warn-50 hover:text-[#9a5200]" title="Restablecer contraseña"><KeyRound className="h-4 w-4" /></button>
                    <button onClick={() => toggleActive(u)} disabled={u.id === me || busy === u.id} title={u.active ? "Desactivar" : "Reactivar"}
                      className={cn("rounded-lg p-2 disabled:opacity-30", u.active ? "text-ink-muted hover:bg-danger-50 hover:text-danger" : "text-brand-green-700 hover:bg-ok-50")}>
                      {busy === u.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={!!form} onOpenChange={(o) => !o && setForm(null)} size="lg" title={form?.id ? "Editar usuario y accesos" : "Nuevo usuario"}
        description="Un usuario solo podrá ingresar a las empresas que le asignes aquí."
        footer={<><Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button><Button onClick={submit} disabled={saving}>{saving && <LoaderCircle className="h-4 w-4 animate-spin" />}{form?.id ? "Guardar cambios" : "Crear usuario"}</Button></>}>
        {form && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombres y apellidos" required><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
              <Field label="Correo corporativo" required><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nombre@grupocruz.pe" /></Field>
              <Field label="Cargo"><Input value={form.position ?? ""} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="Ingeniero Residente" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="DNI"><Input inputMode="numeric" maxLength={8} value={form.dni ?? ""} onChange={(e) => setForm({ ...form, dni: e.target.value.replace(/\D/g, "") })} /></Field>
                <Field label="Celular"><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              </div>
              {!form.id && (
                <Field label="Contraseña inicial" required hint="Compártela de forma segura; podrá cambiarse luego.">
                  <div className="flex gap-2">
                    <Input value={form.password ?? ""} onChange={(e) => setForm({ ...form, password: e.target.value })} className="font-mono" />
                    <Button type="button" variant="outline" size="icon" onClick={() => setForm({ ...form, password: genPassword() })} aria-label="Generar"><RefreshCw className="h-4 w-4" /></Button>
                  </div>
                </Field>
              )}
              <Field label="Color de avatar">
                <div className="flex flex-wrap gap-2 pt-1">
                  {COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => setForm({ ...form, avatar_color: c })} className={cn("h-8 w-8 rounded-full ring-2 ring-offset-2 transition", form.avatar_color === c ? "ring-brand-blue" : "ring-transparent")} style={{ background: c }} aria-label={c} />
                  ))}
                </div>
              </Field>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line p-4 transition hover:bg-slate-50">
              <input type="checkbox" checked={form.is_holding_admin} onChange={(e) => setForm({ ...form, is_holding_admin: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[#035AA6]" />
              <span><span className="flex items-center gap-1.5 text-sm font-semibold"><Crown className="h-4 w-4 text-warn-500" />Gerencia General del holding</span>
                <span className="text-xs text-ink-muted">Ve todas las empresas, la vista consolidada y gestiona usuarios.</span></span>
            </label>

            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-ink-muted"><ShieldCheck className="h-4 w-4" />Accesos por empresa</p>
              <div className="space-y-3">
                {form.access.map((a, i) => {
                  const c = company(a.company_id)!;
                  const cps = projects.filter((p) => p.company_id === a.company_id);
                  return (
                    <div key={a.company_id} className={cn("rounded-2xl border p-4 transition", a.role ? "border-brand-blue/30 bg-brand-blue-50/40" : "border-line")}>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy-900 text-xs font-bold text-white">{c.code}</span>
                        <p className="min-w-0 flex-1 text-sm font-semibold">{c.tagline ?? c.name}</p>
                        <Select value={a.role ?? ""} onChange={(e) => setAccess(i, { role: (e.target.value || null) as Role | null })} className="h-9 w-full text-xs sm:w-60">
                          <option value="">Sin acceso</option>
                          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                        </Select>
                      </div>
                      {a.role && (
                        <div className="mt-3 space-y-2">
                          <label className="flex items-center gap-2 text-xs font-medium text-ink-soft">
                            <input type="checkbox" checked={a.all_projects} onChange={(e) => setAccess(i, { all_projects: e.target.checked })} className="h-4 w-4 accent-[#035AA6]" />
                            Todas las obras de la empresa (incluidas las futuras)
                          </label>
                          {!a.all_projects && (
                            cps.length ? (
                              <div className="flex flex-wrap gap-2">
                                {cps.map((p) => {
                                  const on = a.project_ids.includes(p.id);
                                  return (
                                    <button key={p.id} type="button" onClick={() => setAccess(i, { project_ids: on ? a.project_ids.filter((x) => x !== p.id) : [...a.project_ids, p.id] })}
                                      className={cn("rounded-xl px-3 py-1.5 text-xs font-semibold ring-1 transition", on ? "bg-brand-blue text-white ring-brand-blue" : "bg-white text-ink-soft ring-line hover:ring-brand-blue/40")}>
                                      {p.code} <span className={on ? "text-white/70" : "text-ink-muted"}>· {p.short_name}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : <p className="text-xs text-ink-muted">Esta empresa aún no tiene obras.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!pwd} onOpenChange={(o) => !o && setPwd(null)} size="sm" title="Restablecer contraseña" description={pwd ? `Se asignará una nueva contraseña a ${pwd.user.full_name}.` : undefined}
        footer={<><Button variant="ghost" onClick={() => setPwd(null)}>Cancelar</Button><Button onClick={doReset} disabled={!!busy}>{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}Restablecer</Button></>}>
        {pwd && (
          <Field label="Nueva contraseña" hint="Mínimo 8 caracteres.">
            <div className="flex gap-2">
              <Input value={pwd.value} onChange={(e) => setPwd({ ...pwd, value: e.target.value })} className="font-mono" />
              <Button type="button" variant="outline" size="icon" onClick={() => setPwd({ ...pwd, value: genPassword() })} aria-label="Generar"><RefreshCw className="h-4 w-4" /></Button>
            </div>
          </Field>
        )}
      </Modal>
    </div>
  );
}
