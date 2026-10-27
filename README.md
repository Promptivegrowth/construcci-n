# Grupo Cruz · Plataforma de control presupuestal por obra

Sistema web multiempresa con app de campo (PWA) para el holding Grupo Cruz. Integra Administración, Contabilidad y Almacén/Logística de cada obra (propuesta PRM-GC-2026-001).

- **Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Postgres 17, Auth, RLS, Storage) · Recharts + barras 3D propias en SVG · ExcelJS · jsPDF.
- **Seguridad:** aislamiento por empresa y obra con Row Level Security. Ver `supabase/migrations/0003_security.sql`.
- **Lógica de negocio en la base de datos:** IGV, tipo de cambio, fondo de garantía, correlativos, estados de pago, saldos de O/S y O/C, stock, periodos cerrados, auditoría inalterable y alertas. Ver `0002_logic.sql`.

## Puesta en marcha local

```bash
npm install
cp .env.example .env.local      # completar credenciales de Supabase
npm run db:migrate              # aplica supabase/migrations/* vía Management API
npm run db:seed                 # BORRA y vuelve a sembrar la data de demostración (determinista)
npm run dev                     # http://localhost:3000
```

Usuarios sembrados (contraseña `GrupoCruz2026!`):

| Usuario | Rol | Alcance |
|---|---|---|
| gerencia@grupocruz.pe | Gerencia General | Holding completo + vista consolidada + usuarios |
| jcastillo@grupocruz.pe | Gerente de Proyectos | Empresas 01 y 02 · aprueba gastos y O/S-O/C |
| rquispe@grupocruz.pe | Ing. Residente | 010-HCVC, 011-RLAL, 012-IEPC |
| jrojas@grupocruz.pe | Administradora de obra | 010-HCVC, 011-RLAL |
| contabilidad@grupocruz.pe | Contabilidad (Lima) | Empresas 01 y 02 · pagos, valorizaciones |
| almacen@grupocruz.pe | Almacén | 010-HCVC, 011-RLAL |
| mparedes@grupocruz.pe | Administrador | Empresa 02 |
| lfernandez@grupocruz.pe | Ing. Residente | 020-MTTN, 022-CM120 |

La obra **010-HCVC** reproduce la plantilla *EXPENSE FINANCIERO FASE 3* del cliente. Fase 3: asignado S/ 1,768,159.05, pagado S/ 1,728,205.31, margen S/ 39,953.74. La obra **022-CM120** reproduce la maqueta de conciliación.

## Variables de entorno

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente Supabase (navegador y servidor) |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor: gestión de usuarios y cron. **Nunca** exponer al cliente |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` | Solo scripts locales (migraciones, seed, tipos). No se necesitan en Vercel |
| `NEXT_PUBLIC_QUICK_LOGIN` | `true` muestra el selector de acceso rápido. **Poner `false` en producción** |
| `CRON_SECRET` | Protege `/api/cron/reporte-quincenal` (Vercel lo envía automáticamente) |
| `RESEND_API_KEY`, `REPORT_FROM_EMAIL` | Envío del reporte quincenal por correo a Gerencia |

## Despliegue en Vercel

1. Importar el repositorio y configurar las variables anteriores (sin las de scripts).
2. `vercel.json` fija la región `iad1`, junto a la base de datos (us-east-1), y programa el cron del reporte quincenal los días 1 y 16 a las 08:00 de Lima.
3. En Supabase › Authentication › URL Configuration, agregar el dominio de producción.

## Estructura

```
src/app/(app)/empresas            Selector de empresas del holding (bloqueo por membresía)
src/app/(app)/holding             Vista consolidada (Gerencia General)
src/app/(app)/empresa/[company]   Obras, alertas, proveedores, materiales, trazabilidad, usuarios
  └─ obra/[project]               Resumen ejecutivo, presupuesto/WBS, gastos, aprobaciones, órdenes, caja,
                                  pagos, conciliación, CxP, valorizaciones, flujo de caja, resultados,
                                  mano de obra, almacén, equipos, asistencia, reportes, ficha de obra
src/app/(app)/campo               PWA de campo (offline): gastos con foto+GPS, asistencia, almacén, aprobaciones
src/components/{ui,charts,layout} Sistema de diseño, gráficos (3D, dona, curva S) y shell
src/lib                           Sesión, permisos (sección 5), cálculos, consultas, exportación Excel/PDF
supabase/migrations               Esquema, lógica, RLS y Storage
scripts                           Migraciones, seed, capturas y pruebas de exportación (QA)
```

## Scripts de QA

- `node scripts/shot.mjs <ruta> <salida.png> <email> [ancho] [alto] [full]`: captura con sesión iniciada (en Git Bash anteponer `MSYS_NO_PATHCONV=1`).
- `node scripts/overflow.mjs <ruta> <email>`: detecta desbordes horizontales en móvil (390 px).
- `node scripts/test-exports.mjs <carpeta>`: descarga real de Excel/PDF (resumen ejecutivo y liquidación con sustentos).
