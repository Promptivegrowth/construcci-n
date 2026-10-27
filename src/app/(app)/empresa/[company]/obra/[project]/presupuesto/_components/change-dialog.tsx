"use client";
import { LoaderCircle, Minus, Plus, Repeat } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/dialog";
import { Button, Field, Input, Textarea, cn } from "@/components/ui/primitives";
import type { WbsNode } from "@/lib/calc";
import { money } from "@/lib/format";
import { applyBudgetChange } from "../actions";

const TYPES = [
  { value: "adicional", label: "Adicional", icon: Plus, hint: "Aumenta el presupuesto (adenda, mayor metrado)" },
  { value: "deductivo", label: "Deductivo", icon: Minus, hint: "Reduce el presupuesto" },
  { value: "reasignacion", label: "Reasignación", icon: Repeat, hint: "Ajuste con signo (+/−) entre partidas" },
];

export function ChangeDialog({ node, onClose }: { node: WbsNode | null; onClose: () => void }) {
  const { company, project } = useParams<{ company: string; project: string }>();
  const router = useRouter();
  const [type, setType] = useState("adicional");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  useEffect(() => { setType("adicional"); setAmount(""); setReason(""); }, [node]);

  const n = Number(amount) || 0;
  const signed = type === "deductivo" ? -Math.abs(n) : type === "adicional" ? Math.abs(n) : n;
  const next = (node?.budget ?? 0) + signed;

  const submit = () => start(async () => {
    if (!node) return;
    const res = await applyBudgetChange(company, project, { wbsId: node.wbs_id, type, amount: n, reason });
    if (!res.ok) return void toast.error("No se aplicó el cambio", { description: res.error });
    toast.success(res.message, { description: `${node.code}: ${money(node.budget)} → ${money(next)}` });
    onClose();
    router.refresh();
  });

  return (
    <Modal open={!!node} onOpenChange={(o) => !o && onClose()} title="Cambio de presupuesto"
      description={node ? `${node.code} · ${node.name}. Queda versionado con autor, fecha y motivo.` : undefined}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={submit} disabled={pending || !n || !reason.trim() || next < 0}>{pending && <LoaderCircle className="h-4 w-4 animate-spin" />}Aplicar cambio</Button>
      </>}>
      <div className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-3">
          {TYPES.map((t) => (
            <button key={t.value} onClick={() => setType(t.value)} className={cn("rounded-xl border p-3 text-left transition", type === t.value ? "border-brand-blue bg-brand-blue-50 ring-2 ring-brand-blue/15" : "border-line hover:border-brand-blue/40")}>
              <t.icon className={cn("h-4 w-4", type === t.value ? "text-brand-blue" : "text-ink-muted")} />
              <p className="mt-1 text-sm font-semibold">{t.label}</p>
              <p className="text-[11px] text-ink-muted">{t.hint}</p>
            </button>
          ))}
        </div>
        <Field label="Monto (S/ sin IGV)" required>
          <Input type="number" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </Field>
        <Field label="Motivo" required hint="Ej.: Adenda N° 3 — ampliación de plazo 30 días">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div className="grid grid-cols-3 gap-3 rounded-2xl bg-slate-50 p-4 text-center">
          <div><p className="text-[11px] text-ink-muted">Actual</p><p className="num font-semibold">{money(node?.budget)}</p></div>
          <div><p className="text-[11px] text-ink-muted">Cambio</p><p className={cn("num font-semibold", signed < 0 ? "text-danger" : "text-brand-green-700")}>{signed >= 0 ? "+" : ""}{money(signed)}</p></div>
          <div><p className="text-[11px] text-ink-muted">Nuevo</p><p className={cn("num font-semibold", next < 0 && "text-danger")}>{money(next)}</p></div>
        </div>
      </div>
    </Modal>
  );
}
