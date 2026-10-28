import type { Database } from "@/lib/database.types";

export type Role = Database["public"]["Enums"]["app_role"];

export const ROLE_LABEL: Record<Role, string> = {
  gerente_general: "Gerencia General",
  gerente_proyectos: "Gerente de Proyectos",
  residente: "Ing. Residente / Of. técnica",
  administrador: "Administrador de obra",
  contabilidad: "Contabilidad",
  almacen: "Almacén",
};

const GG: Role = "gerente_general";
const GP: Role = "gerente_proyectos";

// Matriz de la sección 5 de la propuesta
export const PERMS = {
  createProject: [GG, GP],
  importBudget: [GG, GP],
  editBudget: [GG, GP],
  registerExpense: [GG, GP, "residente", "administrador", "contabilidad"],
  approveExpense: [GG, GP],
  requestOrder: [GG, GP, "residente", "administrador", "almacen"],
  approveOrder: [GG, GP],
  registerPayment: ["contabilidad"],
  registerValuation: [GG, GP, "contabilidad"],
  registerCollection: ["contabilidad"],
  registerPayroll: ["contabilidad", "administrador", GP],
  stockMovement: ["administrador", "almacen", GP],
  manageMaterials: [GG, GP, "administrador", "almacen"],
  requestFunds: [GP, "residente", "administrador"],
  approveFunds: [GG, GP],
  depositFunds: ["contabilidad"],
  viewAudit: [GG, GP, "contabilidad"],
  closePeriod: [GG, GP],
  manageDocuments: [GG, GP, "administrador"],
  viewFinance: [GG, GP, "residente", "administrador", "contabilidad"],
} satisfies Record<string, Role[]>;

export type Permission = keyof typeof PERMS;

// Áreas que cada rol puede ver. Las usan el menú (nav.ts) y las páginas, para que una URL escrita a mano
// no muestre lo que el menú oculta.
export const VIEW = {
  finance: [GG, GP, "residente", "administrador", "contabilidad"],
  accounting: [GG, GP, "contabilidad"],
  labor: [GG, GP, "contabilidad", "administrador", "residente"],
  warehouse: [GG, GP, "administrador", "almacen", "residente", "contabilidad"],
  approvals: [GG, GP],
  audit: [GG, GP, "contabilidad"],
} satisfies Record<string, Role[]>;

export type ViewArea = keyof typeof VIEW;

export const VIEW_LABEL: Record<ViewArea, string> = {
  finance: "la información financiera de la obra",
  accounting: "la sección de Contabilidad",
  labor: "las planillas de mano de obra",
  warehouse: "el almacén",
  approvals: "las aprobaciones",
  audit: "la trazabilidad",
};

export function canView(role: Role | null | undefined, area: ViewArea) {
  return !!role && (VIEW[area] as Role[]).includes(role);
}

export function can(role: Role | null | undefined, perm: Permission) {
  return !!role && (PERMS[perm] as Role[]).includes(role);
}
