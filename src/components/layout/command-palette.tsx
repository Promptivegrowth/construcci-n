"use client";
import * as D from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { Building2, ClipboardList, LoaderCircle, Package, Receipt, Search, Truck, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import type { NavSection } from "@/lib/nav";
import { globalSearch, type SearchHit } from "./search-action";
import type { ShellProject } from "./shell";

const HIT_ICON = { comprobante: Receipt, orden: ClipboardList, material: Package, proveedor: Truck, usuario: UserRound };
const HIT_LABEL = { comprobante: "Comprobantes", orden: "Órdenes", material: "Materiales", proveedor: "Proveedores", usuario: "Personas" };

export function CommandPalette({ open, onOpenChange, companyId, companyCode, projects, sections }: {
  open: boolean; onOpenChange: (o: boolean) => void; companyId: string; companyCode: string; projects: ShellProject[]; sections: NavSection[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try { setHits(await globalSearch(companyId, companyCode, q)); } finally { setLoading(false); }
    }, 220);
    return () => clearTimeout(t);
  }, [q, companyId, companyCode]);

  const go = (href: string) => { onOpenChange(false); setQ(""); router.push(href); };
  const grouped = Object.entries(hits.reduce<Record<string, SearchHit[]>>((acc, h) => ((acc[h.type] ??= []).push(h), acc), {}));

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-navy-950/40 backdrop-blur-[2px] data-[state=open]:animate-fade-up" />
        <D.Content className="fixed left-1/2 top-[10vh] z-50 w-[calc(100%-24px)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-2xl border border-line bg-white shadow-pop outline-none">
          <D.Title className="sr-only">Búsqueda global</D.Title>
          <D.Description className="sr-only">Busca obras, pantallas, comprobantes, órdenes, materiales y proveedores</D.Description>
          <Command shouldFilter={false} loop>
            <div className="flex items-center gap-3 border-b border-line px-4">
              {loading ? <LoaderCircle className="h-5 w-5 animate-spin text-brand-blue" /> : <Search className="h-5 w-5 text-ink-muted" />}
              <Command.Input value={q} onValueChange={setQ} autoFocus placeholder="Número de comprobante, RUC, proveedor, orden, material, apellido…"
                className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-muted/70" />
              <kbd className="rounded-md border border-line px-1.5 text-[10px] font-semibold text-ink-muted">ESC</kbd>
            </div>
            <Command.List className="scrollbar-thin max-h-[60vh] overflow-y-auto p-2">
              {q.trim().length >= 2 && !loading && !hits.length && <Command.Empty className="p-8 text-center text-sm text-ink-muted">Sin coincidencias para “{q}”.</Command.Empty>}
              {grouped.map(([type, list]) => {
                const I = HIT_ICON[type as keyof typeof HIT_ICON];
                return (
                  <Command.Group key={type} heading={HIT_LABEL[type as keyof typeof HIT_LABEL]} className="mb-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:text-ink-muted">
                    {list.map((h) => (
                      <Command.Item key={h.type + h.id} value={h.type + h.id} onSelect={() => go(h.href)} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 data-[selected=true]:bg-brand-blue-50">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-ink-soft"><I className="h-4 w-4" /></span>
                        <span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink">{h.title}</span><span className="block truncate text-xs text-ink-muted">{h.subtitle}</span></span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                );
              })}
              {q.trim().length < 2 && (
                <>
                  <Command.Group heading="Obras" className="mb-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:text-ink-muted">
                    {projects.map((p) => (
                      <Command.Item key={p.id} value={`obra-${p.code}`} onSelect={() => go(`/empresa/${companyCode}/obra/${p.code}`)} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 data-[selected=true]:bg-brand-blue-50">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy-900 text-white"><Building2 className="h-4 w-4" /></span>
                        <span className="text-sm"><b>{p.code}</b> <span className="text-ink-muted">· {p.short_name ?? p.name}</span></span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                  {sections.map((s) => (
                    <Command.Group key={s.title} heading={s.title} className="mb-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:text-ink-muted">
                      {s.items.map((it) => (
                        <Command.Item key={it.href} value={it.href} onSelect={() => go(it.href)} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 data-[selected=true]:bg-brand-blue-50">
                          <Icon name={it.icon} className="h-4 w-4 text-ink-muted" /><span className="text-sm text-ink">{it.label}</span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  ))}
                </>
              )}
            </Command.List>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
