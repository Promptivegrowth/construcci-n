"use client";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Download, FileSpreadsheet, FileText, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { ExportMeta, ExportSheet } from "@/lib/export/types";
import { Button } from "./primitives";

/** Botón con menú para exportar a Excel o PDF con la marca. `build` arma las hojas al momento de exportar. */
export function ExportMenu({ build, meta, label = "Exportar", size = "md" }: {
  build: () => ExportSheet[] | Promise<ExportSheet[]>;
  meta: ExportMeta | (() => ExportMeta);
  label?: string;
  size?: "sm" | "md";
}) {
  const [busy, setBusy] = useState<null | "xlsx" | "pdf">(null);
  const run = async (kind: "xlsx" | "pdf") => {
    setBusy(kind);
    const t = toast.loading(kind === "xlsx" ? "Generando Excel…" : "Generando PDF con gráficos…");
    try {
      const sheets = await build();
      const m = typeof meta === "function" ? meta() : meta;
      if (kind === "xlsx") await (await import("@/lib/export/excel")).exportExcel(sheets, m);
      else await (await import("@/lib/export/pdf")).exportPdf(sheets, m);
      toast.success(kind === "xlsx" ? "Excel descargado" : "PDF descargado", { id: t, description: `${m.filename}.${kind === "xlsx" ? "xlsx" : "pdf"}` });
    } catch (e) {
      console.error(e);
      toast.error("No se pudo generar el archivo", { id: t, description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  };
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline" size={size} disabled={!!busy}>
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {label}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-52 rounded-xl border border-line bg-white p-1.5 shadow-pop data-[state=open]:animate-fade-up">
          <DropdownMenu.Item onSelect={() => run("xlsx")} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-ok-50">
            <FileSpreadsheet className="h-4 w-4 text-brand-green-600" />
            <div><p className="font-semibold text-ink">Excel (.xlsx)</p><p className="text-[11px] text-ink-muted">Con filtros y formatos</p></div>
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => run("pdf")} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-danger-50">
            <FileText className="h-4 w-4 text-danger-500" />
            <div><p className="font-semibold text-ink">PDF ejecutivo</p><p className="text-[11px] text-ink-muted">Con gráficos y la marca</p></div>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
