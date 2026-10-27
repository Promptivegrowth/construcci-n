import type { Metadata } from "next";
import { getProjectContext } from "@/lib/session";
import { signedUrls } from "@/lib/storage";
import { supabaseServer } from "@/lib/supabase/server";
import { toNum } from "@/lib/format";
import { AttendanceView, type Mark } from "./_components/attendance-view";

export const metadata: Metadata = { title: "Asistencia" };

const limaDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Lima" });

export default async function AsistenciaPage({ params, searchParams }: {
  params: Promise<{ company: string; project: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { company, project } = await params;
  const sp = await searchParams;
  const ctx = await getProjectContext(company, project);
  const sb = await supabaseServer();

  const today = limaDate(new Date().toISOString());
  const d30 = new Date(Date.now() - 30 * 86400000).toLocaleDateString("en-CA", { timeZone: "America/Lima" });
  const desde = sp.desde ?? d30;
  const hasta = sp.hasta ?? today;

  let q = sb.from("attendance").select("id, user_id, kind, marked_at, lat, lng, accuracy, distance_m, within_geofence, photo_path, notes, user:profiles(full_name, avatar_color, position)")
    .eq("project_id", ctx.project.id)
    .gte("marked_at", `${desde}T00:00:00-05:00`).lte("marked_at", `${hasta}T23:59:59-05:00`)
    .order("marked_at", { ascending: false }).limit(1000);
  if (sp.usuario) q = q.eq("user_id", sp.usuario);
  const [{ data }, { data: people }] = await Promise.all([
    q,
    sb.from("attendance").select("user_id, user:profiles(full_name)").eq("project_id", ctx.project.id).limit(1000),
  ]);
  const photos = await signedUrls((data ?? []).map((m) => m.photo_path));
  const userOptions = [...new Map((people ?? []).map((p) => [p.user_id, (p.user as unknown as { full_name: string } | null)?.full_name ?? "—"])).entries()]
    .map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));

  const marks: Mark[] = (data ?? []).map((m) => {
    const u = m.user as unknown as { full_name: string; avatar_color: string | null; position: string | null } | null;
    return {
      id: m.id, user_id: m.user_id, name: u?.full_name ?? "—", color: u?.avatar_color ?? null, position: u?.position ?? null, kind: m.kind as "entrada" | "salida",
      at: m.marked_at, day: limaDate(m.marked_at), lat: m.lat, lng: m.lng, accuracy: m.accuracy === null ? null : toNum(m.accuracy),
      distance: m.distance_m === null ? null : toNum(m.distance_m), within: m.within_geofence, photo: m.photo_path ? photos.get(m.photo_path) ?? null : null, notes: m.notes,
    };
  });

  return (
    <AttendanceView
      marks={marks}
      users={userOptions}
      range={{ desde, hasta }}
      center={ctx.project.lat && ctx.project.lng ? { lat: ctx.project.lat, lng: ctx.project.lng } : null}
      radius={ctx.project.geofence_radius}
      projectCode={ctx.project.code}
      meta={{ companyName: ctx.company.name, projectLabel: `${ctx.project.code} · ${ctx.project.short_name ?? ctx.project.name}`, userName: ctx.profile.full_name, location: [ctx.project.location, ctx.project.region].filter(Boolean).join(", ") }}
    />
  );
}
