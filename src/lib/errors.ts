/** Traduce errores de Postgres/Supabase (reglas de negocio de los triggers) a mensajes claros. */
export function friendlyError(e: unknown): string {
  const msg = typeof e === "string" ? e : e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "Error inesperado";
  const code = e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
  if (msg.includes("PERIODO_CERRADO")) return msg.replace("PERIODO_CERRADO: ", "Periodo cerrado: ");
  if (msg.includes("ORDEN_EXCEDIDA")) return msg.replace("ORDEN_EXCEDIDA: ", "") + ". Requiere aprobación especial de Gerencia.";
  if (msg.includes("PAGO_EXCEDIDO")) return msg.replace("PAGO_EXCEDIDO: ", "");
  if (msg.includes("PAGO_NO_PERMITIDO")) return msg.replace("PAGO_NO_PERMITIDO: ", "");
  if (msg.includes("STOCK_INSUFICIENTE")) return msg.replace("STOCK_INSUFICIENTE: ", "Stock insuficiente: ");
  if (msg.includes("expenses_unique_document") || (code === "23505" && msg.includes("expenses"))) return "Comprobante duplicado: ya existe la misma combinación RUC + tipo + serie + número.";
  if (code === "23505") return "Ya existe un registro con esos datos.";
  if (code === "42501" || msg.includes("row-level security")) return "No tienes permiso para realizar esta acción en esta obra.";
  if (msg.includes("JWT") || msg.includes("not authenticated")) return "Tu sesión expiró. Vuelve a ingresar.";
  return msg;
}

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };
