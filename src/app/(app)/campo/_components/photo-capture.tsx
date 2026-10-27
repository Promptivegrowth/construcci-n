"use client";
import { Camera, ImagePlus, LoaderCircle, MapPin, RefreshCw } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/components/ui/primitives";
import { compressImage, currentPosition, type Geo } from "@/lib/upload";

export type Captured = { blob: Blob; url: string; geo: Geo; at: string };

/** Captura con la cámara trasera, comprime la imagen y adjunta GPS + hora como evidencia. */
export function PhotoCapture({ value, onChange, label = "Fotografiar comprobante", hint, facing = "environment", required }: {
  value: Captured | null; onChange: (c: Captured | null) => void; label?: string; hint?: string; facing?: "environment" | "user"; required?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (file?: File | null) => {
    if (!file) return;
    setBusy(true);
    const [blob, geo] = await Promise.all([compressImage(file, 1600, 0.7), currentPosition(7000)]);
    if (value) URL.revokeObjectURL(value.url);
    onChange({ blob, url: URL.createObjectURL(blob), geo, at: new Date().toISOString() });
    setBusy(false);
  };
  return (
    <div>
      <input ref={ref} type="file" accept="image/*" capture={facing} className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      {value ? (
        <div className="relative overflow-hidden rounded-2xl border border-line bg-navy-950">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value.url} alt="Evidencia" className="max-h-72 w-full object-contain" />
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-2 bg-gradient-to-t from-black/80 to-transparent p-3 text-[11px] text-white">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 backdrop-blur">
              <MapPin className="h-3 w-3" />{value.geo ? `${value.geo.lat.toFixed(5)}, ${value.geo.lng.toFixed(5)} · ±${Math.round(value.geo.accuracy)} m` : "Sin GPS"}
            </span>
            <span className="rounded-full bg-white/15 px-2 py-0.5 backdrop-blur">{new Date(value.at).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })}</span>
            <span className="rounded-full bg-white/15 px-2 py-0.5 backdrop-blur">{Math.round(value.blob.size / 1024)} KB</span>
            <button type="button" onClick={() => ref.current?.click()} className="ml-auto inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-semibold text-navy-900">
              <RefreshCw className="h-3 w-3" />Repetir
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} disabled={busy}
          className={cn("flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition active:scale-[0.99]",
            required ? "border-brand-blue/40 bg-brand-blue-50/60 text-brand-blue" : "border-line bg-white text-ink-soft")}>
          {busy ? <LoaderCircle className="h-8 w-8 animate-spin" /> : facing === "user" ? <ImagePlus className="h-8 w-8" /> : <Camera className="h-8 w-8" />}
          <span className="text-sm font-semibold">{busy ? "Procesando foto y ubicación…" : label}</span>
          {hint && <span className="text-[11px] text-ink-muted">{hint}</span>}
        </button>
      )}
    </div>
  );
}
