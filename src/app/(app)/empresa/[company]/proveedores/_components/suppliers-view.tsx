"use client";
import { Banknote, Building, LoaderCircle, Pencil, Plus, Receipt, Truck, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/dialog";
import { CountUp, Stagger, StaggerItem } from "@/components/ui/motion";
import { Badge, Button, Card, Field, Input, Select, cn } from "@/components/ui/primitives";
import { date, money } from "@/lib/format";
import { saveSupplier, type SupplierInput } from "../actions";

export type SupplierRow = {
  id: string; ruc: string; name: string; kind: string; phone: string | null; email: string | null; address: string | null; bank: string | null; account_number: string | null;
  invoiced: number; paid: number; balance: number; retention: number; docs: number; projects: string; last: string | null;
} & Record<string, unknown>;

const KIND: Record<string, { label: string; tone: "blue" | "violet" | "gray" | "cyan" }> = {
  proveedor: { label: "Proveedor", tone: "blue" },
  subcontratista: { label: "Subcontratista", tone: "violet" },
  trabajador: { label: "Planilla / trabajador", tone: "gray" },
  entidad: { label: "Entidad", tone: "cyan" },
};

const EMPTY: SupplierInput = { id: null, ruc: "", name: "", kind: "proveedor", phone: "", email: "", address: "", bank: "", account_number: "" };

export function SuppliersView({ rows, companyCode, companyName, userName, canEdit, filter }: {
  rows: SupplierRow[]; companyCode: string; companyName: string; userName: string; canEdit: boolean; filter: string | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState<SupplierInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState("");

  const list = useMemo(() => rows.filter((r) => !kind || r.kind === kind), [rows, kind]);
  const totals = useMemo(() => ({
    invoiced: list.reduce((s, r) => s + r.invoiced, 0), paid: list.reduce((s, r) => s + r.paid, 0),
    balance: list.reduce((s, r) => s + r.balance, 0), retention: list.reduce((s, r) => s + r.retention, 0),
  }), [list]);

  const submit = async () => {
    if (!form) return;
    setSaving(true);
    const r = await saveSupplier(companyCode, form);
    setSaving(false);
    if (!r.ok) return toast.error("No se pudo guardar", { description: r.error });
    toast.success(r.message);
    setForm(null);
    router.refresh();
  };

  const columns: Column<SupplierRow>[] = [
    {
      key: "name", header: "Proveedor", value: (r) => `${r.name} ${r.ruc}`,
      cell: (r) => (
        <div className="min-w-0">
          <p className="max-w-[320px] truncate font-semibold text-ink">{r.name}</p>
          <p className="text-[11px] text-ink-muted">{r.ruc.length === 8 ? "DNI" : "RUC"} {r.ruc}{r.bank ? ` · ${r.bank} ${r.account_number ?? ""}` : ""}</p>
        </div>
      ),
    },
    { key: "kind", header: "Tipo", value: (r) => KIND[r.kind]?.label ?? r.kind, cell: (r) => <Badge tone={KIND[r.kind]?.tone ?? "gray"}>{KIND[r.kind]?.label ?? r.kind}</Badge>, hideSm: true },
    { key: "projects", header: "Obras", value: (r) => r.projects, cell: (r) => <span className="flex flex-wrap gap-1">{r.projects ? r.projects.split(", ").map((c) => <span key={c} className="whitespace-nowrap rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft">{c}</span>) : "—"}</span>, hideSm: true },
    { key: "docs", header: "Comp.", type: "int", value: (r) => r.docs, hideSm: true },
    { key: "invoiced", header: "Facturado", type: "money", value: (r) => r.invoiced, total: true, className: "whitespace-nowrap" },
    { key: "paid", header: "Pagado", type: "money", value: (r) => r.paid, total: true, className: "whitespace-nowrap" },
    {
      key: "balance", header: "Saldo por pagar", type: "money", value: (r) => r.balance, total: true, className: "whitespace-nowrap",
      cell: (r) => <span className={cn("num font-semibold", r.balance > 0.5 ? "text-[#9a5200]" : "text-brand-green-700")}>{money(r.balance)}</span>,
    },
    { key: "last", header: "Último comp.", type: "date", value: (r) => r.last ?? "", cell: (r) => <span className="text-xs text-ink-muted">{date(r.last)}</span>, hideSm: true },
    ...(canEdit ? [{
      key: "edit", header: "", sortable: false, exportable: false, align: "right" as const,
      cell: (r: SupplierRow) => (
        <button onClick={(e) => { e.stopPropagation(); setForm({ id: r.id, ruc: r.ruc, name: r.name, kind: r.kind as SupplierInput["kind"], phone: r.phone ?? "", email: r.email ?? "", address: r.address ?? "", bank: r.bank ?? "", account_number: r.account_number ?? "" }); }}
          className="rounded-lg p-2 text-ink-muted transition hover:bg-brand-blue-50 hover:text-brand-blue" aria-label="Editar"><Pencil className="h-4 w-4" /></button>
      ),
    }] : []),
  ];

  const tiles = [
    { k: "Proveedores", v: list.length, f: "int" as const, Icon: Truck, c: "text-brand-blue bg-brand-blue-50" },
    { k: "Facturado", v: totals.invoiced, f: "moneyShort" as const, Icon: Receipt, c: "text-violet-700 bg-violet-50" },
    { k: "Pagado", v: totals.paid, f: "moneyShort" as const, Icon: Banknote, c: "text-brand-green-700 bg-ok-50" },
    { k: "Saldo por pagar", v: totals.balance, f: "moneyShort" as const, Icon: Building, c: "text-[#9a5200] bg-warn-50", sub: `Fondo de garantía retenido ${money(totals.retention)}` },
  ];

  return (
    <div className="space-y-5">
      <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <StaggerItem key={t.k}>
            <Card className="flex h-full items-center gap-4 p-4">
              <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", t.c)}><t.Icon className="h-5 w-5" /></span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-ink-muted">{t.k}</p>
                <p className="font-display text-xl font-semibold text-ink"><CountUp value={t.v} format={t.f} /></p>
                {t.sub && <p className="truncate text-[11px] text-ink-muted">{t.sub}</p>}
              </div>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>

      <Card className="overflow-hidden">
        {filter && (
          <div className="flex items-center gap-2 border-b border-line-soft bg-brand-blue-50/50 px-4 py-2 text-xs">
            <span className="text-ink-soft">Filtrado por</span><Badge tone="blue">{filter}</Badge>
            <Link href={`/empresa/${companyCode}/proveedores`} className="ml-1 inline-flex items-center gap-1 font-semibold text-brand-blue"><X className="h-3 w-3" />Quitar</Link>
          </div>
        )}
        <DataTable rows={list} columns={columns} searchPlaceholder="Buscar por RUC, razón social u obra…" initialSort={{ key: "invoiced", dir: "desc" }}
          exportSheet={{ name: "Proveedores", title: "Proveedores y saldos", subtitle: `${list.length} proveedores`,
            summary: [{ label: "Facturado", value: money(totals.invoiced), tone: "navy" }, { label: "Pagado", value: money(totals.paid), tone: "green" }, { label: "Saldo por pagar", value: money(totals.balance), tone: "amber" }] }}
          exportMeta={{ filename: `proveedores-${companyCode}`, company: companyName, user: userName }}
          toolbar={
            <>
              <select value={kind} onChange={(e) => setKind(e.target.value)} className="h-9 rounded-xl border border-line bg-white px-3 text-xs font-semibold outline-none">
                <option value="">Todos los tipos</option>
                {Object.entries(KIND).map(([v, k]) => <option key={v} value={v}>{k.label}</option>)}
              </select>
              <Button size="sm" onClick={() => setForm({ ...EMPTY })}><Plus className="h-4 w-4" />Nuevo proveedor</Button>
            </>
          }
        />
      </Card>

      <Modal open={!!form} onOpenChange={(o) => !o && setForm(null)} title={form?.id ? "Editar proveedor" : "Nuevo proveedor"}
        description="Se usará al registrar comprobantes, órdenes e ingresos de almacén en cualquier obra de la empresa."
        footer={<><Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button><Button onClick={submit} disabled={saving}>{saving && <LoaderCircle className="h-4 w-4 animate-spin" />}Guardar</Button></>}>
        {form && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="RUC / DNI" required hint="11 dígitos (RUC) u 8 (DNI)">
              <Input inputMode="numeric" maxLength={11} value={form.ruc} disabled={form.ruc.startsWith("PLANILLA")} onChange={(e) => setForm({ ...form, ruc: e.target.value.replace(/\D/g, "") })} placeholder="20xxxxxxxxx" />
            </Field>
            <Field label="Tipo" required>
              <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as SupplierInput["kind"] })}>
                {Object.entries(KIND).map(([v, k]) => <option key={v} value={v}>{k.label}</option>)}
              </Select>
            </Field>
            <Field label="Razón social / nombre" required className="sm:col-span-2">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="EMPRESA S.A.C." />
            </Field>
            <Field label="Teléfono"><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Correo de facturación"><Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Dirección" className="sm:col-span-2"><Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            <Field label="Banco">
              <Select value={form.bank ?? ""} onChange={(e) => setForm({ ...form, bank: e.target.value })}>
                <option value="">—</option>{["BCP", "BBVA", "Interbank", "Scotiabank", "BanBif", "Banco de la Nación", "Pichincha"].map((b) => <option key={b}>{b}</option>)}
              </Select>
            </Field>
            <Field label="Cuenta / CCI"><Input value={form.account_number ?? ""} onChange={(e) => setForm({ ...form, account_number: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
