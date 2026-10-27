"use client";
import { Wifi, WifiOff } from "lucide-react";
import { useOnline } from "./use-online";
import { cn } from "@/components/ui/primitives";

export function ConnectionPill() {
  const online = useOnline();
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1",
      online ? "bg-brand-green/15 text-brand-green ring-brand-green/30" : "animate-pulse bg-warn-500/20 text-warn-500 ring-warn-500/40")}>
      {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      <span className="hidden min-[380px]:inline">{online ? "En línea" : "Sin señal"}</span>
    </span>
  );
}
