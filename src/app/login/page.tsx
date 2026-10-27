import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginView } from "./login-view";

export const metadata: Metadata = { title: "Ingresar" };

const QUICK = [
  { email: "gerencia@grupocruz.pe", name: "Carlos Mendoza Ríos", role: "Gerente General", hint: "Holding · las 4 empresas", color: "#062A4D" },
  { email: "jcastillo@grupocruz.pe", name: "Juan Castillo Cruz", role: "Gerente de Proyectos", hint: "Empresas 01 y 02 · aprueba gastos", color: "#035AA6" },
  { email: "rquispe@grupocruz.pe", name: "Ricardo Quispe Mamani", role: "Ingeniero Residente", hint: "010-HCVC · 011-RLAL · 012-IEPC", color: "#F21D2F" },
  { email: "jrojas@grupocruz.pe", name: "Judith Rojas Huillca", role: "Administradora de obra", hint: "010-HCVC · 011-RLAL", color: "#04BF55" },
  { email: "contabilidad@grupocruz.pe", name: "Rosa Huamán Torres", role: "Contabilidad · Lima", hint: "Registra pagos y valorizaciones", color: "#7C3AED" },
  { email: "almacen@grupocruz.pe", name: "Pedro Ccori Salas", role: "Almacenero", hint: "Kardex y equipos menores", color: "#035928" },
  { email: "mparedes@grupocruz.pe", name: "Miguel Paredes Villanueva", role: "Administrador · Infraestructura", hint: "Empresa 02 · 4 obras", color: "#0EA5E9" },
  { email: "lfernandez@grupocruz.pe", name: "Lucía Fernández Chávez", role: "Residente · Infraestructura", hint: "020-MTTN · 022-CM120", color: "#D97706" },
];

export default function LoginPage() {
  return (
    <Suspense>
      <LoginView quick={process.env.NEXT_PUBLIC_QUICK_LOGIN === "true" ? QUICK : []} />
    </Suspense>
  );
}
