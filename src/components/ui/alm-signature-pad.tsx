"use client";
import { Eraser, PenLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "./primitives";

/**
 * Firma en pantalla (táctil y mouse). Entrega un PNG en data URL cada vez que el trazo termina.
 * Se usa en los cargos de entrega y devolución de equipos.
 */
export function SignaturePad({ onChange, className, label = "Firma del trabajador" }: { onChange: (dataUrl: string | null) => void; className?: string; label?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const rect = c.getBoundingClientRect();
      c.width = rect.width * ratio;
      c.height = rect.height * ratio;
      const ctx = c.getContext("2d")!;
      ctx.scale(ratio, ratio);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#0b2545";
      ctx.lineWidth = 2.4;
      setEmpty(true);
      onChange(null);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    canvas.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
    const ctx = canvas.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.arc(last.current.x, last.current.y, 1.1, 0, Math.PI * 2);
    ctx.fillStyle = "#0b2545";
    ctx.fill();
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return;
    const p = point(e);
    const ctx = canvas.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    const mx = (last.current.x + p.x) / 2, my = (last.current.y + p.y) / 2;
    ctx.quadraticCurveTo(last.current.x, last.current.y, mx, my);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    setEmpty(false);
    onChange(canvas.current!.toDataURL("image/png"));
  };
  const clear = () => {
    const c = canvas.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setEmpty(true);
    onChange(null);
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft"><PenLine className="h-3.5 w-3.5" />{label} <span className="text-danger-500">*</span></span>
        <button type="button" onClick={clear} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-ink-muted hover:bg-line-soft hover:text-ink">
          <Eraser className="h-3.5 w-3.5" /> Limpiar
        </button>
      </div>
      <div className="relative h-40 overflow-hidden rounded-xl border-2 border-dashed border-line bg-[linear-gradient(transparent_calc(100%-38px),#e2e8f0_calc(100%-38px),#e2e8f0_calc(100%-37px),transparent_calc(100%-37px))] bg-white">
        <canvas ref={canvas} className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} onPointerCancel={up} />
        {empty && <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-xs text-ink-muted/70">Firme aquí con el dedo o el mouse</p>}
      </div>
    </div>
  );
}
