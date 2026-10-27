"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand";

/** Pantalla de carga de marca: se muestra una vez por sesión del navegador. */
export function Preloader() {
  const [show, setShow] = useState(true);
  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem("gc-preloaded") === "1"; } catch {}
    if (seen) { setShow(false); return; }
    const start = Date.now();
    const done = () => {
      const wait = Math.max(0, 1700 - (Date.now() - start));
      setTimeout(() => {
        setShow(false);
        try { sessionStorage.setItem("gc-preloaded", "1"); } catch {}
      }, wait);
    };
    if (document.readyState === "complete") done();
    else window.addEventListener("load", done, { once: true });
    const safety = setTimeout(() => setShow(false), 4500);
    return () => clearTimeout(safety);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div key="pre" className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-navy-900"
          exit={{ opacity: 0, transition: { duration: 0.55, ease: "easeInOut" } }}>
          <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:42px_42px]" />
          <motion.div className="absolute h-[520px] w-[520px] rounded-full bg-brand-blue/30 blur-3xl" animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 3, repeat: Infinity }} />
          <motion.div exit={{ scale: 1.15, opacity: 0 }} transition={{ duration: 0.45 }} className="relative flex flex-col items-center">
            <BrandMark size={112} animated />
            <motion.p className="mt-6 font-display text-3xl font-bold tracking-[0.12em] text-brand-green"
              initial={{ opacity: 0, letterSpacing: "0.5em" }} animate={{ opacity: 1, letterSpacing: "0.12em" }} transition={{ delay: 0.6, duration: 0.8 }}>
              GRUPO CRUZ
            </motion.p>
            <motion.p className="mt-2 text-xs font-medium uppercase tracking-[0.3em] text-white/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
              Control presupuestal de obras
            </motion.p>
            <div className="mt-8 h-1 w-56 overflow-hidden rounded-full bg-white/10">
              <motion.div className="h-full rounded-full bg-[linear-gradient(90deg,#F21D2F,#035AA6,#04BF55)]"
                initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 1.5, ease: [0.65, 0, 0.35, 1] }} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
