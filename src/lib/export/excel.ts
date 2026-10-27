"use client";
import type { ExportMeta, ExportSheet } from "./types";

const NAVY = "FF062A4D";
const BLUE = "FF035AA6";
const GREEN = "FF04BF55";
const RED = "FFF21D2F";
const ZEBRA = "FFF4F7FB";
const MONEY = '"S/" #,##0.00;[Red]-"S/" #,##0.00';

async function toBase64(url: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(blob);
  });
}

function stamp() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Libro Excel con la identidad de Grupo Cruz: banda institucional, logo, resumen, tabla con formatos y totales. */
export async function exportExcel(sheets: ExportSheet[], meta: ExportMeta) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Grupo Cruz · Control presupuestal";
  wb.created = new Date();
  const logo = wb.addImage({ base64: await toBase64("/brand/logo-holding.png"), extension: "png" });

  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name.slice(0, 31), {
      views: [{ state: "frozen", ySplit: 0, showGridLines: false }],
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
      headerFooter: { oddFooter: `&L&8Grupo Cruz · ${meta.company ?? ""}&C&8${sheet.title}&R&8Página &P de &N` },
    });
    const ncol = Math.max(sheet.columns.length, 4);
    sheet.columns.forEach((c, i) => {
      ws.getColumn(i + 1).width = c.width ?? (c.type === "money" ? 17 : c.type === "date" ? 12 : c.type === "pct" || c.type === "int" ? 10 : 24);
    });

    // Banda institucional
    for (let r = 1; r <= 4; r++) {
      ws.getRow(r).height = r === 1 ? 6 : 22;
      for (let c = 1; c <= ncol; c++) {
        const cell = ws.getCell(r, c);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: r === 1 ? [RED, BLUE, GREEN][Math.floor(((c - 1) / ncol) * 3)] : "FFFFFFFF" } };
      }
    }
    ws.addImage(logo, { tl: { col: 0.15, row: 1.15 }, ext: { width: 230, height: 62 } });
    const titleCol = Math.min(3, ncol);
    ws.mergeCells(2, titleCol, 2, ncol);
    ws.getCell(2, titleCol).value = sheet.title;
    ws.getCell(2, titleCol).font = { name: "Calibri", size: 16, bold: true, color: { argb: NAVY } };
    ws.getCell(2, titleCol).alignment = { horizontal: "right", vertical: "middle" };
    ws.mergeCells(3, titleCol, 3, ncol);
    ws.getCell(3, titleCol).value = [meta.company, meta.project].filter(Boolean).join(" · ");
    ws.getCell(3, titleCol).font = { size: 10, color: { argb: "FF3D4B5F" } };
    ws.getCell(3, titleCol).alignment = { horizontal: "right" };
    ws.mergeCells(4, titleCol, 4, ncol);
    ws.getCell(4, titleCol).value = `${sheet.subtitle ? `${sheet.subtitle} · ` : ""}Generado el ${stamp()}${meta.user ? ` por ${meta.user}` : ""}`;
    ws.getCell(4, titleCol).font = { size: 9, italic: true, color: { argb: "FF66758A" } };
    ws.getCell(4, titleCol).alignment = { horizontal: "right" };

    let row = 6;
    // Resumen
    if (sheet.summary?.length) {
      const per = Math.max(1, Math.floor(ncol / Math.min(sheet.summary.length, 4)));
      sheet.summary.forEach((s, i) => {
        const r = row + Math.floor(i / 4) * 2;
        const c = 1 + (i % 4) * per;
        const tone = { blue: BLUE, green: "FF035928", red: RED, amber: "FFD97706", navy: NAVY }[s.tone ?? "navy"];
        ws.mergeCells(r, c, r, Math.min(c + per - 1, ncol));
        ws.mergeCells(r + 1, c, r + 1, Math.min(c + per - 1, ncol));
        const l = ws.getCell(r, c);
        l.value = s.label.toUpperCase();
        l.font = { size: 8, bold: true, color: { argb: "FF66758A" } };
        const v = ws.getCell(r + 1, c);
        v.value = s.value;
        v.font = { size: 13, bold: true, color: { argb: tone } };
        [l, v].forEach((x) => {
          x.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
          x.border = { left: { style: "thick", color: { argb: tone } } };
        });
      });
      row += Math.ceil(sheet.summary.length / 4) * 2 + 1;
    }

    // Encabezado de tabla
    const header = ws.getRow(row);
    sheet.columns.forEach((c, i) => {
      const cell = header.getCell(i + 1);
      cell.value = c.header;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
      cell.alignment = { vertical: "middle", horizontal: c.type && c.type !== "text" ? "right" : "left", wrapText: true };
      cell.border = { bottom: { style: "medium", color: { argb: GREEN } } };
    });
    header.height = 28;
    const headerRow = row;
    ws.views = [{ state: "frozen", ySplit: headerRow, showGridLines: false }];

    // Filas
    sheet.rows.forEach((r, idx) => {
      row++;
      const xr = ws.getRow(row);
      sheet.columns.forEach((c, i) => {
        const cell = xr.getCell(i + 1);
        let v = r[c.key] as unknown;
        if (c.type === "date" && typeof v === "string" && v) v = new Date(`${v.slice(0, 10)}T12:00:00`);
        if ((c.type === "money" || c.type === "number" || c.type === "pct" || c.type === "int") && v !== null && v !== undefined && v !== "") v = Number(v);
        cell.value = (v ?? "") as never;
        if (c.type === "money") cell.numFmt = MONEY;
        if (c.type === "number") cell.numFmt = "#,##0.00";
        if (c.type === "int") cell.numFmt = "#,##0";
        if (c.type === "pct") cell.numFmt = "0.0%";
        if (c.type === "date") cell.numFmt = "dd/mm/yyyy";
        cell.font = { size: 10, color: { argb: "FF0F1B2D" } };
        cell.alignment = { vertical: "middle", horizontal: c.type && c.type !== "text" ? "right" : "left" };
        if (idx % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
        cell.border = { bottom: { style: "hair", color: { argb: "FFE2E8F0" } } };
      });
    });
    if (sheet.rows.length) ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow, column: sheet.columns.length } };

    // Totales
    if (sheet.totals) {
      row++;
      const tr = ws.getRow(row);
      sheet.columns.forEach((c, i) => {
        const cell = tr.getCell(i + 1);
        const t = sheet.totals![c.key];
        cell.value = i === 0 && t === undefined ? "TOTAL" : (t ?? "") as never;
        if (c.type === "money" && typeof t === "number") cell.numFmt = MONEY;
        if (c.type === "pct" && typeof t === "number") cell.numFmt = "0.0%";
        if (c.type === "number" && typeof t === "number") cell.numFmt = "#,##0.00";
        cell.font = { bold: true, size: 10, color: { argb: NAVY } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6EEF8" } };
        cell.border = { top: { style: "medium", color: { argb: NAVY } } };
        cell.alignment = { horizontal: c.type && c.type !== "text" ? "right" : "left" };
      });
    }
    row += 2;
    ws.getCell(row, 1).value = "Documento interno y privado de Grupo Cruz. Montos en soles (S/) sin IGV salvo indicación.";
    ws.getCell(row, 1).font = { size: 8, italic: true, color: { argb: "FF66758A" } };
  }

  const buf = await wb.xlsx.writeBuffer();
  download(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${meta.filename}.xlsx`);
}

export function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}
