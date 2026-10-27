"use client";
import { motion } from "framer-motion";
import { Camera, Clock, MapPin, MapPinCheck, MapPinX, Smartphone, UsersRound } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { DateRangeFilter, FilterBar, UrlSelect } from "@/components/ui/filters";
import { CountUp, FadeIn, Stagger, StaggerItem } from "@/components/ui/motion";
import { Avatar, Badge, ButtonLink, Card, CardBody, CardHeader, EmptyState, PageHeader, cn } from "@/components/ui/primitives";
import { dateShort, number, pct } from "@/lib/format";

export type Mark = {
  id: string; user_id: string; name: string; color: string | null; position: string | null; kind: "entrada" | "salida"; at: string; day: string;
  lat: number | null; lng: number | null; accuracy: number | null; distance: number | null; within: boolean | null; photo: string | null; notes: string | null;
};
type DayRow = {
  id: string; day: string; user_id: string; name: string; color: string | null; position: string | null;
  in: Mark | null; out: Mark | null; hours: number | null; late: boolean; outside: boolean;
};

const hm = (iso: string) => new Date(iso).toLocaleTimeString("es-PE", { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", hour12: false });
const minutesOfDay = (iso: string) => { const [h, m] = hm(iso).split(":").map(Number); return h * 60 + m; };
const LIMIT = 7 * 60 + 30;
const dow = (d: string) => ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][new Date(`${d}T12:00:00`).getDay()];

export function AttendanceView({ marks, users, range, center, radius, projectCode, meta }: {
  marks: Mark[]; users: { value: string; label: string }[]; range: { desde: string; hasta: string };
  center: { lat: number; lng: number } | null; radius: number; projectCode: string;
  meta: { companyName: string; projectLabel: string; userName: string; location: string };
}) {
  const [hover, setHover] = useState<Mark | null>(null);

  const days: DayRow[] = useMemo(() => {
    const map = new Map<string, DayRow>();
    [...marks].reverse().forEach((m) => {
      const k = `${m.day}|${m.user_id}`;
      const r = map.get(k) ?? { id: k, day: m.day, user_id: m.user_id, name: m.name, color: m.color, position: m.position, in: null, out: null, hours: null, late: false, outside: false };
      if (m.kind === "entrada" && !r.in) r.in = m;
      if (m.kind === "salida") r.out = m;
      if (m.within === false) r.outside = true;
      map.set(k, r);
    });
    return [...map.values()].map((r) => ({
      ...r,
      late: r.in ? minutesOfDay(r.in.at) > LIMIT : false,
      hours: r.in && r.out ? (new Date(r.out.at).getTime() - new Date(r.in.at).getTime()) / 3600000 : null,
    })).sort((a, b) => (a.day === b.day ? a.name.localeCompare(b.name) : b.day.localeCompare(a.day)));
  }, [marks]);

  const entries = days.filter((d) => d.in);
  const punctual = entries.filter((d) => !d.late).length;
  const outside = marks.filter((m) => m.within === false).length;
  const people = new Set(marks.map((m) => m.user_id)).size;
  const withHours = days.filter((d) => d.hours);
  const avgHours = withHours.length ? withHours.reduce((s, d) => s + (d.hours ?? 0), 0) / withHours.length : 0;

  const byPerson = useMemo(() => {
    const m = new Map<string, { name: string; color: string | null; position: string | null; days: number; late: number; out: number }>();
    days.forEach((d) => {
      const r = m.get(d.user_id) ?? { name: d.name, color: d.color, position: d.position, days: 0, late: 0, out: 0 };
      if (d.in) r.days++;
      if (d.late) r.late++;
      if (d.outside) r.out++;
      m.set(d.user_id, r);
    });
    return [...m.values()].sort((a, b) => b.days - a.days);
  }, [days]);

  // Plano de marcaciones (proyección equirectangular local en metros)
  const plot = useMemo(() => {
    if (!center) return null;
    const pts = marks.filter((m) => m.lat !== null && m.lng !== null).map((m) => ({
      m,
      x: (m.lng! - center.lng) * 111320 * Math.cos((center.lat * Math.PI) / 180),
      y: -(m.lat! - center.lat) * 111320,
    }));
    const maxD = Math.max(radius * 1.4, ...pts.map((p) => Math.hypot(p.x, p.y))) * 1.08;
    return { pts, scale: 150 / maxD, maxD };
  }, [marks, center, radius]);

  const cols: Column<DayRow & Record<string, unknown>>[] = [
    { key: "day", header: "Fecha", type: "date", value: (r) => r.day, cell: (r) => <span className="whitespace-nowrap"><span className="font-semibold text-ink">{dow(r.day)}</span> <span className="text-ink-soft">{dateShort(r.day)}</span></span> },
    { key: "name", header: "Personal", className: "min-w-[200px]", value: (r) => r.name,
      cell: (r) => <span className="flex items-center gap-2.5"><Avatar name={r.name} color={r.color} size={30} /><span className="leading-tight"><span className="block font-semibold text-ink">{r.name}</span><span className="text-[11px] text-ink-muted">{r.position}</span></span></span> },
    { key: "in", header: "Entrada", value: (r) => (r.in ? hm(r.in.at) : ""), cell: (r) => r.in ? <span className={cn("num font-semibold", r.late ? "text-[#9a5200]" : "text-brand-green-700")}>{hm(r.in.at)}{r.late && <span className="ml-1 text-[10px] font-medium">tarde</span>}</span> : <span className="text-ink-muted">—</span> },
    { key: "out", header: "Salida", value: (r) => (r.out ? hm(r.out.at) : ""), cell: (r) => r.out ? <span className="num font-semibold text-ink">{hm(r.out.at)}</span> : <span className="text-[11px] text-ink-muted">Sin salida</span> },
    { key: "hours", header: "Horas", type: "number", value: (r) => (r.hours ? Math.round(r.hours * 10) / 10 : 0), cell: (r) => (r.hours ? `${number(r.hours, 1)} h` : "—") },
    { key: "distance", header: "Distancia", type: "number", hideSm: true, value: (r) => Math.round(Math.max(r.in?.distance ?? 0, r.out?.distance ?? 0)),
      cell: (r) => <span className="num text-ink-soft">{number(Math.max(r.in?.distance ?? 0, r.out?.distance ?? 0), 0)} m</span> },
    { key: "geo", header: "Geocerca", value: (r) => (r.outside ? "Fuera" : "Dentro"),
      cell: (r) => r.outside ? <Badge tone="red">Fuera de la geocerca</Badge> : <Badge tone="green">Dentro</Badge> },
    { key: "photo", header: "", sortable: false, exportable: false, cell: (r) => (r.in?.photo || r.out?.photo) ? <a href={(r.in?.photo || r.out?.photo)!} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}><Camera className="h-4 w-4 text-brand-blue" /></a> : null },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`${projectCode} · Campo`} title="Control de asistencia"
        description={`Marcaciones de entrada y salida del personal clave con validación de distancia a la obra (geocerca de ${radius} m).`}
        actions={<ButtonLink variant="success" href="/campo"><Smartphone className="h-4 w-4" />Marcar desde el celular</ButtonLink>} />

      <FilterBar>
        <DateRangeFilter />
        <UrlSelect name="usuario" placeholder="Todo el personal" options={users} />
      </FilterBar>

      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { l: "Jornadas registradas", v: entries.length, s: `${people} personas · ${dateShort(range.desde)} – ${dateShort(range.hasta)}`, I: UsersRound, t: "bg-brand-blue-50 text-brand-blue", f: "int" as const },
          { l: "Puntualidad (entrada ≤ 07:30)", v: entries.length ? punctual / entries.length : 0, s: `${entries.length - punctual} llegadas tarde`, I: Clock, t: "bg-ok-50 text-brand-green-700", f: "pct" as const },
          { l: "Marcaciones fuera de geocerca", v: outside, s: `${pct(marks.length ? outside / marks.length : 0)} del total de marcaciones`, I: MapPinX, t: outside ? "bg-danger-50 text-danger" : "bg-ok-50 text-brand-green-700", f: "int" as const },
          { l: "Horas promedio por jornada", v: avgHours, s: `${withHours.length} jornadas con entrada y salida`, I: MapPinCheck, t: "bg-navy-900 text-white", f: "number" as const },
        ].map((k) => (
          <StaggerItem key={k.l}>
            <Card className="h-full p-5">
              <div className="flex items-start justify-between gap-2"><p className="text-xs font-medium text-ink-muted">{k.l}</p><span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", k.t)}><k.I className="h-4 w-4" /></span></div>
              <p className="mt-2 font-display text-2xl font-semibold"><CountUp value={k.v} format={k.f} />{k.f === "number" && <span className="ml-1 text-base text-ink-muted">h</span>}</p>
              <p className="mt-1 text-[11px] text-ink-muted">{k.s}</p>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>

      {!marks.length ? (
        <EmptyState icon={<MapPin className="h-6 w-6" />} title="Sin marcaciones en el periodo" description="El personal clave marca su entrada y salida desde la app de campo; la ubicación se valida contra la geocerca de la obra."
          action={<ButtonLink href="/campo" variant="success"><Smartphone className="h-4 w-4" />Abrir app de campo</ButtonLink>} />
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-5">
            <FadeIn className="xl:col-span-2">
              <Card className="h-full">
                <CardHeader title="Plano de marcaciones" subtitle={meta.location || "Ubicación de cada marcación respecto al centro de la obra"} icon={<MapPin className="h-4 w-4" />} />
                <CardBody>
                  {plot ? (
                    <div className="relative mx-auto aspect-square w-full max-w-[380px]">
                      <svg viewBox="-170 -170 340 340" className="h-full w-full">
                        <defs>
                          <radialGradient id="geo" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#04bf55" stopOpacity="0.22" /><stop offset="100%" stopColor="#04bf55" stopOpacity="0.06" /></radialGradient>
                          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#eef2f7" strokeWidth="1" /></pattern>
                        </defs>
                        <rect x="-170" y="-170" width="340" height="340" fill="url(#grid)" rx="16" />
                        {[0.25, 0.5, 0.75, 1].map((f) => <circle key={f} r={150 * f} fill="none" stroke="#e2e8f0" strokeDasharray="3 4" />)}
                        <motion.circle r={radius * plot.scale} fill="url(#geo)" stroke="#0a9f4c" strokeWidth="2" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
                        <text x="0" y={-radius * plot.scale - 6} textAnchor="middle" fontSize="10" fill="#035928" fontWeight="700">Geocerca {radius} m</text>
                        {plot.pts.map(({ m, x, y }, i) => (
                          <motion.circle key={m.id} cx={x * plot.scale} cy={y * plot.scale} r={hover?.id === m.id ? 7 : 4.5}
                            fill={m.within === false ? "#f21d2f" : m.kind === "entrada" ? "#035aa6" : "#7c3aed"} stroke="#fff" strokeWidth="1.5"
                            initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 0.9, scale: 1 }} transition={{ delay: 0.4 + Math.min(i, 60) * 0.012 }}
                            onMouseEnter={() => setHover(m)} onMouseLeave={() => setHover(null)} className="cursor-pointer" />
                        ))}
                        <g>
                          <rect x="-9" y="-9" width="18" height="18" rx="4" fill="#062a4d" />
                          <path d="M-4 3 L0 -4 L4 3 Z" fill="#04bf55" />
                        </g>
                        <text x={150 * 0.5 + 4} y="-4" fontSize="9" fill="#94a3b8">{number(plot.maxD * 0.5 / 1.08, 0)} m</text>
                      </svg>
                      {hover && (
                        <div className="pointer-events-none absolute left-1/2 top-2 w-60 -translate-x-1/2 rounded-xl border border-line bg-white/95 p-3 text-xs shadow-pop backdrop-blur">
                          <p className="font-semibold text-ink">{hover.name}</p>
                          <p className="text-ink-muted">{hover.kind === "entrada" ? "Entrada" : "Salida"} · {dateShort(hover.day)} {hm(hover.at)}</p>
                          <p className={cn("mt-1 font-semibold", hover.within === false ? "text-danger" : "text-brand-green-700")}>{number(hover.distance ?? 0, 0)} m de la obra{hover.accuracy ? ` · ±${number(hover.accuracy, 0)} m` : ""}</p>
                        </div>
                      )}
                    </div>
                  ) : <p className="py-16 text-center text-sm text-ink-muted">La obra no tiene coordenadas configuradas.</p>}
                  <div className="mt-3 flex flex-wrap justify-center gap-4 text-[11px] font-medium text-ink-soft">
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-brand-blue" />Entrada</span>
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-violet-600" />Salida</span>
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-danger-500" />Fuera de geocerca</span>
                  </div>
                </CardBody>
              </Card>
            </FadeIn>
            <FadeIn delay={0.06} className="xl:col-span-3">
              <Card className="h-full">
                <CardHeader title="Resumen por persona" subtitle="Jornadas, tardanzas y marcaciones fuera de la geocerca" />
                <CardBody className="space-y-3">
                  {byPerson.map((p) => (
                    <div key={p.name} className="flex items-center gap-3 rounded-xl border border-line-soft p-3">
                      <Avatar name={p.name} color={p.color} size={38} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-ink">{p.name}</p>
                        <p className="truncate text-[11px] text-ink-muted">{p.position}</p>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                          <motion.div className="h-full rounded-full bg-[linear-gradient(90deg,#035aa6,#0a9f4c)]" initial={{ width: 0 }} whileInView={{ width: `${p.days ? ((p.days - p.late) / p.days) * 100 : 0}%` }} viewport={{ once: true }} transition={{ duration: 1 }} />
                        </div>
                      </div>
                      <div className="grid shrink-0 grid-cols-3 gap-3 text-center">
                        <div><p className="num font-display text-lg font-semibold text-ink">{p.days}</p><p className="text-[10px] text-ink-muted">jornadas</p></div>
                        <div><p className={cn("num font-display text-lg font-semibold", p.late ? "text-[#9a5200]" : "text-ink")}>{p.late}</p><p className="text-[10px] text-ink-muted">tardanzas</p></div>
                        <div><p className={cn("num font-display text-lg font-semibold", p.out ? "text-danger" : "text-ink")}>{p.out}</p><p className="text-[10px] text-ink-muted">fuera</p></div>
                      </div>
                    </div>
                  ))}
                  <p className="text-[11px] text-ink-muted">La barra indica el porcentaje de jornadas con entrada puntual (hasta las 07:30). <Link href="/campo" className="font-semibold text-brand-blue">Marcar asistencia →</Link></p>
                </CardBody>
              </Card>
            </FadeIn>
          </div>

          <Card>
            <CardHeader title="Detalle diario" subtitle="Entrada, salida, horas trabajadas y validación de ubicación" />
            <div className="mt-3">
              <DataTable rows={days as (DayRow & Record<string, unknown>)[]} columns={cols} pageSize={15} dense searchPlaceholder="Buscar persona…"
                rowClassName={(r) => (r.outside ? "bg-danger-50/40" : undefined)}
                exportSheet={{ name: "Asistencia", title: "Control de asistencia del personal clave", subtitle: `${dateShort(range.desde)} – ${dateShort(range.hasta)} · geocerca ${radius} m`,
                  summary: [{ label: "Jornadas", value: String(entries.length), tone: "blue" }, { label: "Puntualidad", value: pct(entries.length ? punctual / entries.length : 0), tone: "green" }, { label: "Fuera de geocerca", value: String(outside), tone: outside ? "red" : "green" }] }}
                exportMeta={{ filename: `Asistencia_${projectCode}`, company: meta.companyName, project: meta.projectLabel, user: meta.userName }} />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
