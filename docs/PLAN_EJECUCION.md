# Plan de ejecución — Plataforma de Control Presupuestal Grupo Cruz

Propuesta: PRM-GC-2026-001 · Cliente: Grupo Cruz Ingeniería y Construcción S.A.C. (RUC 20602161529)
Atención: Sr. Juan Castillo Cruz (Gerente de Proyectos) · Contratista: Promptive / Bravosoft S.A.C.

## 1. Fuentes analizadas

| Fuente | Pilares que aporta |
|---|---|
| Propuesta técnica (docx) | Alcance de los módulos 4.1–4.12, roles y permisos (secc. 5), reglas de negocio (secc. 6), stack (Next.js + Supabase + RLS + Storage + Vercel), lo que queda fuera del alcance |
| Reunión con Juan Castillo Cruz | Holding → empresa → obra; solo **Administración, Contabilidad y Almacén/Logística** (sin comercial ni cronogramas); barra que “carga como batería” con alerta al 80 %; Contabilidad paga → la barra se actualiza sola; O/S de alquiler (equipos menores) con monto global que se va consumiendo; almacén con cantidades y costos (“fíltrame el alambre”); mano de obra por categoría (capataz, operario, oficial, peón) y por fase; liquidación en minutos si se anula la obra; app en el celular con foto del comprobante; asistencia del personal clave; reportes quincenales PDF/Excel; importar el presupuesto desde Excel; interno y privado (sin SUNAT) |
| Plantilla EXPENSE FINANCIERO FASE 3 (xlsm) | Obra real **010-HCVC Hospital de Chincheros II-1** (asignado S/ 1,768,159.05, gastado S/ 1,728,205.31, margen S/ 39,953.74, TC 3.45, del 15/01 al 15/09/2026, administradora Judith Rojas Huillca); centros de costo 1010…10200; columnas del registro de gastos; faseado de facturas con CPI; flujo por valorización (Val. 12–14); boceto WBS de 3 niveles; matriz de mano de obra (S/ 1.119 M por fases y categorías); estado de resultados; liquidación de IGV |
| Logos Empresarial (pptx) | 4 empresas (Ingeniería y Construcción, Infraestructura, Edificaciones, Contratistas Generales), paleta, tipografía Halogen Bold, maquetas: selector de perfil, menú lateral por empresa, tarjetas Proyectado / Declarado / Pagado / Saldo, estados Conciliado / Por conciliar / Revisar diferencias, tablero de gastos (presupuesto, ejecutado, comprometido, saldo, gasto por mes) |
| Identidad | Rojo #F21D2F · Azul #035AA6 · Verde #04BF55 · Verde oscuro #035928 + azul marino institucional para la navegación |

## 2. Decisiones de arquitectura

- **Next.js 15 (App Router) + React 19 + TypeScript + Tailwind 4**: el mismo stack de los proyectos de Promptive.
- **Supabase**: Postgres 17, Auth (correo y contraseña), RLS por empresa y obra, y Storage privado para los comprobantes.
- **Lógica de negocio en la base de datos**: triggers para IGV/TC/fondo de garantía, correlativos, estados de pago, validación de stock, periodos cerrados y auditoría inalterable. Vistas `security_invoker` para Proyectado / Declarado / Pagado / Comprometido.
- **Gráficos**: Recharts (torta/dona, curva S, barras, áreas) y un componente propio de **barras 3D en SVG** animadas. **Barra batería** con semáforo, marcador del 80 % y marcador de tiempo transcurrido.
- **Exportación**: ExcelJS (logo, bandas de color, formatos, totales, filtros) y jsPDF + AutoTable (cabecera y pie con la marca, gráficos incrustados).
- **PWA de campo**: manifest, service worker, cola sin conexión en IndexedDB, compresión de fotos, GPS, geocerca y firma en pantalla.
- **UX**: preloader con el isotipo animado, skeletons por ruta, carga diferida de gráficos, transiciones animadas de inicio y cierre de sesión, toasts, paleta de búsqueda global (Ctrl+K), selector de acceso rápido solo en desarrollo (`NEXT_PUBLIC_QUICK_LOGIN`).

## 3. Tandas

| # | Tanda | Entregables |
|---|---|---|
| 0 | Análisis y plan | Este documento, activos de marca (logos transparentes, variante oscura, íconos PWA) |
| 1 | Fundaciones | Proyecto Next.js, sistema de diseño con la marca, clientes Supabase (navegador/servidor/admin), middleware de sesión |
| 2 | Base de datos | Esquema completo (≈30 tablas), enums, triggers, vistas, RLS, bucket de Storage, auditoría; tipos TypeScript generados |
| 3 | Data sembrada | 7 usuarios por rol, 4 empresas (data en 2), 6 obras: 010-HCVC con los datos reales del Excel, edificio de 4 fases con WBS de 3 niveles, obras mineras de la maqueta; gastos, pagos parciales, O/S y O/C, planillas semanales, valorizaciones, almacén, equipos, caja, asistencia y alertas |
| 4 | Shell y accesos | Login con acceso rápido de desarrollo, preloader, transiciones de sesión, selector de empresa (bloqueo si no pertenece), vista holding, layout de obra con las 3 áreas, búsqueda global |
| 5 | Obra: resumen y presupuesto | Resumen ejecutivo (KPI, barras 3D por fase, dona, curva S, gasto mensual, ranking de WBS), árbol WBS con baterías, detalle de WBS (tarjetas de conciliación, comprobantes, consumo quincenal), importación del presupuesto desde Excel con validación por fila, versiones (adicionales/deductivos) |
| 6 | Administración | Registro de gastos con foto obligatoria y distribución entre WBS, bandeja de aprobación, O/S y O/C con saldo y comprometido, caja por obra y solicitudes de fondos (solicita → aprueba → deposita → rinde) |
| 7 | Contabilidad | Bandeja de pagos por vencimiento, amortizaciones parciales, comprobantes de Lima, conciliación, cuentas por pagar y fondo de garantía, valorizaciones y cobros, flujo de caja, estado de resultados |
| 8 | Mano de obra y almacén | Planillas por categoría y semana, proyectado vs. real por categoría y fase; catálogo, ingresos y salidas, kardex valorizado, “fíltrame el material”, equipos menores con cargo firmado |
| 9 | Control | Centro de alertas (80 %, sobrecosto, ritmo, diferencias, vencimientos, órdenes excedidas), auditoría, usuarios y accesos, creación de obra desde plantilla, ficha documental (contrato, fianzas) y cierre de periodo |
| 10 | Reportes | Reporte ejecutivo, por WBS, quincenal, mano de obra, kardex y liquidación de obra en PDF y Excel con la marca |
| 11 | PWA de campo | Captura del comprobante con cámara y GPS, cola sin conexión, asistencia con geocerca, ingresos de almacén, aprobaciones desde el celular |
| 12 | QA y entrega | Typecheck, build de producción, recorrido por rol, revisión responsive, README, push a GitHub listo para Vercel |

## 4. Reglas de negocio implementadas (secc. 6 de la propuesta)

Comprobante único (proveedor + tipo + serie + número) · sustento obligatorio para pasar a aprobación · clasificación obligatoria (obra, fase, WBS de último nivel) · IGV según el tipo de documento · conversión de USD con el TC del comprobante · las amortizaciones no superan el monto a pagar · las facturas no superan el saldo de su O/S u O/C sin aprobación · un gasto que deja un WBS en negativo requiere aprobación de Gerencia · no hay salidas mayores al stock · periodos cerrados · aislamiento por empresa y obra en la base de datos.

## 5. Conceptos de cálculo

- **Proyectado** = presupuesto vigente del WBS (inicial ± adicionales/deductivos), sin IGV.
- **Declarado por Obra** = costo de los comprobantes registrados por la obra (no borrador ni anulado).
- **Pagado por Contabilidad** = costo × (pagado / monto a pagar) de cada comprobante, incluidos los pagos centrales de Lima.
- **Comprometido** = O/S y O/C aprobadas aún no facturadas.
- **Saldo** = Proyectado − Pagado · **Disponible** = Proyectado − Pagado − Comprometido.
- **Semáforo**: < 80 % normal (azul→verde) · ≥ 80 % alerta (ámbar) · ≥ 100 % peligro (rojo). Ritmo: % gastado > % de plazo transcurrido.
- **Conciliación**: Declarado = Pagado → *Conciliado*; Pagado < Declarado → *Por conciliar* (falta pagar); Pagado > Declarado → *Revisar diferencias*.
