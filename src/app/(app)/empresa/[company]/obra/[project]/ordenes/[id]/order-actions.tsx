"use client";
import { Ban, CircleCheck, Lock, LoaderCircle, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/dialog";
import { Button, Field, Textarea } from "@/components/ui/primitives";
import { changeOrderStatus } from "../actions";

type Act = "aprobar" | "rechazar" | "cerrar" | "anular";
const META: Record<Act, { title: string; desc: string; required: boolean; cta: string }> = {
  aprobar: { title: "Aprobar orden", desc: "La orden queda emitida y su monto pasa a comprometer el WBS.", required: false, cta: "Aprobar" },
  rechazar: { title: "Rechazar solicitud", desc: "El solicitante verá el motivo del rechazo.", required: true, cta: "Rechazar" },
  cerrar: { title: "Cerrar orden", desc: "El saldo no facturado deja de figurar como comprometido.", required: false, cta: "Cerrar orden" },
  anular: { title: "Anular orden", desc: "Solo procede si no tiene comprobantes asociados. Queda registrada para auditoría.", required: true, cta: "Anular" },
};

export function OrderActions({ companyCode, projectCode, id, status, hasInvoices }: { companyCode: string; projectCode: string; id: string; status: string; hasInvoices: boolean }) {
  const router = useRouter();
  const [act, setAct] = useState<Act | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!act) return;
    setBusy(true);
    try {
      const r = await changeOrderStatus(companyCode, projectCode, id, act, note);
      if (!r.ok) return toast.error("No se pudo completar", { description: r.error });
      toast.success(r.message ?? "Listo");
      setAct(null);
      setNote("");
      router.refresh();
    } finally { setBusy(false); }
  };
  return (
    <>
      {status === "solicitada" && (
        <>
          <Button variant="outline" onClick={() => setAct("rechazar")}><XCircle className="h-4 w-4 text-danger" />Rechazar</Button>
          <Button variant="success" onClick={() => setAct("aprobar")}><CircleCheck className="h-4 w-4" />Aprobar</Button>
        </>
      )}
      {status === "aprobada" && <Button variant="outline" onClick={() => setAct("cerrar")}><Lock className="h-4 w-4" />Cerrar</Button>}
      {!["anulada", "cerrada", "rechazada"].includes(status) && !hasInvoices && <Button variant="ghost" className="text-danger hover:bg-danger-50" onClick={() => setAct("anular")}><Ban className="h-4 w-4" />Anular</Button>}
      <Modal open={!!act} onOpenChange={(o) => !o && setAct(null)} size="sm" title={act ? META[act].title : ""} description={act ? META[act].desc : ""}
        footer={<><Button variant="ghost" onClick={() => setAct(null)}>Cancelar</Button>
          <Button variant={act === "anular" || act === "rechazar" ? "danger" : "primary"} disabled={busy || (!!act && META[act].required && note.trim().length < 5)} onClick={run}>
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{act ? META[act].cta : ""}
          </Button></>}>
        <Field label={act && META[act].required ? "Motivo" : "Comentario (opcional)"} required={!!act && META[act].required}>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Escribe un comentario…" />
        </Field>
      </Modal>
    </>
  );
}
