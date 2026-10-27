"use client";
import { AnimatePresence, motion } from "framer-motion";
import { CircleCheck, LogOut } from "lucide-react";
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand";

/** Transición animada que informa el inicio o cierre de sesión. */
export function SessionOverlay({ mode, name, role }: { mode: "in" | "out" | null; name?: string; role?: string }) {
  return (
    <AnimatePresence>
      {mode && (
        <motion.div className="fixed inset-0 z-[90] flex items-center justify-center bg-navy-900/95 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="flex flex-col items-center text-center" initial={{ scale: 0.9, y: 10 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", damping: 18 }}>
            <div className="relative">
              <motion.div className="absolute -inset-4 rounded-full border-2 border-brand-green/50" animate={{ rotate: 360 }} transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
                style={{ borderTopColor: "transparent", borderRightColor: "transparent" }} />
              <BrandMark size={84} animated />
            </div>
            {mode === "in" ? (
              <>
                <p className="mt-8 text-xs font-semibold uppercase tracking-[0.25em] text-brand-green">Iniciando sesión</p>
                <p className="mt-2 font-display text-2xl font-semibold text-white">Bienvenido{name ? `, ${name.split(" ")[0]}` : ""}</p>
                {role && <p className="mt-1 text-sm text-white/60">{role}</p>}
                <p className="mt-5 flex items-center gap-2 text-xs text-white/50">Validando accesos por empresa y obra…</p>
              </>
            ) : (
              <>
                <p className="mt-8 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-brand-red"><LogOut className="h-3.5 w-3.5" />Cerrando sesión</p>
                <p className="mt-2 font-display text-2xl font-semibold text-white">Hasta pronto{name ? `, ${name.split(" ")[0]}` : ""}</p>
                <p className="mt-1 text-sm text-white/60">Tu información queda resguardada.</p>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Lee ?bienvenida / ?salida / ?denegado de la URL y muestra el aviso correspondiente una sola vez. */
export function SessionToasts({ name }: { name?: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    const keys = ["bienvenida", "salida", "denegado", "expirada"];
    if (!keys.some((k) => params.has(k))) return;
    if (params.has("bienvenida")) toast.success(`Sesión iniciada${name ? ` · ${name}` : ""}`, { description: "Accesos cargados según tus empresas asignadas.", icon: <CircleCheck className="h-5 w-5 text-brand-green-600" /> });
    if (params.has("salida")) toast("Sesión cerrada correctamente", { description: "Vuelve cuando quieras. Tus registros quedaron sincronizados." });
    if (params.has("expirada")) toast.warning("Tu sesión expiró", { description: "Ingresa nuevamente para continuar." });
    if (params.has("denegado")) toast.error("Acceso restringido", { description: `No perteneces a la empresa ${params.get("denegado")}. Solicita acceso a Gerencia General.` });
    const next = new URLSearchParams(params.toString());
    keys.forEach((k) => next.delete(k));
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [params, router, pathname, name]);
  return null;
}
