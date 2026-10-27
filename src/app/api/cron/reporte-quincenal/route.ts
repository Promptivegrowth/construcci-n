import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizeStats, totals } from "@/lib/calc";
import { money, pct, toNum } from "@/lib/format";

// Reporte quincenal automático a Gerencia (Vercel Cron: días 1 y 16 a las 08:00 de Lima).
// Requiere CRON_SECRET y, para el envío, RESEND_API_KEY + REPORT_FROM_EMAIL. Sin clave de correo
// devuelve el resumen en JSON (útil para verificar).
export const dynamic = "force-dynamic";

function fortnightRange(now = new Date()) {
  const lima = new Date(now.getTime() - 5 * 3600 * 1000);
  const y = lima.getUTCFullYear(), m = lima.getUTCMonth(), d = lima.getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d <= 15) {
    const pm = m === 0 ? 11 : m - 1, py = m === 0 ? y - 1 : y;
    const last = new Date(Date.UTC(py, pm + 1, 0)).getUTCDate();
    return { from: `${py}-${pad(pm + 1)}-16`, to: `${py}-${pad(pm + 1)}-${last}` };
  }
  return { from: `${y}-${pad(m + 1)}-01`, to: `${y}-${pad(m + 1)}-15` };
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const sb = supabaseAdmin();
  const range = fortnightRange();
  const [{ data: companies }, { data: projects }, { data: alerts }, { data: admins }, { data: managers }] = await Promise.all([
    sb.from("companies").select("id, code, tagline"),
    sb.from("projects").select("id, company_id, code, name, alert_threshold").eq("status", "ejecucion"),
    sb.from("alerts").select("project_id, severity, title").eq("resolved", false),
    sb.from("profiles").select("email, full_name").eq("is_holding_admin", true).eq("active", true),
    sb.from("company_members").select("company_id, role, profile:profiles(email, full_name, active)").eq("role", "gerente_proyectos"),
  ]);

  const reports = [];
  for (const p of projects ?? []) {
    const [{ data: stats }, { data: pays }] = await Promise.all([
      sb.from("v_wbs_stats").select("*").eq("project_id", p.id).eq("is_leaf", true),
      sb.from("payments").select("amount_pen, expense:expenses(cost_pen, payable_pen)").eq("project_id", p.id).eq("voided", false).gte("paid_at", range.from).lte("paid_at", range.to),
    ]);
    const t = totals(normalizeStats((stats ?? []) as Record<string, unknown>[]));
    const a = (alerts ?? []).filter((x) => x.project_id === p.id);
    reports.push({
      company: (companies ?? []).find((c) => c.id === p.company_id), code: p.code, name: p.name, budget: t.budget, paid: t.paid, committed: t.committed,
      // Igual que el acumulado (v_wbs_stats): el pago se expresa como costo sin IGV, proporcional a lo pagado del comprobante.
      paidFortnight: (pays ?? []).reduce((s, x) => {
        const e = x.expense as unknown as { cost_pen: number; payable_pen: number } | null;
        const payable = toNum(e?.payable_pen);
        return s + (payable > 0 ? toNum(x.amount_pen) * toNum(e?.cost_pen) / payable : 0);
      }, 0),
      consumption: t.budget ? t.paid / t.budget : 0, threshold: (p.alert_threshold ?? 80) / 100,
      critical: a.filter((x) => x.severity === "danger").map((x) => x.title).slice(0, 5), warnings: a.filter((x) => x.severity === "warning").length,
    });
  }

  const rows = reports.map((r) => `
    <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0"><b>${r.code}</b><br><span style="color:#66758a;font-size:12px">${r.name}</span></td>
    <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">${money(r.budget)}</td>
    <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">${money(r.paidFortnight)}</td>
    <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">${money(r.paid)}</td>
    <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;color:${r.consumption >= 1 ? "#c8102e" : r.consumption >= r.threshold ? "#d97706" : "#035928"};font-weight:700">${pct(r.consumption)}</td></tr>
    ${r.critical.length ? `<tr><td colspan="5" style="padding:4px 8px 10px;font-size:12px;color:#c8102e">⚠ ${r.critical.join(" · ")}</td></tr>` : ""}`).join("");
  const html = `<div style="font-family:Arial,sans-serif;max-width:760px;margin:auto;color:#0f1b2d">
    <div style="background:#062a4d;color:#fff;padding:20px 24px;border-bottom:4px solid #04bf55">
      <div style="font-size:20px;font-weight:700;color:#04bf55;letter-spacing:2px">GRUPO CRUZ</div>
      <div style="font-size:16px;margin-top:6px">Reporte quincenal de control presupuestal</div>
      <div style="font-size:12px;opacity:.7">Periodo ${range.from} al ${range.to}</div></div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:12px">
      <tr style="background:#f3f6fa;font-size:11px;text-transform:uppercase;color:#66758a"><th style="padding:8px;text-align:left">Obra</th><th style="padding:8px;text-align:right">Presupuesto</th><th style="padding:8px;text-align:right">Pagado en la quincena (sin IGV)</th><th style="padding:8px;text-align:right">Pagado acumulado (sin IGV)</th><th style="padding:8px;text-align:right">Consumo</th></tr>
      ${rows}</table>
    <p style="font-size:11px;color:#66758a;margin-top:18px">Documento interno y privado. Ingrese a la plataforma para el detalle por WBS y los comprobantes.</p></div>`;

  const to = new Set<string>();
  (admins ?? []).forEach((a) => to.add(a.email));
  (managers ?? []).forEach((m) => { const pr = m.profile as unknown as { email: string; active: boolean } | null; if (pr?.active) to.add(pr.email); });

  if (!process.env.RESEND_API_KEY || !process.env.REPORT_FROM_EMAIL) {
    return NextResponse.json({ sent: false, reason: "Configure RESEND_API_KEY y REPORT_FROM_EMAIL para enviar el correo", range, recipients: [...to], reports });
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.REPORT_FROM_EMAIL, to: [...to], subject: `Grupo Cruz · Reporte quincenal ${range.from} al ${range.to}`, html }),
  });
  return NextResponse.json({ sent: res.ok, status: res.status, range, recipients: [...to], projects: reports.length });
}
