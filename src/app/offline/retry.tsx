"use client";

export function RetryButton() {
  return (
    <div className="mt-8 flex flex-col gap-2 sm:flex-row">
      <button onClick={() => location.reload()} className="h-11 rounded-xl bg-brand-green px-5 text-sm font-bold text-navy-900">Reintentar</button>
      <a href="/campo" className="grid h-11 place-items-center rounded-xl border border-white/20 px-5 text-sm font-semibold">Ir a la app de campo</a>
    </div>
  );
}
