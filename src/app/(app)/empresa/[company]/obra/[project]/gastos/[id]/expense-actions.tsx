"use client";
import { Banknote, Ban, CircleCheck, LoaderCircle, MessageSquareWarning, PencilLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/dialog";
import { Button, ButtonLink, Field, Textarea } from "@/components/ui/primitives";
import { approveExpenses, observeExpenses, voidExpense } from "../actions";

export function ExpenseActions({ companyCode, projectCode, id, status, docType, canApprove, canRegister, canPay, hasFiles, hasPayments }: {
  companyCode: string; projectCode: string; id: string; status: string; docType: string;
  canApprove: boolean; canRegister: boolean; canPay: boolean; hasFiles: boolean; hasPayments: boolean;
}) {
  const router = useRouter();
  const base = `/empresa/${companyCode}/obra/${projectCode}`;
  const [busy, setBusy] = useState<string | null>(null);
  const [modal, setModal] = useState<null | "observe" | "void">(null);
  const [text, setText] = useState("");

  const run = async (key: string, fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => {
    setBusy(key);
    const r = await fn();
    setBusy(null);
    if (!r.ok) return toast.error("No se pudo completar", { description: r.error });
    toast.success(r.message ?? "Listo");
    setModal(null);
    setText("");
    router.refresh();
  };

  return (
    <>
      {canApprove && status === "declarado" && (
        <>
          <Button variant="outline" onClick={() => setModal("observe")} disabled={!!busy}><MessageSquareWarning className="h-4 w-4 text-warn" />Observar</Button>
          <Button variant="success" disabled={!!busy || (!hasFiles && docType !== "PL")} title={!hasFiles ? "Sin sustento no se puede aprobar" : undefined}
            onClick={() => run("approve", () => approveExpenses(companyCode, projectCode, [id]))}>
            {busy === "approve" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CircleCheck className="h-4 w-4" />}Aprobar
          </Button>
        </>
      )}
      {canRegister && ["borrador", "observado", "declarado"].includes(status) && docType !== "PL" && (
        <ButtonLink href={`${base}/gastos/${id}/editar`} variant={status === "declarado" ? "outline" : "primary"}><PencilLine className="h-4 w-4" />{status === "declarado" ? "Corregir" : "Corregir y declarar"}</ButtonLink>
      )}
      {canPay && ["aprobado", "pagado_parcial"].includes(status) && (
        <ButtonLink href={`${base}/pagos?gasto=${id}`} variant="success"><Banknote className="h-4 w-4" />Registrar pago</ButtonLink>
      )}
      {canRegister && status !== "anulado" && !hasPayments && (
        <Button variant="ghost" className="text-danger hover:bg-danger-50" onClick={() => setModal("void")} disabled={!!busy}><Ban className="h-4 w-4" />Anular</Button>
      )}

      <Modal open={!!modal} onOpenChange={(o) => !o && setModal(null)} size="sm"
        title={modal === "observe" ? "Observar comprobante" : "Anular comprobante"}
        description={modal === "observe" ? "La obra recibirá tu comentario para corregirlo y volver a declararlo." : "La anulación no borra el registro: queda visible para auditoría con su motivo."}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>Cancelar</Button>
            <Button variant={modal === "void" ? "danger" : "primary"} disabled={!!busy || text.trim().length < 5}
              onClick={() => run(modal!, () => (modal === "observe" ? observeExpenses(companyCode, projectCode, [id], text) : voidExpense(companyCode, projectCode, id, text)))}>
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}{modal === "observe" ? "Enviar observación" : "Anular comprobante"}
            </Button>
          </>
        }>
        <Field label={modal === "observe" ? "Comentario para la obra" : "Motivo de la anulación"} required hint="Mínimo 5 caracteres">
          <Textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={modal === "observe" ? "Ej.: Adjuntar guía de remisión firmada por almacén." : "Ej.: Comprobante registrado por duplicado."} />
        </Field>
      </Modal>
    </>
  );
}
