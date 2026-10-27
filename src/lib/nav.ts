import type { Role } from "@/lib/permissions";

export type NavItem = { href: string; label: string; icon: string; roles?: Role[]; exact?: boolean };
export type NavSection = { title: string; items: NavItem[]; roles?: Role[] };

const FIN: Role[] = ["gerente_general", "gerente_proyectos", "residente", "administrador", "contabilidad"];
const ADMIN: Role[] = ["gerente_general", "gerente_proyectos", "residente", "administrador", "contabilidad"];
const CONTA: Role[] = ["gerente_general", "gerente_proyectos", "contabilidad"];
const ALM: Role[] = ["gerente_general", "gerente_proyectos", "administrador", "almacen", "residente"];

/** Navegación dentro de una obra: Administración, Contabilidad y Almacén/Logística (sin comercial). */
export function projectNav(base: string): NavSection[] {
  return [
    {
      title: "Control de obra",
      items: [
        { href: base, label: "Resumen ejecutivo", icon: "LayoutDashboard", exact: true },
        { href: `${base}/presupuesto`, label: "Presupuesto y WBS", icon: "Layers", roles: FIN },
        { href: `${base}/reportes`, label: "Reportes", icon: "FileBarChart", roles: FIN },
      ],
    },
    {
      title: "Administración",
      roles: ADMIN,
      items: [
        { href: `${base}/gastos`, label: "Gastos y comprobantes", icon: "Receipt" },
        { href: `${base}/aprobaciones`, label: "Aprobaciones", icon: "ShieldCheck", roles: ["gerente_general", "gerente_proyectos"] },
        { href: `${base}/ordenes`, label: "Órdenes O/S y O/C", icon: "ClipboardList" },
        { href: `${base}/caja`, label: "Caja y fondos", icon: "Wallet" },
      ],
    },
    {
      title: "Contabilidad",
      roles: CONTA,
      items: [
        { href: `${base}/pagos`, label: "Pagos", icon: "Banknote" },
        { href: `${base}/conciliacion`, label: "Conciliación", icon: "Scale" },
        { href: `${base}/cuentas-por-pagar`, label: "Cuentas por pagar", icon: "CalendarClock" },
        { href: `${base}/valorizaciones`, label: "Valorizaciones y cobros", icon: "HandCoins" },
        { href: `${base}/flujo-caja`, label: "Flujo de caja", icon: "TrendingUp" },
        { href: `${base}/resultados`, label: "Estado de resultados", icon: "Calculator" },
      ],
    },
    {
      title: "Mano de obra",
      roles: [...CONTA, "administrador", "residente"],
      items: [{ href: `${base}/mano-de-obra`, label: "Planillas por categoría", icon: "HardHat" }],
    },
    {
      title: "Almacén y logística",
      roles: ALM,
      items: [
        { href: `${base}/almacen`, label: "Kardex valorizado", icon: "Boxes", exact: true },
        { href: `${base}/almacen/movimientos`, label: "Ingresos y salidas", icon: "ArrowLeftRight" },
        { href: `${base}/almacen/equipos`, label: "Equipos menores", icon: "Drill" },
      ],
    },
    {
      title: "Campo",
      items: [
        { href: `${base}/asistencia`, label: "Asistencia", icon: "MapPinCheck" },
        { href: `${base}/configuracion`, label: "Ficha de obra", icon: "Settings2", roles: FIN },
      ],
    },
  ];
}

export function companyNav(base: string): NavSection[] {
  return [
    {
      title: "Empresa",
      items: [
        { href: base, label: "Obras", icon: "Building2", exact: true },
        { href: `${base}/alertas`, label: "Alertas", icon: "BellRing" },
        { href: `${base}/proveedores`, label: "Proveedores", icon: "Truck", roles: FIN },
        { href: `${base}/materiales`, label: "Catálogo de materiales", icon: "PackageSearch", roles: ALM },
        { href: `${base}/auditoria`, label: "Trazabilidad", icon: "History", roles: CONTA },
        { href: `${base}/usuarios`, label: "Usuarios y accesos", icon: "UsersRound", roles: ["gerente_general"] },
      ],
    },
  ];
}

export function filterNav(sections: NavSection[], role: Role) {
  return sections
    .filter((s) => !s.roles || s.roles.includes(role))
    .map((s) => ({ ...s, items: s.items.filter((i) => !i.roles || i.roles.includes(role)) }))
    .filter((s) => s.items.length);
}
