"use client";
import type { ExportMeta, ExportSheet } from "./types";

const NAVY: [number, number, number] = [6, 42, 77];
const BLUE: [number, number, number] = [3, 90, 166];
const GREEN: [number, number, number] = [4, 191, 85];
const RED: [number, number, number] = [242, 29, 47];
const INK: [number, number, number] = [15, 27, 45];
const MUTED: [number, number, number] = [102, 117, 138];

const fmtMoney = (n: number) => `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (s: string) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "");

async function imageData(url: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(blob);
  });
}

function cellText(v: unknown, type?: string) {
  if (v === null || v === undefined || v === "") return "";
  if (type === "money") return fmtMoney(Number(v));
  if (type === "number") return Number(v).toLocaleString("es-PE", { maximumFractionDigits: 2 });
  if (type === "int") return Math.round(Number(v)).toLocaleString("es-PE");
  if (type === "pct") return `${(Number(v) * 100).toLocaleString("es-PE", { maximumFractionDigits: 1 })}%`;
  if (type === "date") return fmtDate(String(v));
  return String(v);
}

/** Reporte PDF con la identidad de Grupo Cruz. */
export async function exportPdf(sheets: ExportSheet[], meta: ExportMeta) {
  const [{ jsPDF }, { default: autoTable }, htmlToImage] = await Promise.all([import("jspdf"), import("jspdf-autotable"), import("html-to-image")]);
  const doc = new jsPDF({ orientation: meta.orientation ?? "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const logo = await imageData("/brand/logo-holding-dark.png");
  const now = new Date();
  const stamp = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const header = (title: string, subtitle?: string) => {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, W, 26, "F");
    const third = W / 3;
    doc.setFillColor(...RED); doc.rect(0, 26, third, 1.4, "F");
    doc.setFillColor(...BLUE); doc.rect(third, 26, third, 1.4, "F");
    doc.setFillColor(...GREEN); doc.rect(third * 2, 26, third, 1.4, "F");
    doc.addImage(logo, "PNG", 10, 5.5, 58, 15.5);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold"); doc.setFontSize(15);
    doc.text(title, W - 10, 11.5, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    doc.setTextColor(200, 214, 230);
    doc.text([meta.company, meta.project].filter(Boolean).join("  ·  "), W - 10, 17, { align: "right" });
    if (subtitle) doc.text(subtitle, W - 10, 21.5, { align: "right" });
  };

  let first = true;
  for (const sheet of sheets) {
    if (!first) doc.addPage();
    first = false;
    header(sheet.title, sheet.subtitle);
    let y = 34;

    if (sheet.summary?.length) {
      const n = Math.min(sheet.summary.length, 5);
      const gap = 4;
      const bw = (W - 20 - gap * (n - 1)) / n;
      sheet.summary.forEach((s, i) => {
        const row = Math.floor(i / n);
        const x = 10 + (i % n) * (bw + gap);
        const by = y + row * 20;
        const tone = { blue: BLUE, green: [3, 89, 40] as [number, number, number], red: [200, 16, 46] as [number, number, number], amber: [217, 119, 6] as [number, number, number], navy: NAVY }[s.tone ?? "navy"];
        doc.setFillColor(244, 247, 251);
        doc.roundedRect(x, by, bw, 16, 2, 2, "F");
        doc.setFillColor(...tone);
        doc.rect(x, by, 1.3, 16, "F");
        doc.setFontSize(7); doc.setTextColor(...MUTED); doc.setFont("helvetica", "bold");
        doc.text(doc.splitTextToSize(s.label.toUpperCase(), bw - 6)[0], x + 4, by + 5.5);
        doc.setFontSize(12); doc.setTextColor(...tone);
        doc.text(doc.splitTextToSize(s.value, bw - 6)[0], x + 4, by + 12.5);
      });
      y += Math.ceil(sheet.summary.length / n) * 20 + 2;
    }

    // Gráficos (solo en la primera hoja)
    const charts = (sheet === sheets[0] ? meta.charts ?? [] : []).filter(Boolean) as HTMLElement[];
    if (charts.length) {
      const imgs = await Promise.all(charts.map((el) => htmlToImage.toJpeg(el, { pixelRatio: 2, quality: 0.9, backgroundColor: "#ffffff", cacheBust: true })));
      const cols = Math.min(imgs.length, 2);
      const cw = (W - 20 - 6 * (cols - 1)) / cols;
      let rowH = 0;
      for (let i = 0; i < imgs.length; i++) {
        const el = charts[i];
        const ratio = el.offsetHeight / el.offsetWidth || 0.5;
        const ch = Math.min(cw * ratio, 78);
        const cwAdj = ch / ratio;
        if (i % cols === 0 && i > 0) { y += rowH + 5; rowH = 0; }
        if (y + ch > H - 16) { doc.addPage(); header(sheet.title, sheet.subtitle); y = 34; }
        const x = 10 + (i % cols) * (cw + 6);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, y, cw, ch + 2, 2, 2, "S");
        doc.addImage(imgs[i], "JPEG", x + (cw - cwAdj) / 2, y + 1, cwAdj, ch);
        rowH = Math.max(rowH, ch + 2);
      }
      y += rowH + 6;
    }

    if (sheet.rows.length) {
      const body = sheet.rows.map((r) => sheet.columns.map((c) => cellText(r[c.key], c.type)));
      const foot = sheet.totals
        ? [sheet.columns.map((c, i) => (sheet.totals![c.key] !== undefined ? cellText(sheet.totals![c.key], c.type) : i === 0 ? "TOTAL" : ""))]
        : undefined;
      autoTable(doc, {
        startY: y,
        head: [sheet.columns.map((c) => c.header)],
        body,
        foot,
        theme: "grid",
        margin: { left: 10, right: 10, top: 32, bottom: 16 },
        styles: { font: "helvetica", fontSize: 7.6, cellPadding: 1.9, textColor: INK, lineColor: [226, 232, 240], lineWidth: 0.15, overflow: "linebreak" },
        headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 7.8, lineWidth: 0 },
        footStyles: { fillColor: [230, 238, 248], textColor: NAVY, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [247, 249, 252] },
        columnStyles: Object.fromEntries(sheet.columns.map((c, i) => [i, { halign: c.type && c.type !== "text" ? "right" : "left", ...(c.type === "money" ? { minCellWidth: 23 } : c.type === "date" ? { minCellWidth: 17 } : {}) }])),
        didDrawPage: () => header(sheet.title, sheet.subtitle),
      });
    }
  }

  // Anexos: sustentos fotografiados de cada comprobante
  const att = meta.attachments ?? [];
  if (att.length) {
    const load = async (url: string) => {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        if (!blob.type.startsWith("image/")) return null;
        const data = await new Promise<string>((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsDataURL(blob); });
        const dims = await new Promise<{ w: number; h: number }>((resolve) => { const i = new Image(); i.onload = () => resolve({ w: i.width, h: i.height }); i.onerror = () => resolve({ w: 3, h: 4 }); i.src = data; });
        return { data, ...dims, type: blob.type.includes("png") ? "PNG" : "JPEG" };
      } catch { return null; }
    };
    const queue = att.map((a, i) => ({ ...a, i }));
    const loaded: (Awaited<ReturnType<typeof load>>)[] = new Array(att.length);
    let done = 0;
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const a = queue.shift()!;
        loaded[a.i] = await load(a.url);
        meta.onProgress?.(++done, att.length);
      }
    }));
    const per = (meta.orientation ?? "landscape") === "landscape" ? 2 : 1;
    for (let i = 0; i < att.length; i += per) {
      doc.addPage();
      header("Anexo · Sustentos", `Comprobantes ${i + 1}–${Math.min(i + per, att.length)} de ${att.length}`);
      const cw = (W - 20 - 8 * (per - 1)) / per;
      for (let k = 0; k < per && i + k < att.length; k++) {
        const img = loaded[i + k];
        const x = 10 + k * (cw + 8);
        doc.setFontSize(8); doc.setTextColor(...INK); doc.setFont("helvetica", "bold");
        doc.text(doc.splitTextToSize(`${i + k + 1}. ${att[i + k].label}`, cw)[0], x, 36);
        const maxH = H - 52;
        if (img) {
          const ratio = img.h / img.w;
          let w = cw, h = cw * ratio;
          if (h > maxH) { h = maxH; w = h / ratio; }
          doc.addImage(img.data, img.type, x + (cw - w) / 2, 40, w, h);
        } else {
          doc.setDrawColor(226, 232, 240); doc.rect(x, 40, cw, 40);
          doc.setFont("helvetica", "normal"); doc.text("Sustento en PDF o no disponible para incrustar", x + 4, 60);
        }
      }
    }
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(10, H - 11, W - 10, H - 11);
    doc.setFontSize(7); doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal");
    doc.text(`Grupo Cruz · Plataforma de control presupuestal — Generado el ${stamp}${meta.user ? ` por ${meta.user}` : ""}. Documento interno y privado.`, 10, H - 6.5);
    doc.text(`Página ${i} de ${pages}`, W - 10, H - 6.5, { align: "right" });
  }
  doc.save(`${meta.filename}.pdf`);
}
