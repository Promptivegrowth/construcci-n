import type { Metadata } from "next";
import { RetryButton } from "./retry";

export const metadata: Metadata = { title: "Sin conexión" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-navy-900 px-6 text-center text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/isotipo.png" alt="Grupo Cruz" width={88} height={88} className="rounded-full bg-white/90 p-2" />
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-brand-green">Sin conexión</p>
      <h1 className="mt-2 font-display text-2xl font-semibold">Estás trabajando sin señal</h1>
      <p className="mt-3 max-w-sm text-sm text-white/70">
        Los gastos, asistencias e ingresos de almacén que registres en la app de campo se guardan en tu celular y se sincronizan solos al recuperar la conexión.
      </p>
      <RetryButton />
    </main>
  );
}
