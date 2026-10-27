"use client";
import { CalendarRange, FileSpreadsheet, FileText, HardHat, Layers, LayoutDashboard, LoaderCircle, Boxes, ShieldAlert, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Stagger, StaggerItem } from "@/components/ui/motion";
import { Badge, Button, Card, Field, Input, Select, cn } from "@/components/ui/primitives";
import { addDaysISO, todayISO } from "@/lib/format";
import type { ExportSheet } from "@/lib/export/types";
import { kardexReport, laborReport, liquidationReport, periodReport, wbsReport } from "./actions";

type Meta = { company: string; project: string; user: string };
type Kind = "periodo" | "wbs" | "mano" | "kardex" | "liquidacion";

const REPORTS: { kind: Kind; title: string; desc: string; icon: LucideIcon; tone: string; params: ("range" | "wbs" | "cutoff")[] }[] = [
  { kind: "periodo", title: "Reporte quincenal / mensual", desc: "Gasto del periodo por WBS, comprobantes registrados y pagos realizados. Base del reporte mínimo quincenal a Gerencia.", icon: CalendarRange, tone: "bg-brand-blue", params: ["range"] },
  { kind: "wbs", title: "Reporte por WBS", desc: "Un centro de costo con todos sus comprobantes, fase, O/S-O/C, montos con IGV, pagos y estado de conciliación.", icon: Layers, tone: "bg-violet-600", params: ["wbs", "range"] },
  { kind: "mano", title: "Mano de obra", desc: "Matriz de distribución del costo por categoría y fase (proyectado vs. real) y planillas por semana.", icon: HardHat, tone: "bg-[#e07b00]", params: ["range"] },
  { kind: "kardex", title: "Kardex y materiales", desc: "Ingresos, consumos, precio promedio y destino (WBS/frente) de cada material en el periodo.", icon: Boxes, tone: "bg-brand-green-600", params: ["range"] },
  { kind: "liquidacion", title: "Liquidación de gastos de obra", desc: "Todo lo gastado a una fecha de corte agrupado por WBS, con los sustentos anexados en un solo PDF. Para sustentar ante el cliente si la obra se paraliza o se cancela.", icon: ShieldAlert, tone: "bg-danger-500", params: ["cutoff"] },
];

function quincena(offset = 0) {
  const d = new Date();
  let y = d.getFullYear(), m = d.getMonth(), first = d.getDate() <= 15;
  for (let i = 0; i < offset; i++) { if (first) { m--; if (m < 0) { m = 11; y--; } first = false; } else first = true; }
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(y, m + 1, 0).getDate();
  return first ? [`${y}-${pad(m + 1)}-01`, `${y}-${pad(m + 1)}-15`] : [`${y}-${pad(m + 1)}-16`, `${y}-${pad(m + 1)}-${last}`];
}

export function ReportsCenter({ companyCode, projectCode, meta, wbs, start, status }: { companyCode: string; projectCode: string; meta: Meta; wbs: { id: string; label: string }[]; start: string | null; status: string }) {
  const [from, setFrom] = useState(quincena(1)[0]);
  const [to, setTo] = useState(quincena(1)[1]);
  const [wbsId, setWbsId] = useState(wbs[0]?.id ?? "");
  const [cutoff, setCutoff] = useState(todayISO());
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (kind: Kind, format: "xlsx" | "pdf") => {
    setBusy(`${kind}-${format}`);
    const t = toast.loading("Preparando reporte…");
    try {
      const range = { from: from || undefined, to: to || undefined };
      const res = kind === "periodo" ? await periodReport(companyCode, projectCode, range)
        : kind === "wbs" ? await wbsReport(companyCode, projectCode, wbsId, range)
        : kind === "mano" ? await laborReport(companyCode, projectCode, range)
        : kind === "kardex" ? await kardexReport(companyCode, projectCode, range)
        : await liquidationReport(companyCode, projectCode, cutoff);
      if (!res.ok) throw new Error(res.error);
      const name = REPORTS.find((r) => r.kind === kind)!.title.replace(/[^\wáéíóúñ ]/gi, "").replace(/\s+/g, "_");
      const filename = `${name}_${projectCode}_${kind === "liquidacion" ? cutoff : `${from}_${to}`}`;
      if (format === "xlsx") {
        await (await import("@/lib/export/excel")).exportExcel(res.sheets as ExportSheet[], { filename, ...meta });
      } else {
        const att = kind === "liquidacion" ? res.attachments ?? [] : [];
        if (att.length) toast.loading(`Anexando ${att.length} sustentos…`, { id: t });
        await (await import("@/lib/export/pdf")).exportPdf(res.sheets as ExportSheet[], {
          filename, ...meta, attachments: att,
          onProgress: (d, n) => { if (d % 10 === 0 || d === n) toast.loading(`Anexando sustentos ${d}/${n}…`, { id: t }); },
        });
      }
      toast.success("Reporte generado", { id: t, description: `${filename}.${format}` });
    } catch (e) {
      toast.error("No se pudo generar el reporte", { id: t, description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  };

  const presets: [string, () => [string, string]][] = [
    ["Quincena actual", () => quincena(0) as [string, string]],
    ["Quincena anterior", () => quincena(1) as [string, string]],
    ["Este mes", () => { const d = todayISO(); return [`${d.slice(0, 8)}01`, d]; }],
    ["Últimos 30 días", () => [addDaysISO(todayISO(), -30), todayISO()]],
    ["Toda la obra", () => [start ?? "", todayISO()]],
  ];

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Desde" className="w-40"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="Hasta" className="w-40"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <div className="flex flex-wrap gap-1.5 pb-0.5">
            {presets.map(([label, f]) => {
              const [a, b] = f();
              return <button key={label} onClick={() => { setFrom(a); setTo(b); }} className={cn("h-9 rounded-lg px-3 text-xs font-semibold transition", from === a && to === b ? "bg-navy-900 text-white" : "bg-slate-100 text-ink-soft hover:text-ink")}>{label}</button>;
            })}
          </div>
        </div>
      </Card>

      <Card className="flex flex-wrap items-center gap-4 p-5">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-navy-900 text-white"><LayoutDashboard className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold">Reporte ejecutivo de obra</p>
          <p className="text-xs text-ink-muted">Contrato vs. gastado vs. saldo por ejecutar, control por fase, curva S, gasto mensual y CPI, con gráficos. Se genera desde el resumen ejecutivo.</p>
        </div>
        <Link href={`/empresa/${companyCode}/obra/${projectCode}`} className="text-sm font-semibold text-brand-blue hover:underline">Abrir resumen ejecutivo →</Link>
      </Card>

      <Stagger className="grid gap-4 lg:grid-cols-2">
        {REPORTS.map((r) => (
          <StaggerItem key={r.kind}>
            <Card className={cn("flex h-full flex-col p-5", r.kind === "liquidacion" && "border-danger-500/30 lg:col-span-2")}>
              <div className="flex items-start gap-4">
                <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white shadow-sm", r.tone)}><r.icon className="h-5 w-5" /></span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><p className="font-display font-semibold">{r.title}</p>{r.kind === "liquidacion" && status !== "ejecucion" && <Badge tone="red">Recomendado: obra {status}</Badge>}</div>
                  <p className="mt-1 text-xs text-ink-muted">{r.desc}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-1 flex-wrap items-end gap-3">
                {r.params.includes("wbs") && (
                  <Field label="Centro de costo" className="min-w-0 flex-1"><Select value={wbsId} onChange={(e) => setWbsId(e.target.value)}>{wbs.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}</Select></Field>
                )}
                {r.params.includes("cutoff") && <Field label="Fecha de corte" className="w-44"><Input type="date" value={cutoff} onChange={(e) => setCutoff(e.target.value)} /></Field>}
                {r.params.includes("range") && <p className="flex-1 text-[11px] text-ink-muted">Periodo: {from || "inicio"} → {to || "hoy"}</p>}
                <div className="ml-auto flex gap-2">
                  <Button variant="outline" size="sm" disabled={!!busy} onClick={() => run(r.kind, "xlsx")}>
                    {busy === `${r.kind}-xlsx` ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 text-brand-green-600" />}Excel
                  </Button>
                  <Button variant="outline" size="sm" disabled={!!busy} onClick={() => run(r.kind, "pdf")}>
                    {busy === `${r.kind}-pdf` ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4 text-danger-500" />}{r.kind === "liquidacion" ? "PDF con sustentos" : "PDF"}
                  </Button>
                </div>
              </div>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
