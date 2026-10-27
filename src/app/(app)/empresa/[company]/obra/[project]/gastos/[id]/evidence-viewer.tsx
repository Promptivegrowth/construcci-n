"use client";
import { Camera, Download, FileText, MapPin, ZoomIn, ZoomOut } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/ui/dialog";
import { Card, CardBody, CardHeader, cn } from "@/components/ui/primitives";
import { dateTime } from "@/lib/format";

type EvidenceFile = { id: string; url: string | null; name: string; mime: string; lat: number | null; lng: number | null; captured_at: string; size: number | null };

export function EvidenceViewer({ files, isPayroll }: { files: EvidenceFile[]; isPayroll: boolean }) {
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const cur = files[active];
  const isPdf = cur?.mime === "application/pdf";

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Sustento" subtitle={files.length ? `${files.length} archivo(s) · almacenamiento privado` : isPayroll ? "Planilla registrada por Contabilidad" : "Sin sustento adjunto"} icon={<Camera className="h-4 w-4" />} />
      <CardBody>
        {!files.length ? (
          <div className="grid h-56 place-items-center rounded-2xl border border-dashed border-line bg-slate-50 text-center text-sm text-ink-muted">
            <div><FileText className="mx-auto mb-2 h-8 w-8" />{isPayroll ? "El resumen de la planilla se muestra en el detalle." : "Este comprobante no tiene foto ni PDF. No puede aprobarse hasta adjuntarlo."}</div>
          </div>
        ) : (
          <>
            <button type="button" onClick={() => { setZoom(1); setOpen(true); }} className="group relative block w-full overflow-hidden rounded-2xl bg-slate-100">
              {isPdf ? (
                <div className="grid h-80 place-items-center bg-danger-50"><FileText className="h-12 w-12 text-danger-500" /><span className="text-sm font-semibold">Ver PDF</span></div>
              ) : cur?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cur.url} alt={cur.name} className="h-80 w-full object-contain transition duration-500 group-hover:scale-[1.02]" />
              ) : <div className="h-80" />}
              <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-navy-900/80 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur"><ZoomIn className="h-3.5 w-3.5" />Ampliar</span>
            </button>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-muted">
              <span>Capturado {dateTime(cur?.captured_at)}{cur?.size ? ` · ${(cur.size / 1024).toFixed(0)} KB` : ""}</span>
              {cur?.lat ? <a href={`https://maps.google.com/?q=${cur.lat},${cur.lng}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-semibold text-brand-blue"><MapPin className="h-3.5 w-3.5" />{cur.lat.toFixed(5)}, {cur.lng?.toFixed(5)}</a> : <span>Sin GPS</span>}
            </div>
            {files.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {files.map((f, i) => (
                  <button key={f.id} onClick={() => setActive(i)} className={cn("h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-2 transition", i === active ? "ring-brand-blue" : "ring-transparent opacity-70 hover:opacity-100")}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {f.mime === "application/pdf" ? <span className="grid h-full place-items-center bg-danger-50"><FileText className="h-5 w-5 text-danger-500" /></span> : f.url && <img src={f.url} alt="" className="h-full w-full object-cover" />}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </CardBody>
      {cur && (
        <Modal open={open} onOpenChange={setOpen} title={cur.name} description={`Capturado ${dateTime(cur.captured_at)}`} size="xl"
          footer={
            <>
              {!isPdf && <><button onClick={() => setZoom((z) => Math.max(1, z - 0.5))} className="grid h-9 w-9 place-items-center rounded-xl border border-line" aria-label="Alejar"><ZoomOut className="h-4 w-4" /></button>
                <button onClick={() => setZoom((z) => Math.min(4, z + 0.5))} className="grid h-9 w-9 place-items-center rounded-xl border border-line" aria-label="Acercar"><ZoomIn className="h-4 w-4" /></button></>}
              {cur.url && <a href={cur.url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white"><Download className="h-4 w-4" />Descargar</a>}
            </>
          }>
          {isPdf ? (
            cur.url ? <iframe src={cur.url} title={cur.name} className="h-[70vh] w-full rounded-xl border border-line" /> : null
          ) : (
            <div className="scrollbar-thin max-h-[70vh] overflow-auto rounded-xl bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {cur.url && <img src={cur.url} alt={cur.name} style={{ width: `${zoom * 100}%` }} className="mx-auto max-w-none cursor-zoom-in transition-[width] duration-300" onClick={() => setZoom((z) => (z >= 3 ? 1 : z + 1))} />}
            </div>
          )}
        </Modal>
      )}
    </Card>
  );
}
