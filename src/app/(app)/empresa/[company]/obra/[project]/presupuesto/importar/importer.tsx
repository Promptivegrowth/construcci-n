"use client";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, LoaderCircle, OctagonAlert, UploadCloud, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge, Button, Card, CardBody, CardHeader, cn } from "@/components/ui/primitives";
import { COST_TYPE_LABEL } from "@/lib/calc";
import { download } from "@/lib/export/excel";
import { money } from "@/lib/format";
import { importBudget, type ImportRow } from "../actions";

type Parsed = ImportRow & { row: number; errors: string[]; warnings: string[] };
const HEADERS = ["Código WBS", "Descripción", "Nivel", "Código padre", "Fase", "Centro de costo", "Tipo de costo", "Presupuesto (S/ sin IGV)", "Margen (S/)"];
const TYPE_KEYS = Object.keys(COST_TYPE_LABEL);
const EXAMPLE: (string | number)[][] = [
  ["WBS-01", "SEGURIDAD", 1, "", "", "", "", "", ""],
  ["WBS-01.01", "Exámenes médicos ocupacionales (EMO)", 2, "WBS-01", "", "1080", "seguridad", 25000, 0],
  ["WBS-01.02", "Equipos de protección personal (EPP)", 2, "WBS-01", "", "1090", "seguridad", 40000, 0],
  ["WBS-01.03", "SCTR", 2, "WBS-01", "", "1085", "seguridad", 15000, 0],
  ["WBS-03", "OBRAS PRELIMINARES", 1, "", "", "", "", "", ""],
  ["WBS-03.01", "Sótanos", 2, "WBS-03", "F1", "", "servicios", 85000, 5000],
  ["WBS-04", "OBRAS CIVILES", 1, "", "", "", "", "", ""],
  ["WBS-04.01", "Sótanos", 2, "WBS-04", "F1", "", "", "", ""],
  ["WBS-04.01.01", "Mano de obra", 3, "WBS-04.01", "F1", "1020", "mano_obra", 105000, 0],
  ["WBS-04.01.02", "Alquileres", 3, "WBS-04.01", "F1", "1040", "alquileres", 55000, 0],
  ["WBS-04.01.03", "Materiales", 3, "WBS-04.01", "F1", "1060", "materiales", 90000, 0],
];

export function Importer({ companyCode, projectCode, projectName, existing, phases, hasMovements }: {
  companyCode: string; projectCode: string; projectName: string; existing: { code: string; level: number }[]; phases: { code: string; name: string }[]; hasMovements: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<string | null>(null);
  const [rows, setRows] = useState<Parsed[]>([]);
  const [drag, setDrag] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [pending, start] = useTransition();

  const template = async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Presupuesto");
    ws.addRow(HEADERS);
    EXAMPLE.forEach((r) => ws.addRow(r));
    ws.getRow(1).eachCell((c) => {
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF062A4D" } };
      c.alignment = { wrapText: true, vertical: "middle" };
    });
    ws.getRow(1).height = 30;
    [16, 42, 8, 16, 8, 14, 16, 20, 14].forEach((w, i) => (ws.getColumn(i + 1).width = w));
    ws.getColumn(8).numFmt = '"S/" #,##0.00';
    ws.getColumn(9).numFmt = '"S/" #,##0.00';
    ws.views = [{ state: "frozen", ySplit: 1 }];
    const help = wb.addWorksheet("Instrucciones");
    [
      "PLANTILLA ESTÁNDAR DE PRESUPUESTO — GRUPO CRUZ",
      "1. Un WBS por fila. Hasta 3 niveles (1, 2 y 3). Los códigos deben ser únicos.",
      "2. 'Código padre' es obligatorio para niveles 2 y 3 y debe existir en el archivo.",
      "3. El presupuesto se coloca SOLO en las partidas de último nivel (sin hijos). Los niveles superiores acumulan.",
      `4. Fase: código de fase (${phases.map((f) => f.code).join(", ") || "F1, F2, F3, F4"}). Si no existe se creará.`,
      `5. Tipo de costo: ${TYPE_KEYS.join(", ")}.`,
      "6. Montos en soles sin IGV. Margen = margen objetivo; Monto meta = presupuesto − margen.",
    ].forEach((t, i) => { help.addRow([t]); if (!i) help.getRow(1).font = { bold: true, size: 13, color: { argb: "FF035AA6" } }; });
    help.getColumn(1).width = 110;
    const buf = await wb.xlsx.writeBuffer();
    download(new Blob([buf]), "Plantilla_presupuesto_GrupoCruz.xlsx");
    toast.success("Plantilla descargada");
  };

  const parse = async (f: File) => {
    setParsing(true);
    setFile(f.name);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await f.arrayBuffer());
      const ws = wb.worksheets[0];
      const cellVal = (v: unknown): string => {
        if (v === null || v === undefined) return "";
        if (typeof v === "object" && v && "result" in v) return String((v as { result: unknown }).result ?? "");
        if (typeof v === "object" && v && "richText" in v) return (v as { richText: { text: string }[] }).richText.map((t) => t.text).join("");
        return String(v);
      };
      const header = (ws.getRow(1).values as unknown[]).slice(1).map((h) => cellVal(h).toLowerCase());
      const idx = (...keys: string[]) => header.findIndex((h) => keys.some((k) => h.includes(k))) + 1;
      const col = { code: idx("código wbs", "codigo wbs", "wbs"), name: idx("descrip", "nombre", "partida"), level: idx("nivel"), parent: idx("padre"), phase: idx("fase"),
        cc: idx("centro"), type: idx("tipo"), budget: idx("presupuesto", "ppto", "monto"), margin: idx("margen") };
      if (!col.code || !col.name) throw new Error("No se encontraron las columnas 'Código WBS' y 'Descripción'. Usa la plantilla estándar.");
      const out: Parsed[] = [];
      ws.eachRow((r, n) => {
        if (n === 1) return;
        const g = (c: number) => (c ? cellVal(r.getCell(c).value).trim() : "");
        const code = g(col.code);
        if (!code) return;
        const num = (s: string) => Number(s.replace(/[^\d.-]/g, "")) || 0;
        out.push({ row: n, code, name: g(col.name), level: Number(g(col.level)) || code.split(".").length, parent: g(col.parent) || null,
          phase: g(col.phase) || null, costCenter: g(col.cc) || null, costType: g(col.type).toLowerCase().replace(/\s+/g, "_") || null,
          budget: num(g(col.budget)), margin: num(g(col.margin)), errors: [], warnings: [] });
      });
      // Validaciones fila por fila
      const codes = new Map<string, number>();
      out.forEach((r) => codes.set(r.code, (codes.get(r.code) ?? 0) + 1));
      const levelOf = new Map(out.map((r) => [r.code, r.level]));
      existing.forEach((e) => { if (!levelOf.has(e.code)) levelOf.set(e.code, e.level); });
      const phaseCodes = new Set(phases.map((f) => f.code.toUpperCase()));
      for (const r of out) {
        if ((codes.get(r.code) ?? 0) > 1) r.errors.push("Código duplicado en el archivo");
        if (!r.name) r.errors.push("Falta la descripción");
        if (r.level < 1 || r.level > 3) r.errors.push("El nivel debe ser 1, 2 o 3");
        if (r.level > 1 && !r.parent) r.errors.push("Falta el código padre");
        if (r.parent && !levelOf.has(r.parent)) r.errors.push(`El padre ${r.parent} no existe`);
        if (r.parent && levelOf.has(r.parent) && levelOf.get(r.parent)! !== r.level - 1) r.errors.push(`Nivel inconsistente con el padre (${levelOf.get(r.parent)})`);
        if (r.level === 1 && r.parent) r.errors.push("Un nivel 1 no lleva padre");
        if (r.budget < 0 || r.margin < 0) r.errors.push("Montos negativos");
        if (r.margin > r.budget && r.budget > 0) r.errors.push("El margen supera el presupuesto");
        const hasChildren = out.some((x) => x.parent === r.code);
        if (hasChildren && r.budget > 0) r.warnings.push("Tiene partidas hijas: su monto se calculará como suma");
        if (!hasChildren && !r.budget) r.warnings.push("Partida de último nivel sin presupuesto");
        if (r.phase && !phaseCodes.has(r.phase.toUpperCase())) r.warnings.push(`Se creará la fase ${r.phase}`);
        if (r.costType && !TYPE_KEYS.includes(r.costType)) { r.warnings.push(`Tipo de costo "${r.costType}" no reconocido`); r.costType = null; }
        if (existing.some((e) => e.code === r.code)) r.warnings.push(hasMovements ? "Existe: se versionará el cambio de monto" : "Existe: se reemplazará");
      }
      setRows(out);
      const errs = out.filter((r) => r.errors.length).length;
      if (errs) toast.error(`${errs} fila(s) con errores`, { description: "Corrige el archivo y vuelve a cargarlo." });
      else toast.success(`${out.length} filas válidas`, { description: "Revisa la vista previa y confirma la importación." });
    } catch (e) {
      toast.error("No se pudo leer el archivo", { description: e instanceof Error ? e.message : undefined });
      setRows([]);
    } finally {
      setParsing(false);
    }
  };

  const errors = rows.filter((r) => r.errors.length).length;
  const leafTotal = rows.filter((r) => !rows.some((x) => x.parent === r.code)).reduce((s, r) => s + r.budget, 0);
  const confirm = () => start(async () => {
    const res = await importBudget(companyCode, projectCode, rows.map(({ row: _r, errors: _e, warnings: _w, ...x }) => x));
    if (!res.ok) return void toast.error("La importación falló", { description: res.error });
    toast.success(res.message, { description: `${res.data?.created ?? 0} partidas creadas · ${res.data?.updated ?? 0} montos versionados` });
    router.push(`/empresa/${companyCode}/obra/${projectCode}/presupuesto`);
    router.refresh();
  });

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardBody>
            <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) parse(f); }}
              onClick={() => input.current?.click()}
              className={cn("flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition",
                drag ? "border-brand-blue bg-brand-blue-50" : "border-line hover:border-brand-blue/50 hover:bg-slate-50")}>
              {parsing ? <LoaderCircle className="h-10 w-10 animate-spin text-brand-blue" /> : <motion.div animate={{ y: drag ? -6 : 0 }}><UploadCloud className="h-10 w-10 text-brand-blue" /></motion.div>}
              <p className="mt-3 font-display text-base font-semibold">{file ?? "Arrastra el Excel del presupuesto o haz clic para seleccionarlo"}</p>
              <p className="mt-1 text-xs text-ink-muted">Formato .xlsx · {projectCode} · {projectName}</p>
              <input ref={input} type="file" accept=".xlsx,.xlsm" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) parse(f); e.target.value = ""; }} />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Plantilla estándar" subtitle="Columnas: código WBS, descripción, nivel, padre, fase, centro de costo, tipo de costo, presupuesto y margen" icon={<FileSpreadsheet className="h-4 w-4" />} />
          <CardBody className="space-y-3">
            <Button variant="success" className="w-full" onClick={template}><Download className="h-4 w-4" />Descargar plantilla</Button>
            <div className={cn("rounded-xl p-3 text-xs", hasMovements ? "bg-warn-50 text-[#7a4100]" : "bg-brand-blue-50 text-brand-blue-700")}>
              {hasMovements
                ? "La obra ya tiene comprobantes: se agregarán partidas nuevas y los cambios de monto quedarán versionados como adicionales/deductivos."
                : "La obra no tiene movimientos: la estructura importada reemplazará a la actual."}
            </div>
          </CardBody>
        </Card>
      </div>

      <AnimatePresence>
        {rows.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display font-semibold">Vista previa</p>
                  <Badge tone="blue">{rows.length} filas</Badge>
                  {errors ? <Badge tone="red">{errors} con errores</Badge> : <Badge tone="green">Sin errores</Badge>}
                  <Badge tone="gray">Total hojas {money(leafTotal)}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => { setRows([]); setFile(null); }}><X className="h-4 w-4" />Descartar</Button>
                  <Button onClick={confirm} disabled={!!errors || pending}>{pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Confirmar importación</Button>
                </div>
              </div>
              <div className="scrollbar-thin max-h-[560px] overflow-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wide text-ink-muted">
                    <tr>{["Fila", "WBS", "Descripción", "Niv.", "Padre", "Fase", "CC", "Tipo", "Presupuesto", "Margen", "Validación"].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.row} className={cn("border-t border-line-soft", r.errors.length ? "bg-danger-50/60" : r.warnings.length ? "bg-warn-50/40" : "")}>
                        <td className="px-3 py-2 text-xs text-ink-muted">{r.row}</td>
                        <td className="px-3 py-2 font-semibold" style={{ paddingLeft: 12 + (r.level - 1) * 14 }}>{r.code}</td>
                        <td className="px-3 py-2">{r.name}</td>
                        <td className="px-3 py-2">{r.level}</td>
                        <td className="px-3 py-2 text-xs">{r.parent}</td>
                        <td className="px-3 py-2 text-xs">{r.phase}</td>
                        <td className="px-3 py-2 text-xs">{r.costCenter}</td>
                        <td className="px-3 py-2 text-xs">{r.costType ? COST_TYPE_LABEL[r.costType] : ""}</td>
                        <td className="num whitespace-nowrap px-3 py-2 text-right">{r.budget ? money(r.budget) : "—"}</td>
                        <td className="num whitespace-nowrap px-3 py-2 text-right">{r.margin ? money(r.margin) : "—"}</td>
                        <td className="px-3 py-2 text-xs">
                          {r.errors.map((e) => <p key={e} className="flex items-center gap-1 font-semibold text-danger"><OctagonAlert className="h-3.5 w-3.5 shrink-0" />{e}</p>)}
                          {r.warnings.map((w) => <p key={w} className="flex items-center gap-1 text-[#9a5200]"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{w}</p>)}
                          {!r.errors.length && !r.warnings.length && <span className="flex items-center gap-1 text-brand-green-700"><CheckCircle2 className="h-3.5 w-3.5" />OK</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
