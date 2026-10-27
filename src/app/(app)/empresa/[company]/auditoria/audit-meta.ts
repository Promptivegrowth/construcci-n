// Etiquetas legibles para la trazabilidad (compartido entre servidor y cliente).

export const TABLE_LABEL: Record<string, string> = {
  expenses: "Comprobante", payments: "Pago", orders: "Orden O/S–O/C", projects: "Obra", wbs_nodes: "Partida WBS", budget_changes: "Cambio de presupuesto",
  fund_requests: "Solicitud de fondos", stock_movements: "Movimiento de almacén", payrolls: "Planilla", valuations: "Valorización", collections: "Cobro",
  equipment_assignments: "Cargo de equipo", company_members: "Acceso a empresa", period_closures: "Cierre de periodo", project_documents: "Documento de obra",
};

export const ACTION_LABEL: Record<string, { label: string; tone: "green" | "blue" | "red" }> = {
  INSERT: { label: "Creó", tone: "green" }, UPDATE: { label: "Modificó", tone: "blue" }, DELETE: { label: "Eliminó", tone: "red" },
};

export const FIELD_LABEL: Record<string, string> = {
  status: "Estado", total: "Total", total_pen: "Total S/", cost_pen: "Costo cargado", subtotal: "Subtotal", igv: "IGV", payable_pen: "Monto a pagar",
  retention_pct: "Fondo de garantía %", retention_pen: "Fondo de garantía S/", description: "Descripción", doc_type: "Tipo de documento", series: "Serie",
  doc_number: "Número", issue_date: "Fecha de emisión", reception_date: "Fecha de recepción", due_date: "Vencimiento", approved_by: "Aprobado por",
  approved_at: "Aprobado el", observation: "Observación", void_reason: "Motivo de anulación", wbs_id: "WBS", phase_id: "Fase", supplier_id: "Proveedor",
  order_id: "Orden", amount_pen: "Monto S/", amount: "Monto", paid_at: "Fecha de pago", method: "Medio de pago", bank: "Banco", operation_number: "N° de operación",
  budget: "Presupuesto", margin: "Margen", name: "Nombre", code: "Código", title: "Título", number: "Número", quantity: "Cantidad", unit_cost: "Costo unitario",
  total_cost: "Costo total", movement_type: "Tipo de movimiento", moved_at: "Fecha", front: "Frente", responsible_name: "Responsable", role: "Rol",
  contract_amount: "Monto de contrato", start_date: "Inicio", end_date: "Fin", extended_end_date: "Fin ampliado", alert_threshold: "Umbral de alerta %",
  reason: "Motivo", change_type: "Tipo de cambio", previous_budget: "Presupuesto anterior", new_budget: "Presupuesto nuevo", rendered_amount: "Monto rendido",
  deposited_at: "Depositado el", deposit_operation: "Operación de depósito", approved_amount: "Monto aprobado", presented_amount: "Monto presentado",
  invoice_number: "Factura", voided: "Anulado", percentage: "Porcentaje", period_label: "Periodo", week: "Semana", assigned_to: "Asignado a", returned_at: "Devuelto el",
  expiry_date: "Vencimiento", title_: "Título", label: "Etiqueta", period_start: "Desde", period_end: "Hasta", geofence_radius: "Geocerca (m)", order_override: "Aprobación especial",
};

export const HIDDEN_FIELDS = new Set(["updated_at", "created_at", "id", "company_id", "project_id", "seq", "lat", "lng", "signature_out", "signature_in"]);

const money = (v: unknown) => `S/ ${Number(v ?? 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Resumen de una línea del registro afectado. */
export function summarize(table: string, d: Record<string, unknown> | null): string {
  if (!d) return "";
  const s = (k: string) => (d[k] === null || d[k] === undefined ? "" : String(d[k]));
  switch (table) {
    case "expenses": return `${[s("series"), s("doc_number")].filter(Boolean).join("-") || s("doc_type")} · ${s("description")} · ${money(d.total_pen ?? d.total)}`;
    case "payments": return `Amortización ${money(d.amount_pen)} · ${s("method")}${d.operation_number ? ` · Op. ${s("operation_number")}` : ""}`;
    case "orders": return `${s("number")} · ${s("title")} · ${money(d.total)}`;
    case "projects": return `${s("code")} · ${s("name")}`;
    case "wbs_nodes": return `${s("code")} · ${s("name")} · ${money(d.budget)}`;
    case "budget_changes": return `${s("change_type")} ${money(d.amount)} · ${s("reason")}`;
    case "fund_requests": return `Solicitud N° ${s("seq")} · ${money(d.amount)} · ${s("reason")}`;
    case "stock_movements": return `${s("movement_type")} · ${s("quantity")} und · ${money(d.total_cost)}${d.front ? ` · ${s("front")}` : ""}`;
    case "payrolls": return `${s("period_label")} · ${money(d.total)}`;
    case "valuations": return `Valorización N° ${s("number")} · ${money(d.approved_amount ?? d.presented_amount)}`;
    case "collections": return `Cobro ${money(d.amount)} · ${s("collected_at")}`;
    case "equipment_assignments": return `Entrega a ${s("assigned_to")}${d.returned_at ? " · devuelto" : ""}`;
    case "company_members": return `Rol ${s("role")}`;
    case "period_closures": return `Cierre ${s("label") || `${s("period_start")} – ${s("period_end")}`}`;
    case "project_documents": return `${s("title")}${d.number ? ` · ${s("number")}` : ""}`;
    default: return s("name") || s("title") || s("id");
  }
}
