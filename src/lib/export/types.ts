export type ExportColumnType = "text" | "money" | "number" | "date" | "pct" | "int";

export type ExportColumn = { key: string; header: string; type?: ExportColumnType; width?: number };

export type ExportSheet = {
  name: string;
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
  totals?: Record<string, number | string>;
  /** Pares etiqueta/valor que se muestran como tarjetas de resumen */
  summary?: { label: string; value: string; tone?: "blue" | "green" | "red" | "amber" | "navy" }[];
};

export type ExportMeta = {
  filename: string;
  company?: string;
  project?: string;
  user?: string;
  /** Elementos del DOM (gráficos) que se incrustan como imagen en el PDF */
  charts?: (HTMLElement | null)[];
  orientation?: "portrait" | "landscape";
  /** Sustentos (imágenes) anexados al final del PDF, una página por comprobante */
  attachments?: { url: string; label: string }[];
  onProgress?: (done: number, total: number) => void;
};
