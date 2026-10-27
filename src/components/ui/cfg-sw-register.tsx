"use client";
import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/** Registra el service worker de la app de campo y ofrece instalarla (beforeinstallprompt). */
export function ServiceWorkerRegister({ showInstall = true }: { showInstall?: boolean }) {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
    try { setHidden(localStorage.getItem("gc-install-dismissed") === "1"); } catch {}
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as InstallEvent); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!showInstall || !deferred || hidden) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-50 flex items-center gap-3 rounded-2xl bg-navy-900 p-3 text-white shadow-pop sm:left-auto sm:right-4 sm:w-96">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-green text-navy-900"><Download className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Instala la app de campo</p>
        <p className="text-[11px] text-white/65">Acceso directo en tu celular y registro sin señal.</p>
      </div>
      <button
        onClick={async () => { await deferred.prompt(); await deferred.userChoice; setDeferred(null); }}
        className="h-9 rounded-xl bg-brand-green px-3 text-xs font-bold text-navy-900">Instalar</button>
      <button onClick={() => { setHidden(true); try { localStorage.setItem("gc-install-dismissed", "1"); } catch {} }} className="rounded-lg p-1 text-white/60" aria-label="Cerrar"><X className="h-4 w-4" /></button>
    </div>
  );
}
