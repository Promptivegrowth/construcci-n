"use client";
import * as D from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./primitives";

/** Modal centrado (en móviles se ancla abajo como hoja). */
export function Modal({ open, onOpenChange, title, description, children, footer, size = "md" }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: ReactNode; description?: ReactNode;
  children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl";
}) {
  const width = { sm: "sm:max-w-md", md: "sm:max-w-xl", lg: "sm:max-w-3xl", xl: "sm:max-w-5xl" }[size];
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            <D.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-50 bg-navy-950/45 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            </D.Overlay>
            <D.Content asChild forceMount>
              <motion.div
                className={cn("fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-3xl bg-white shadow-pop outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl", width)}
                initial={{ opacity: 0, y: 40, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30, scale: 0.98 }}
                transition={{ type: "spring", damping: 28, stiffness: 320 }}>
                <div className="flex items-start justify-between gap-4 border-b border-line-soft px-6 pb-4 pt-5">
                  <div>
                    <D.Title className="font-display text-lg font-semibold text-ink">{title}</D.Title>
                    {description ? <D.Description className="mt-1 text-sm text-ink-muted">{description}</D.Description> : <D.Description className="sr-only">{String(title)}</D.Description>}
                  </div>
                  <D.Close className="rounded-lg p-1.5 text-ink-muted transition hover:bg-line-soft hover:text-ink" aria-label="Cerrar"><X className="h-5 w-5" /></D.Close>
                </div>
                <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-5">{children}</div>
                {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line-soft bg-slate-50/60 px-6 py-3.5 sm:rounded-b-2xl">{footer}</div>}
              </motion.div>
            </D.Content>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}

/** Panel lateral para detalles. */
export function Drawer({ open, onOpenChange, title, description, children, footer, width = "max-w-xl" }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: ReactNode; description?: ReactNode; children: ReactNode; footer?: ReactNode; width?: string;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            <D.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-50 bg-navy-950/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            </D.Overlay>
            <D.Content asChild forceMount>
              <motion.div className={cn("fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-pop outline-none", width)}
                initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }}>
                <div className="flex items-start justify-between gap-4 border-b border-line-soft px-6 py-5">
                  <div className="min-w-0">
                    <D.Title className="font-display text-lg font-semibold text-ink">{title}</D.Title>
                    {description ? <D.Description className="mt-1 text-sm text-ink-muted">{description}</D.Description> : <D.Description className="sr-only">Detalle</D.Description>}
                  </div>
                  <D.Close className="rounded-lg p-1.5 text-ink-muted hover:bg-line-soft hover:text-ink" aria-label="Cerrar"><X className="h-5 w-5" /></D.Close>
                </div>
                <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-5">{children}</div>
                {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line-soft bg-slate-50/60 px-6 py-3.5">{footer}</div>}
              </motion.div>
            </D.Content>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}
