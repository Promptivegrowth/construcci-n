// Definición de obras para la siembra.
// Hojas WBS: gen describe cómo se generan sus comprobantes.
//   list     → comprobantes explícitos (plantilla Excel del cliente)
//   generic  → n comprobantes repartidos entre from/to por un monto objetivo (target)
//   payroll  → planilla semanal de obreros por categoría
//   staff    → planilla mensual de staff
// paidTarget fija el monto exacto pagado por Contabilidad (para las historias de conciliación).
// lima agrega pagos centrales que solo llegan a Lima (Pagado > Declarado).

// Planilla de obreros 010-HCVC, semanas 16–36 (hoja "Expense Real", columna Q)
const HCVC_WEEKS = {
  16: 33385.74, 17: 30583.05, 18: 28331.5, 19: 24795.8, 20: 37511.84, 21: 42835.04, 22: 30421.36, 23: 13243.32,
  24: 35874.96, 25: 35410.82, 26: 34892.75, 27: 27869.97, 28: 31822.95, 29: 25132.96, 30: 33279.91, 31: 21549.39,
  32: 17346.24, 33: 21080.09, 34: 8612.43, 35: 19204.85, 36: 18059.9,
};

export const PROJECTS = [
  // ===================================================================
  // EMPRESA 01 · GC INGENIERÍA Y CONSTRUCCIÓN
  // ===================================================================
  {
    company: "01", code: "010-HCVC", short_name: "Hospital Chincheros",
    name: "Construcción del Hospital de Chincheros II-1, Red de Salud Virgen de Cocharcas",
    client_name: "Consorcio Salud Chincheros", client_ruc: "20609874563", project_type: "infraestructura",
    location: "Cocharcas, Chincheros", address: "Cocharcas, Distrito de Chincheros", region: "Apurímac",
    start: "2026-01-15", end: "2026-09-15", extended: "2026-11-30", tc: 3.45, contract: 2821470.44, status: "ejecucion",
    lat: -13.5167, lng: -73.7225, manager: "jcastillo", admin: "jrojas", resident: "rquispe",
    phases: [
      { code: "F1", name: "Fase 1 · Obras preliminares y cimentación", start: "2026-01-15", end: "2026-03-20", sale: 433799.95, color: "#035AA6" },
      { code: "F2", name: "Fase 2 · Estructuras", start: "2026-03-21", end: "2026-05-10", sale: 653883.83, color: "#04BF55" },
      { code: "F3", name: "Fase 3 · Acabados y obras complementarias", start: "2026-05-11", end: "2026-11-30", sale: 1733786.66, color: "#F21D2F" },
    ],
    wbs: [
      { code: "WBS-01", name: "FASE 1 · OBRAS PRELIMINARES Y CIMENTACIÓN", phase: "F1", children: [
        { code: "WBS-01.01", name: "Mano de obra Fase 1", type: "mano_obra", budget: 125000, gen: { kind: "payroll", weeks: [1, 9], target: 121400 } },
        { code: "WBS-01.02", name: "Concreto y agregados", type: "materiales", budget: 92000, gen: { kind: "generic", target: 88300, n: 9, pool: ["unicon", "agregados"], desc: ["Concreto premezclado f'c 210 kg/cm²", "Arena gruesa y piedra chancada", "Concreto para zapatas y cimientos corridos"] } },
        { code: "WBS-01.03", name: "Acero de refuerzo", type: "materiales", budget: 48000, gen: { kind: "generic", target: 47200, n: 5, pool: ["ferreandina"], desc: ["Acero corrugado 1/2\" y 3/8\"", "Alambre negro N° 8 y N° 16"] } },
        { code: "WBS-01.04", name: "Alquiler de maquinaria", type: "alquileres", budget: 38000, gen: { kind: "generic", target: 36900, n: 4, pool: ["unimaq"], desc: ["Alquiler de retroexcavadora 416F", "Alquiler de rodillo compactador"] } },
        { code: "WBS-01.05", name: "Seguridad y salud Fase 1", type: "seguridad", budget: 9000, gen: { kind: "generic", target: 8100, n: 6, pool: ["acr", "celestial", "protecta"], desc: ["EPP para personal obrero", "Exámenes médicos ocupacionales", "SCTR salud y pensión"] } },
      ] },
      { code: "WBS-02", name: "FASE 2 · ESTRUCTURAS", phase: "F2", children: [
        { code: "WBS-02.01", name: "Mano de obra Fase 2", type: "mano_obra", budget: 215000, gen: { kind: "payroll", weeks: [10, 15], target: 211800 } },
        { code: "WBS-02.02", name: "Concreto premezclado", type: "materiales", budget: 185000, gen: { kind: "generic", target: 181500, n: 10, pool: ["unicon"], desc: ["Concreto premezclado f'c 280 kg/cm² — columnas y placas", "Concreto premezclado f'c 210 kg/cm² — losas", "Servicio de bombeo de concreto"] } },
        { code: "WBS-02.03", name: "Acero de refuerzo", type: "materiales", budget: 120000, gen: { kind: "generic", target: 118400, n: 7, pool: ["ferreandina"], desc: ["Acero corrugado 5/8\" y 1/2\"", "Acero corrugado 3/8\" y alambre N° 16"] } },
        { code: "WBS-02.04", name: "Encofrado metálico Fase 2", type: "alquileres", budget: 60000, gen: { kind: "generic", target: 58000, n: 3, pool: ["alsina"], desc: ["Alquiler de encofrado metálico para columnas y placas"] } },
        { code: "WBS-02.05", name: "Seguridad y salud Fase 2", type: "seguridad", budget: 6000, gen: { kind: "generic", target: 5200, n: 4, pool: ["acr", "segurindustria"], desc: ["Arneses y líneas de vida", "Reposición de EPP"] } },
      ] },
      { code: "WBS-03", name: "FASE 3 · ACABADOS Y OBRAS COMPLEMENTARIAS", phase: "F3", children: [
        { code: "WBS-03.01", name: "Mano de obra", children: [
          { code: "WBS-03.01.01", cc: "1010", name: "Planilla staff", type: "mano_obra", budget: 150000, gen: { kind: "staff", months: [
            ["2026-05-30", 20909.51, "Planilla staff — Mayo"], ["2026-06-15", 4388.51, "Planilla staff — Abono CTS"],
            ["2026-06-30", 20909.51, "Planilla staff — Junio"], ["2026-07-30", 20909.51, "Planilla staff — Julio"],
            ["2026-07-31", 13751.26, "Planilla staff — Gratificación + liquidación"], ["2026-08-30", 20909.51, "Planilla staff — Agosto"],
            ["2026-09-30", 20909.51, "Planilla staff — Setiembre"], ["2026-10-24", 20909.51, "Planilla staff — Octubre"],
          ] } },
          { code: "WBS-03.01.02", cc: "1020", name: "Planilla obreros", type: "mano_obra", budget: 520000, importBudget: 520000,
            change: { amount: 39000, type: "adicional", reason: "Ampliación de plazo de 45 días — Adenda N° 2 al contrato", date: "2026-08-20" },
            gen: { kind: "payroll", fixedWeeks: HCVC_WEEKS, extraWeeks: [[37, 21080.09, "aprobado"], [38, 8912.43, "declarado"]], capataz: 2150 } },
        ] },
        { code: "WBS-03.02", name: "Alquileres", children: [
          { code: "WBS-03.02.01", cc: "1030", name: "Alquiler de andamios NOPIN", type: "alquileres", budget: 105000, gen: { kind: "list", items: [
            ["2026-05-30", "nopin", "Alquiler de andamios — Mayo", 16439.66], ["2026-06-30", "nopin", "Alquiler de andamios — Junio", 16439.66],
            ["2026-07-30", "nopin", "Alquiler de andamios — Julio", 16439.66], ["2026-08-30", "nopin", "Alquiler de andamios — Agosto", 16439.66],
            ["2026-09-30", "nopin", "Alquiler de andamios — Setiembre", 16439.66], ["2026-10-20", "nopin", "Alquiler de andamios — Octubre", 16439.66],
          ] } },
          { code: "WBS-03.02.02", cc: "1040", name: "Alquiler de encofrados ALSINA", type: "alquileres", budget: 575000, gen: { kind: "list", items: [
            ["2026-05-30", "alsina", "Alquiler de encofrados — Mayo", 91591.06], ["2026-06-30", "alsina", "Alquiler de encofrados — Junio", 112654.09],
            ["2026-07-30", "alsina", "Alquiler de encofrados — Julio", 126541.48], ["2026-08-30", "alsina", "Alquiler de encofrados — Agosto", 122331.58],
            ["2026-09-30", "alsina", "Alquiler de encofrados — Setiembre", 100123.45],
          ] } },
        ] },
        { code: "WBS-03.03", name: "Transporte", children: [
          { code: "WBS-03.03.01", cc: "1050", name: "Transporte de equipos", type: "transporte", budget: 112000, gen: { kind: "list", items: [
            ["2026-02-27", "aliaga", "Servicio de transporte de equipos a obra", 6962], ["2026-03-05", "kaori", "Servicio de transporte de equipos a obra", 6962, "RH"],
            ["2026-03-09", "denis", "Servicio de transporte de equipos a obra", 6962], ["2026-05-30", "aliaga", "Transporte de encofrados a obra", 6962],
            ["2026-06-30", "aliaga", "Transporte de encofrados a obra", 6962], ["2026-06-30", "denis", "Transporte de encofrados a obra — Sector 3", 6962],
            ["2026-06-30", "aliaga", "Transporte de encofrados a obra — Sector 3", 6962], ["2026-06-30", "denis", "Transporte de encofrados a obra — Sector 3", 6962],
            ["2026-06-30", "aliaga", "Transporte de encofrados a obra — Sector 3", 6962], ["2026-07-30", "aliaga", "F3 — Encofrados para devolución 1", 7000],
            ["2026-08-31", "aliaga", "F3 — Encofrados para devolución 2", 7000], ["2026-09-12", "denis", "F3 — Encofrados para devolución 3", 7000],
            ["2026-09-26", "aliaga", "F3 — Encofrados para devolución 4", 7000], ["2026-10-10", "aliaga", "F3 — Encofrados para devolución 5", 7000],
            ["2026-10-10", "denis", "F3 — Encofrados para devolución 6", 7000],
          ] } },
        ] },
        { code: "WBS-03.04", name: "Materiales", children: [
          { code: "WBS-03.04.01", cc: "1060", name: "Compra de fenólicos", type: "materiales", budget: 125000, gen: { kind: "list", items: [
            ["2026-03-08", "sanra", "Fenólicos x 12 paquetes", 44064], ["2026-03-23", "alsina", "Tableros fenólicos 18 mm", 25173.33],
            ["2026-03-23", "alsina", "Tableros fenólicos 18 mm — 2do lote", 25173.33], ["2026-05-20", "alsina", "Tableros fenólicos 18 mm — 3er lote", 25173.33],
          ] } },
          { code: "WBS-03.04.02", cc: "1070", name: "Insumo de maderas", type: "materiales", budget: 35000, gen: { kind: "list", items: [
            ["2026-06-10", "maderera", "Tablas de madera tornillo 1\" x 8\" x 10' — 120 tablas", 4560], ["2026-06-24", "maderera", "Pies derechos de eucalipto 2\" x 3\" — 300 pzas", 5220],
            ["2026-07-15", "maderera", "Tablas de madera tornillo — 150 tablas", 5700], ["2026-08-05", "maderera", "Madera para encofrado de escaleras", 6380],
            ["2026-09-02", "maderera", "Tablas de madera tornillo — 110 tablas", 4180], ["2026-09-30", "maderera", "Listones y cuñas de madera", 3960],
          ] } },
          { code: "WBS-03.04.03", cc: "10100", name: "Varios insumos y consumibles", type: "materiales", budget: 6000, gen: { kind: "list", items: [
            ["2026-03-09", "aditivos", "Aditivo acelerante de fragua", 1321.6], ["2026-03-09", "aditivos", "Aditivo desmoldante para encofrado", 1321.6],
          ] } },
        ] },
        { code: "WBS-03.05", name: "Seguridad", children: [
          { code: "WBS-03.05.01", cc: "1080", name: "Seguridad — EMO + SCTR + Vida", type: "seguridad", budget: 2500, gen: { kind: "list", items: [
            ["2026-03-02", "protecta", "SCTR pensión — personal obrero", 94.4], ["2026-03-03", "protecta", "SCTR salud — personal obrero", 94.4],
            ["2026-03-11", "celestial", "Exámenes médicos ocupacionales (EMO)", 1410, "FT", "E001", "2404"],
          ] } },
          { code: "WBS-03.05.02", cc: "1090", name: "Seguridad — Equipos de protección", type: "seguridad", budget: 3500, gen: { kind: "list", items: [
            ["2026-02-27", "acr", "Equipos de protección personal — cascos, guantes, lentes", 3000],
          ] } },
        ] },
        { code: "WBS-03.06", name: "Contingencias", children: [
          { code: "WBS-03.06.01", cc: "10200", name: "Otros — gastos de contingencia", type: "contingencias", budget: 95159.05, gen: { kind: "list", items: [
            ["2026-06-10", "navinco", "Reparación de vía de acceso tras huaico", 38500], ["2026-07-08", "chilete", "Trabajos adicionales — muro de contención Sector 3", 27400],
            ["2026-08-12", "romani", "Reforzamiento de cimentación en Bloque C", 21600], ["2026-09-18", "navinco", "Obras de drenaje pluvial provisional", 12500],
          ] } },
        ] },
      ] },
    ],
    labor: {
      F1: { capataz: 8000, operario: 62000, oficial: 35000, peon: 20000 },
      F2: { capataz: 12500, operario: 108000, oficial: 61500, peon: 33000 },
      F3: { capataz: 40800, operario: 290000, oficial: 160500, peon: 67700 },
    },
    orders: [
      { type: "OS", wbs: "WBS-03.02.02", supplier: "alsina", title: "Alquiler de encofrados metálicos — Fase 3", base: 600000, freq: "mensual", date: "2026-05-04" },
      { type: "OS", wbs: "WBS-03.02.01", supplier: "nopin", title: "Alquiler de andamios multidireccionales", base: 115000, freq: "mensual", date: "2026-05-04" },
      { type: "OS", wbs: "WBS-03.03.01", supplier: "aliaga", title: "Servicio de transporte de encofrados y equipos", base: 70000, freq: "quincenal", date: "2026-05-15" },
      { type: "OC", wbs: "WBS-03.04.01", supplier: "sanra", title: "Fenólicos x 12 paquetes", base: 44064, freq: "unica", date: "2026-03-02", status: "cerrada" },
      { type: "OC", wbs: "WBS-03.04.02", supplier: "maderera", title: "Suministro de madera para encofrado", base: 36000, freq: "quincenal", date: "2026-06-05" },
      { type: "OC", wbs: "WBS-03.05.02", supplier: "acr", title: "Equipos de protección personal", base: 3000, freq: "unica", date: "2026-02-20", status: "cerrada" },
    ],
    valuations: { phases: { F1: [1, 3], F2: [4, 7], F3: [8, 16] }, f3Target: 0.97, fixed: { 12: [465150.68, "2026-08-28"], 13: [413009.91, "2026-09-15"], 14: [251235.03, "2026-09-30"] },
      periods: [["2026-01-16", "2026-02-15"], ["2026-02-16", "2026-03-15"], ["2026-03-16", "2026-03-31"], ["2026-04-01", "2026-04-15"], ["2026-04-16", "2026-04-30"],
        ["2026-05-01", "2026-05-15"], ["2026-05-16", "2026-05-31"], ["2026-06-01", "2026-06-15"], ["2026-06-16", "2026-06-30"], ["2026-07-01", "2026-07-15"],
        ["2026-07-16", "2026-07-31"], ["2026-08-01", "2026-08-15"], ["2026-08-16", "2026-08-31"], ["2026-09-01", "2026-09-15"], ["2026-09-16", "2026-09-30"], ["2026-10-01", "2026-10-15"]],
      pendingFrom: 15 },
    closures: [["2026-01-01", "2026-01-31", "Enero 2026"], ["2026-02-01", "2026-02-28", "Febrero 2026"], ["2026-03-01", "2026-03-31", "Marzo 2026"],
      ["2026-04-01", "2026-04-30", "Abril 2026"], ["2026-05-01", "2026-05-31", "Mayo 2026"], ["2026-06-01", "2026-06-30", "Junio 2026"]],
    fianzaExpiry: "2026-11-10",
    stock: true,
  },
  {
    company: "01", code: "011-RLAL", short_name: "Residencial Los Álamos",
    name: "Edificio Multifamiliar Residencial Los Álamos — 2 sótanos y 12 pisos",
    client_name: "Inmobiliaria Los Álamos del Sur S.A.C.", client_ruc: "20605478912", project_type: "edificacion",
    location: "Miraflores, Lima", address: "Av. José Pardo 845, Miraflores", region: "Lima",
    start: "2026-03-02", end: "2027-01-29", tc: 3.75, contract: 2095000, status: "ejecucion",
    lat: -12.1211, lng: -77.0297, manager: "jcastillo", admin: "jrojas", resident: "rquispe",
    phases: [
      { code: "F1", name: "Fase 1 · Sótanos (nivel de vereda hacia abajo)", start: "2026-03-02", end: "2026-05-31", sale: 470000, color: "#035AA6" },
      { code: "F2", name: "Fase 2 · Casco y torres (nivel de vereda hacia arriba)", start: "2026-06-01", end: "2026-10-31", sale: 870000, color: "#04BF55" },
      { code: "F3", name: "Fase 3 · Acabados húmedos", start: "2026-09-15", end: "2026-12-15", sale: 430000, color: "#F21D2F" },
      { code: "F4", name: "Fase 4 · Acabados secos", start: "2026-11-15", end: "2027-01-29", sale: 325000, color: "#035928" },
    ],
    wbs: [
      { code: "WBS-01", name: "SEGURIDAD", children: [
        { code: "WBS-01.01", name: "Exámenes médicos ocupacionales (EMO)", type: "seguridad", budget: 25000, gen: { kind: "generic", target: 9800, n: 6, pool: ["celestial"], desc: ["Exámenes médicos de ingreso", "Exámenes médicos periódicos"] } },
        { code: "WBS-01.02", name: "Equipos de protección personal (EPP)", type: "seguridad", budget: 40000, gen: { kind: "generic", target: 16400, n: 8, pool: ["acr", "segurindustria"], desc: ["Cascos, guantes y lentes de seguridad", "Arneses y líneas de vida para trabajos en altura", "Botas de seguridad y chalecos reflectivos"] } },
        { code: "WBS-01.03", name: "SCTR y Vida Ley", type: "seguridad", budget: 15000, gen: { kind: "generic", target: 7900, n: 7, pool: ["protecta"], desc: ["SCTR salud y pensión — planilla obrera"] , lima: [["2026-08-05", "rimac", "Póliza Vida Ley — renovación anual (pago central)", 1850]] } },
      ] },
      { code: "WBS-02", name: "OBRAS PROVISIONALES", children: [
        { code: "WBS-02.01", name: "Campamento y oficinas de obra", type: "servicios", budget: 45000, gen: { kind: "generic", target: 41600, n: 6, pool: ["prefab", "constructor"], desc: ["Módulos de oficina y vestuarios", "Instalaciones provisionales de agua y desagüe"] } },
        { code: "WBS-02.02", name: "Servicios: agua, luz e internet", type: "servicios", budget: 25000, gen: { kind: "generic", target: 15300, n: 10, pool: ["claro", "electro"], desc: ["Servicio de internet dedicado", "Consumo de energía eléctrica provisional"] } },
        { code: "WBS-02.03", name: "Cerco perimétrico y señalización", type: "servicios", budget: 30000, gen: { kind: "generic", target: 24950, n: 5, pool: ["constructor"], desc: ["Cerco perimétrico de triplay y malla", "Señalética de obra"] } },
      ] },
      { code: "WBS-03", name: "OBRAS PRELIMINARES", children: [
        { code: "WBS-03.01", name: "Trazo, nivelación y replanteo — Sótanos", type: "servicios", phase: "F1", budget: 85000, margin: 5000, gen: { kind: "generic", target: 80500, n: 6, pool: ["topografo", "unimaq"], desc: ["Servicio de topografía y replanteo", "Nivelación de terreno con maquinaria"] } },
        { code: "WBS-03.02", name: "Trazo, nivelación y replanteo — Torres", type: "servicios", phase: "F2", budget: 60000, margin: 4000, gen: { kind: "generic", target: 38000, n: 4, pool: ["topografo"], desc: ["Servicio de topografía — control de verticalidad"] } },
      ] },
      { code: "WBS-04", name: "OBRAS CIVILES", children: [
        { code: "WBS-04.01", name: "Sótanos", phase: "F1", children: [
          { code: "WBS-04.01.01", name: "Mano de obra — Sótanos", type: "mano_obra", budget: 105000, gen: { kind: "payroll", weeks: [1, 13], target: 101800 } },
          { code: "WBS-04.01.02", name: "Alquileres — Sótanos", type: "alquileres", budget: 55000, gen: { kind: "generic", target: 59400, n: 6, pool: ["alsina", "nopin"], desc: ["Alquiler de encofrado para muros de contención", "Alquiler de andamios para muros pantalla"] } },
          { code: "WBS-04.01.03", name: "Materiales — Sótanos", type: "materiales", budget: 90000, gen: { kind: "generic", target: 86200, n: 9, pool: ["unicon", "ferreandina"], desc: ["Concreto premezclado f'c 280 kg/cm²", "Acero corrugado para muros anclados"] } },
        ] },
        { code: "WBS-04.02", name: "Torres", phase: "F2", children: [
          { code: "WBS-04.02.01", name: "Mano de obra — Torres", type: "mano_obra", budget: 175000, gen: { kind: "payroll", weeks: [14, 34], target: 128600, unpaidWeeks: 1, declaredWeeks: 1 } },
          { code: "WBS-04.02.02", name: "Alquileres — Torres", type: "alquileres", budget: 95000, gen: { kind: "generic", target: 64400, n: 5, pool: ["alsina"], desc: ["Alquiler de encofrado de losas y columnas"],
            extra: [["2026-08-15", "equiposmenores", "Alquiler de equipos menores — 1ra quincena agosto", 1250], ["2026-08-31", "equiposmenores", "Alquiler de equipos menores — 2da quincena agosto", 1250],
              ["2026-09-15", "equiposmenores", "Alquiler de equipos menores — 1ra quincena setiembre", 1250], ["2026-09-30", "equiposmenores", "Alquiler de equipos menores — 2da quincena setiembre", 1250],
              ["2026-10-15", "equiposmenores", "Alquiler de equipos menores — 1ra quincena octubre", 1250], ["2026-10-24", "equiposmenores", "Alquiler de equipos menores — 2da quincena octubre", 1250]] } },
          { code: "WBS-04.02.03", name: "Materiales — Torres", type: "materiales", budget: 150000, gen: { kind: "generic", target: 118300, n: 12, pool: ["unicon", "ferreandina", "constructor"], desc: ["Concreto premezclado para losas", "Acero corrugado 1/2\" y 3/8\"", "Clavos, alambre y consumibles"] } },
        ] },
      ] },
      { code: "WBS-05", name: "ACABADOS HÚMEDOS", phase: "F3", children: [
        { code: "WBS-05.01", name: "Mano de obra — Acabados húmedos", type: "mano_obra", budget: 85000, gen: { kind: "generic", target: 9800, n: 2, pool: ["romani"], desc: ["Subcontrato de tarrajeo — avance 1"], retention: 5 } },
        { code: "WBS-05.02", name: "Tarrajeos, cerámicos y enchapes", type: "materiales", budget: 120000, gen: { kind: "generic", target: 18400, n: 3, pool: ["ceramicos", "constructor"], desc: ["Cerámico 60x60 para áreas comunes", "Cemento y arena fina para tarrajeo"] } },
        { code: "WBS-05.03", name: "Instalaciones sanitarias", type: "materiales", budget: 75000, gen: { kind: "generic", target: 12600, n: 3, pool: ["constructor", "quimica"], desc: ["Tuberías PVC y accesorios sanitarios"] } },
      ] },
      { code: "WBS-06", name: "ACABADOS SECOS", phase: "F4", children: [
        { code: "WBS-06.01", name: "Carpintería de madera y muebles de cocina", type: "materiales", budget: 110000, gen: { kind: "none" } },
        { code: "WBS-06.02", name: "Ventanas, mamparas y vidrios", type: "materiales", budget: 95000, gen: { kind: "none" } },
        { code: "WBS-06.03", name: "Pintura", type: "materiales", budget: 45000, gen: { kind: "none" } },
      ] },
      { code: "WBS-07", name: "GASTOS GENERALES", children: [
        { code: "WBS-07.01", name: "Planilla staff", type: "gastos_generales", budget: 180000, gen: { kind: "staff", from: "2026-03-31", monthly: 13600 } },
        { code: "WBS-07.02", name: "Gastos administrativos y de campo", type: "gastos_generales", budget: 40000, gen: { kind: "generic", target: 22700, n: 26, pool: ["pension", "grifo", "chankas"], desc: ["Alimentación de personal técnico", "Combustible para camioneta de obra", "Movilidad y pasajes"], campo: true } },
      ] },
    ],
    labor: {
      F1: { capataz: 6200, operario: 52000, oficial: 30300, peon: 16500 },
      F2: { capataz: 10400, operario: 86600, oficial: 50400, peon: 27600 },
      F3: { capataz: 5100, operario: 42500, oficial: 24700, peon: 12700 },
    },
    orders: [
      { type: "OS", wbs: "WBS-04.02.02", supplier: "equiposmenores", title: "Alquiler de equipos menores (vibradoras, amoladoras, taladros)", base: 10000, freq: "quincenal", date: "2026-08-01" },
      { type: "OS", wbs: "WBS-04.02.02", supplier: "alsina", title: "Alquiler de encofrado de losas y columnas — Torres", base: 80000, freq: "mensual", date: "2026-06-01" },
      { type: "OS", wbs: "WBS-02.02", supplier: "claro", title: "Servicio de internet dedicado — 12 meses", base: 4800, freq: "mensual", date: "2026-03-05" },
      { type: "OC", wbs: "WBS-06.02", supplier: "vidrieria", title: "Suministro e instalación de ventanas y mamparas", base: 81000, freq: "unica", date: "2026-10-02" },
      { type: "OC", wbs: "WBS-06.01", supplier: "maderera", title: "Carpintería de madera y muebles de cocina", base: 64000, freq: "unica", date: "2026-10-12" },
      { type: "OC", wbs: "WBS-01.02", supplier: "segurindustria", title: "Reposición de EPP — último trimestre", base: 12000, freq: "unica", date: "2026-10-25", status: "solicitada" },
    ],
    valuations: { phases: { F1: [1, 3], F2: [4, 8] }, pct: { F1: 1, F2: 0.78 },
      periods: [["2026-03-02", "2026-03-31"], ["2026-04-01", "2026-04-30"], ["2026-05-01", "2026-05-31"], ["2026-06-01", "2026-06-30"],
        ["2026-07-01", "2026-07-31"], ["2026-08-01", "2026-08-31"], ["2026-09-01", "2026-09-30"], ["2026-10-01", "2026-10-25"]], pendingFrom: 7 },
    closures: [["2026-03-01", "2026-03-31", "Marzo 2026"], ["2026-04-01", "2026-04-30", "Abril 2026"], ["2026-05-01", "2026-05-31", "Mayo 2026"]],
    fianzaExpiry: "2027-02-28",
    stock: true,
  },
  {
    company: "01", code: "012-IEPC", short_name: "I.E. Pedro Coronado",
    name: "Institución Educativa Emblemática Pedro Coronado Arrascue",
    client_name: "Municipalidad Distrital de Bellavista", client_ruc: "20131377224", project_type: "edificacion",
    location: "Bellavista, Callao", address: "Jr. Colina 410, Bellavista", region: "Callao",
    start: "2026-11-16", end: "2027-08-31", tc: 3.75, contract: 4200000, status: "preparacion",
    lat: -12.0626, lng: -77.1103, manager: "jcastillo", admin: null, resident: "rquispe",
    phases: [
      { code: "F1", name: "Fase 1 · Sótano y cimentación", start: "2026-11-16", end: "2027-01-31", sale: 820000, color: "#035AA6" },
      { code: "F2", name: "Fase 2 · Estructuras", start: "2027-02-01", end: "2027-05-15", sale: 1680000, color: "#04BF55" },
      { code: "F3", name: "Fase 3 · Acabados húmedos", start: "2027-04-15", end: "2027-07-15", sale: 980000, color: "#F21D2F" },
      { code: "F4", name: "Fase 4 · Acabados secos", start: "2027-06-15", end: "2027-08-31", sale: 720000, color: "#035928" },
    ],
    wbs: [
      { code: "WBS-01", name: "SEGURIDAD", children: [
        { code: "WBS-01.01", name: "EMO, SCTR y Vida Ley", type: "seguridad", budget: 48000, gen: { kind: "none" } },
        { code: "WBS-01.02", name: "Equipos de protección personal", type: "seguridad", budget: 62000, gen: { kind: "none" } },
      ] },
      { code: "WBS-02", name: "OBRAS PROVISIONALES", children: [
        { code: "WBS-02.01", name: "Campamento, oficinas y servicios", type: "servicios", budget: 135000, gen: { kind: "none" } },
      ] },
      { code: "WBS-03", name: "OBRAS CIVILES", children: [
        { code: "WBS-03.01", name: "Sótano y cimentación", phase: "F1", children: [
          { code: "WBS-03.01.01", name: "Mano de obra", type: "mano_obra", budget: 280000, gen: { kind: "none" } },
          { code: "WBS-03.01.02", name: "Alquileres", type: "alquileres", budget: 120000, gen: { kind: "none" } },
          { code: "WBS-03.01.03", name: "Materiales", type: "materiales", budget: 310000, gen: { kind: "none" } },
        ] },
        { code: "WBS-03.02", name: "Estructuras", phase: "F2", children: [
          { code: "WBS-03.02.01", name: "Mano de obra", type: "mano_obra", budget: 520000, gen: { kind: "none" } },
          { code: "WBS-03.02.02", name: "Alquileres", type: "alquileres", budget: 260000, gen: { kind: "none" } },
          { code: "WBS-03.02.03", name: "Materiales", type: "materiales", budget: 690000, gen: { kind: "none" } },
        ] },
      ] },
      { code: "WBS-04", name: "ACABADOS", children: [
        { code: "WBS-04.01", name: "Acabados húmedos", type: "materiales", phase: "F3", budget: 540000, gen: { kind: "none" } },
        { code: "WBS-04.02", name: "Acabados secos", type: "materiales", phase: "F4", budget: 395000, gen: { kind: "none" } },
      ] },
      { code: "WBS-05", name: "GASTOS GENERALES", children: [
        { code: "WBS-05.01", name: "Planilla staff", type: "gastos_generales", budget: 230000, gen: { kind: "none" } },
      ] },
    ],
    orders: [
      { type: "OS", wbs: "WBS-02.01", supplier: "prefab", title: "Módulos de oficina y vestuarios para obra", base: 38000, freq: "unica", date: "2026-10-20", status: "solicitada" },
    ],
    fianzaExpiry: "2027-09-30",
  },

  // ===================================================================
  // EMPRESA 02 · GC INFRAESTRUCTURA Y MINERÍA
  // ===================================================================
  {
    company: "02", code: "020-MTTN", short_name: "Muro Tajo Norte",
    name: "Muro de contención Tajo Norte",
    client_name: "Sociedad Minera Cerro Alto S.A.A.", client_ruc: "20170072465", project_type: "mineria",
    location: "Yarabamba, Arequipa", address: "Unidad minera Cerro Alto — Tajo Norte", region: "Arequipa",
    start: "2026-05-04", end: "2026-12-18", tc: 3.75, contract: 1368000, status: "ejecucion",
    lat: -16.5300, lng: -71.5900, manager: "jcastillo", admin: "mparedes", resident: "lfernandez",
    phases: [
      { code: "F1", name: "Fase 1 · Excavación y cimentación", start: "2026-05-04", end: "2026-07-31", sale: 520000, color: "#035AA6" },
      { code: "F2", name: "Fase 2 · Muro y drenaje", start: "2026-08-01", end: "2026-11-30", sale: 690000, color: "#04BF55" },
      { code: "F3", name: "Fase 3 · Relleno y cierre", start: "2026-11-15", end: "2026-12-18", sale: 158000, color: "#F21D2F" },
    ],
    wbs: [
      { code: "WBS-01", name: "MOVIMIENTO DE TIERRAS", phase: "F1", children: [
        { code: "WBS-01.01", name: "Excavación masiva", type: "alquileres", budget: 210000, gen: { kind: "generic", target: 198400, n: 6, pool: ["unimaq", "andinos"], desc: ["Alquiler de excavadora CAT 336", "Alquiler de tractor oruga D6"] } },
        { code: "WBS-01.02", name: "Eliminación de material excedente", type: "transporte", budget: 95000, gen: { kind: "generic", target: 88700, n: 8, pool: ["aliaga", "denis"], desc: ["Transporte de material excedente a botadero", "Volquetes 15 m³ — eliminación"] } },
      ] },
      { code: "WBS-02", name: "CONCRETO ARMADO", phase: "F2", children: [
        { code: "WBS-02.01", name: "Mano de obra", type: "mano_obra", budget: 230000, gen: { kind: "payroll", weeks: [1, 25], target: 128400, unpaidWeeks: 1 } },
        { code: "WBS-02.02", name: "Concreto premezclado f'c 280", type: "materiales", budget: 260000, gen: { kind: "generic", target: 112600, n: 6, pool: ["unicon"], desc: ["Concreto premezclado f'c 280 kg/cm² — muro", "Servicio de bomba de concreto"] } },
        { code: "WBS-02.03", name: "Acero de refuerzo", type: "materiales", budget: 145000, gen: { kind: "generic", target: 61800, n: 4, pool: ["ferreandina"], desc: ["Acero corrugado 3/4\" y 5/8\""] } },
        { code: "WBS-02.04", name: "Encofrado metálico", type: "alquileres", budget: 70000, gen: { kind: "generic", target: 31500, n: 3, pool: ["alsina"], desc: ["Alquiler de encofrado trepante"] } },
      ] },
      { code: "WBS-03", name: "DRENAJE", phase: "F2", children: [
        { code: "WBS-03.01", name: "Geotextil, tuberías y filtros", type: "materiales", budget: 48000, gen: { kind: "generic", target: 9700, n: 2, pool: ["constructor"], desc: ["Geotextil no tejido y tubería perforada"] } },
      ] },
      { code: "WBS-04", name: "SEGURIDAD Y MEDIO AMBIENTE", children: [
        { code: "WBS-04.01", name: "EPP, SCTR y EMO", type: "seguridad", budget: 22000, gen: { kind: "generic", target: 13900, n: 7, pool: ["acr", "protecta", "celestial"], desc: ["EPP para minería", "SCTR salud y pensión", "Exámenes médicos de ingreso a mina"] } },
      ] },
      { code: "WBS-05", name: "GASTOS GENERALES", children: [
        { code: "WBS-05.01", name: "Staff y administración", type: "gastos_generales", budget: 60000, gen: { kind: "staff", from: "2026-05-31", monthly: 6960 } },
      ] },
    ],
    labor: { F2: { capataz: 9200, operario: 115000, oficial: 66700, peon: 39100 } },
    orders: [
      { type: "OC", wbs: "WBS-02.02", supplier: "unicon", title: "Concreto premezclado — 1ra etapa del muro", base: 115000, freq: "unica", date: "2026-08-03" },
      { type: "OC", wbs: "WBS-02.02", supplier: "unicon", title: "Concreto premezclado — 2da etapa del muro", base: 96000, freq: "unica", date: "2026-10-19", noInvoices: true },
      { type: "OS", wbs: "WBS-01.01", supplier: "unimaq", title: "Alquiler de maquinaria para excavación masiva", base: 150000, freq: "mensual", date: "2026-05-04" },
    ],
    valuations: { phases: { F1: [1, 3], F2: [4, 6] }, pct: { F1: 1, F2: 0.36 },
      periods: [["2026-05-04", "2026-05-31"], ["2026-06-01", "2026-06-30"], ["2026-07-01", "2026-07-31"], ["2026-08-01", "2026-08-31"], ["2026-09-01", "2026-09-30"], ["2026-10-01", "2026-10-25"]], pendingFrom: 6 },
    closures: [["2026-05-01", "2026-05-31", "Mayo 2026"], ["2026-06-01", "2026-06-30", "Junio 2026"]],
    fianzaExpiry: "2027-01-20",
    stock: true,
  },
  {
    company: "02", code: "021-VAKM", short_name: "Vía de acceso Km 12–28",
    name: "Vía de acceso Km 12–28 — Mejoramiento y pavimentación",
    client_name: "Minera Los Andes Cajamarca S.A.", client_ruc: "20453652174", project_type: "infraestructura",
    location: "Encañada, Cajamarca", address: "Carretera de acceso a mina, Km 12 al Km 28", region: "Cajamarca",
    start: "2026-02-02", end: "2026-11-27", extended: "2027-01-15", tc: 3.75, contract: 3780000, status: "ejecucion",
    lat: -7.0300, lng: -78.4300, manager: "jcastillo", admin: "mparedes", resident: null,
    phases: [
      { code: "F1", name: "Fase 1 · Explanaciones y movimiento de tierras", start: "2026-02-02", end: "2026-05-31", sale: 1240000, color: "#035AA6" },
      { code: "F2", name: "Fase 2 · Pavimentos y drenaje", start: "2026-06-01", end: "2026-10-31", sale: 1750000, color: "#04BF55" },
      { code: "F3", name: "Fase 3 · Señalización y obras complementarias", start: "2026-10-01", end: "2027-01-15", sale: 790000, color: "#F21D2F" },
    ],
    wbs: [
      { code: "WBS-01", name: "MANO DE OBRA", children: [
        { code: "WBS-01.01", name: "Mano de obra — Fase 1", type: "mano_obra", phase: "F1", budget: 232705.75, gen: { kind: "payroll", weeks: [1, 17], target: 226900 } },
        { code: "WBS-01.02", name: "Mano de obra — Fase 2", type: "mano_obra", phase: "F2", budget: 465411.5, gen: { kind: "payroll", weeks: [18, 37], target: 401300, unpaidWeeks: 2 } },
        { code: "WBS-01.03", name: "Mano de obra — Fase 3", type: "mano_obra", phase: "F3", budget: 558493.8, gen: { kind: "payroll", weeks: [36, 38], target: 21400, declaredWeeks: 1 } },
      ] },
      { code: "WBS-02", name: "MAQUINARIA Y EQUIPOS", children: [
        { code: "WBS-02.01", name: "Alquiler de maquinaria pesada", type: "alquileres", phase: "F1", budget: 380000, importBudget: 380000,
          change: { amount: 40000, type: "adicional", reason: "Mayor volumen de corte en roca — Km 21+400", date: "2026-04-18" },
          gen: { kind: "generic", target: 431500, n: 8, pool: ["unimaq", "unimaq", "unimaq", "andinos"], desc: ["Alquiler de excavadora sobre orugas", "Alquiler de motoniveladora 140K", "Alquiler de rodillo liso vibratorio"] } },
        { code: "WBS-02.02", name: "Maquinaria de pavimentación", type: "alquileres", phase: "F2", budget: 310000, gen: { kind: "generic", target: 268000, n: 7, pool: ["unimaq"], desc: ["Alquiler de imprimadora y cisterna", "Alquiler de rodillo neumático"] } },
        { code: "WBS-02.03", name: "Estación total y topografía", type: "alquileres", budget: 48000, gen: { kind: "generic", target: 33200, n: 8, pool: ["topo"], desc: ["Alquiler de estación total Leica TS07 — mensual"] } },
      ] },
      { code: "WBS-03", name: "MATERIALES", children: [
        { code: "WBS-03.01", name: "Base granular y agregados", type: "materiales", phase: "F2", budget: 290000, gen: { kind: "generic", target: 201400, n: 9, pool: ["agregados"], desc: ["Material de base granular", "Material de sub-base"] } },
        { code: "WBS-03.02", name: "Concreto para obras de arte", type: "materiales", phase: "F2", budget: 180000, gen: { kind: "generic", target: 122600, n: 6, pool: ["unicon"], desc: ["Concreto f'c 210 kg/cm² para alcantarillas", "Concreto para cunetas revestidas"] } },
        { code: "WBS-03.03", name: "Tuberías y alcantarillas", type: "materiales", phase: "F2", budget: 95000, gen: { kind: "generic", target: 61300, n: 5, pool: ["constructor", "quimica"], desc: ["Tubería TMC Ø 36\"", "Accesorios y sellantes"] } },
        { code: "WBS-03.04", name: "Señalización vial", type: "materiales", phase: "F3", budget: 75000, gen: { kind: "generic", target: 4100, n: 1, pool: ["constructor"], desc: ["Pintura de tráfico y microesferas"] } },
      ] },
      { code: "WBS-04", name: "TRANSPORTE", children: [
        { code: "WBS-04.01", name: "Transporte de materiales y personal", type: "transporte", budget: 120000, gen: { kind: "generic", target: 92800, n: 14, pool: ["aliaga", "denis", "ransa", "kaori"], desc: ["Transporte de agregados", "Traslado de personal a frente de trabajo", "Transporte de tuberías"] } },
      ] },
      { code: "WBS-05", name: "SEGURIDAD", children: [
        { code: "WBS-05.01", name: "EPP y señalización de obra", type: "seguridad", budget: 42000, gen: { kind: "generic", target: 35900, n: 9, pool: ["acr", "segurindustria"], desc: ["EPP para personal de campo", "Conos, tranqueras y señalización temporal"] } },
        { code: "WBS-05.02", name: "SCTR, EMO y Vida Ley", type: "seguridad", budget: 28000, gen: { kind: "generic", target: 19800, n: 8, pool: ["protecta", "celestial"], desc: ["SCTR salud y pensión", "Exámenes médicos ocupacionales"], lima: [["2026-07-10", "rimac", "Póliza Vida Ley — pago central desde Lima", 2640]] } },
      ] },
      { code: "WBS-06", name: "GASTOS GENERALES", children: [
        { code: "WBS-06.01", name: "Planilla staff", type: "gastos_generales", budget: 210000, gen: { kind: "staff", from: "2026-02-28", monthly: 19400 } },
        { code: "WBS-06.02", name: "Campamento, alimentación y hospedaje", type: "gastos_generales", budget: 85000, gen: { kind: "generic", target: 71200, n: 30, pool: ["hostal", "pension", "chankas"], desc: ["Hospedaje de personal técnico", "Alimentación de personal", "Pasajes de personal a obra"], campo: true } },
        { code: "WBS-06.03", name: "Combustible y lubricantes", type: "gastos_generales", budget: 64000, gen: { kind: "generic", target: 55900, n: 18, pool: ["grifo"], desc: ["Petróleo Diésel B5 para maquinaria", "Gasolina 90 para camionetas"], campo: true } },
      ] },
    ],
    labor: {
      F1: { capataz: 8400, operario: 116350, oficial: 64200, peon: 43755.75 },
      F2: { capataz: 16750, operario: 232700, oficial: 128450, peon: 87511.5 },
      F3: { capataz: 20100, operario: 279250, oficial: 154150, peon: 104993.8 },
    },
    orders: [
      { type: "OS", wbs: "WBS-02.01", supplier: "unimaq", title: "Alquiler de maquinaria pesada — explanaciones", base: 300000, freq: "mensual", date: "2026-02-02", allowOverride: true },
      { type: "OS", wbs: "WBS-02.03", supplier: "topo", title: "Alquiler de estación total Leica TS07", base: 38000, freq: "mensual", date: "2026-02-05" },
      { type: "OS", wbs: "WBS-02.02", supplier: "unimaq", title: "Maquinaria de pavimentación", base: 300000, freq: "mensual", date: "2026-06-01" },
      { type: "OC", wbs: "WBS-03.01", supplier: "agregados", title: "Suministro de base granular", base: 240000, freq: "quincenal", date: "2026-06-03" },
    ],
    valuations: { phases: { F1: [1, 4], F2: [5, 9] }, pct: { F1: 1, F2: 0.88 },
      periods: [["2026-02-02", "2026-02-28"], ["2026-03-01", "2026-03-31"], ["2026-04-01", "2026-04-30"], ["2026-05-01", "2026-05-31"],
        ["2026-06-01", "2026-06-30"], ["2026-07-01", "2026-07-31"], ["2026-08-01", "2026-08-31"], ["2026-09-01", "2026-09-30"], ["2026-10-01", "2026-10-25"]], pendingFrom: 8 },
    closures: [["2026-02-01", "2026-02-28", "Febrero 2026"], ["2026-03-01", "2026-03-31", "Marzo 2026"], ["2026-04-01", "2026-04-30", "Abril 2026"]],
    fianzaExpiry: "2026-10-20",
    stock: true,
  },
  {
    company: "02", code: "022-CM120", short_name: "Campamento minero",
    name: "Campamento minero de 120 camas",
    client_name: "Minera Huaylas Norte S.A.C.", client_ruc: "20530214785", project_type: "mineria",
    location: "San Marcos, Huari", address: "Unidad minera Huaylas Norte", region: "Áncash",
    start: "2026-04-06", end: "2026-12-31", tc: 3.75, contract: 1640000, status: "ejecucion",
    lat: -9.5300, lng: -77.0500, manager: "jcastillo", admin: "mparedes", resident: "lfernandez",
    phases: [
      { code: "F1", name: "Fase 1 · Plataformas y cimentación", start: "2026-04-06", end: "2026-06-30", sale: 480000, color: "#035AA6" },
      { code: "F2", name: "Fase 2 · Montaje de módulos", start: "2026-07-01", end: "2026-10-31", sale: 820000, color: "#04BF55" },
      { code: "F3", name: "Fase 3 · Instalaciones y equipamiento", start: "2026-10-15", end: "2026-12-31", sale: 340000, color: "#F21D2F" },
    ],
    wbs: [
      { code: "WBS-C1", name: "SEGURIDAD", children: [
        { code: "WBS-C1.01", name: "Señalización", type: "seguridad", budget: 4000, gen: { kind: "none" } },
        { code: "WBS-C1.02", name: "EPP y protección colectiva", type: "seguridad", budget: 15000, gen: { kind: "generic", target: 14240, n: 6, pool: ["acr", "segurindustria"], desc: ["EPP para trabajos en altura", "Protección colectiva — barandas y redes"], allPaid: true } },
        { code: "WBS-C1.03", name: "SCTR, EMO y pólizas", type: "seguridad", budget: 10000, gen: { kind: "generic", target: 10400, n: 5, pool: ["protecta", "celestial"], desc: ["SCTR salud y pensión", "Exámenes médicos de ingreso a mina"], allPaid: true, lima: [["2026-08-20", "rimac", "Póliza de responsabilidad civil — pago central desde Lima", 3360]] } },
      ] },
      { code: "WBS-C2", name: "OBRAS PROVISIONALES", children: [
        { code: "WBS-C2.01", name: "Oficinas y almacén temporal", type: "servicios", budget: 42000, gen: { kind: "generic", target: 39800, n: 4, pool: ["prefab", "constructor"], desc: ["Módulos de oficina temporal", "Almacén de materiales"] } },
        { code: "WBS-C2.02", name: "Servicios temporales", type: "servicios", budget: 30000, gen: { kind: "generic", target: 17600, n: 8, pool: ["claro", "grifo"], desc: ["Internet satelital", "Combustible para grupo electrógeno"] } },
      ] },
      { code: "WBS-C3", name: "EQUIPOS", children: [
        { code: "WBS-C3.01", name: "Alquiler de maquinaria", type: "alquileres", budget: 95000, gen: { kind: "generic", target: 78300, n: 6, pool: ["unimaq", "andinos"], desc: ["Alquiler de grúa telescópica 50 t", "Alquiler de retroexcavadora"] } },
        { code: "WBS-C3.02", name: "Equipos menores", type: "alquileres", budget: 30000, gen: { kind: "generic", target: 21900, n: 7, pool: ["equiposmenores"], desc: ["Alquiler de equipos menores — quincena"] } },
      ] },
      { code: "WBS-C4", name: "MANO DE OBRA", children: [
        { code: "WBS-C4.01", name: "Operarios", type: "mano_obra", budget: 147000, gen: { kind: "payroll", weeks: [1, 29], target: 107800, paidTarget: 98000 } },
        { code: "WBS-C4.02", name: "Técnicos", type: "mano_obra", budget: 73000, gen: { kind: "staff", from: "2026-04-30", monthly: 6642.86, label: "Planilla de técnicos" } },
      ] },
      { code: "WBS-C5", name: "MATERIALES", children: [
        { code: "WBS-C5.01", name: "Concreto", type: "materiales", budget: 350000, gen: { kind: "generic", target: 225000, n: 9, pool: ["unicon"], desc: ["Concreto premezclado f'c 210 kg/cm² — plataformas", "Concreto para losas de módulos"], allPaid: true } },
        { code: "WBS-C5.02", name: "Acero", type: "materiales", budget: 260000, gen: { kind: "generic", target: 171000, n: 7, pool: ["ferreandina"], desc: ["Acero corrugado y mallas electrosoldadas"], paidTarget: 152600 } },
      ] },
      { code: "WBS-C6", name: "MÓDULOS E INSTALACIONES", children: [
        { code: "WBS-C6.01", name: "Módulos prefabricados habitacionales", type: "materiales", budget: 240000, gen: { kind: "generic", target: 168000, n: 4, pool: ["prefab"], desc: ["Módulos habitacionales prefabricados — entrega parcial"] } },
        { code: "WBS-C6.02", name: "Instalaciones eléctricas y sanitarias", type: "materiales", budget: 80000, gen: { kind: "generic", target: 9200, n: 2, pool: ["constructor"], desc: ["Cableado y tableros eléctricos"] } },
      ] },
    ],
    labor: { F1: { capataz: 4200, operario: 36000, oficial: 0, peon: 9800 }, F2: { capataz: 6800, operario: 61000, oficial: 0, peon: 15200 }, F3: { capataz: 1800, operario: 9000, oficial: 0, peon: 3200 } },
    orders: [
      { type: "OS", wbs: "WBS-C6.01", supplier: "prefab", title: "Suministro e instalación de módulos habitacionales", base: 240000, freq: "unica", date: "2026-06-15" },
      { type: "OC", wbs: "WBS-C5.02", supplier: "ferreandina", title: "Acero corrugado y mallas electrosoldadas", base: 200000, freq: "quincenal", date: "2026-04-10" },
      { type: "OC", wbs: "WBS-C5.01", supplier: "unicon", title: "Concreto premezclado para plataformas y losas", base: 260000, freq: "quincenal", date: "2026-04-10" },
    ],
    valuations: { phases: { F1: [1, 3], F2: [4, 7] }, pct: { F1: 1, F2: 0.72 },
      periods: [["2026-04-06", "2026-04-30"], ["2026-05-01", "2026-05-31"], ["2026-06-01", "2026-06-30"], ["2026-07-01", "2026-07-31"],
        ["2026-08-01", "2026-08-31"], ["2026-09-01", "2026-09-30"], ["2026-10-01", "2026-10-25"]], pendingFrom: 6 },
    closures: [["2026-04-01", "2026-04-30", "Abril 2026"], ["2026-05-01", "2026-05-31", "Mayo 2026"]],
    fianzaExpiry: "2026-11-05",
    stock: true,
  },
  {
    company: "02", code: "023-PATR", short_name: "Planta de agua tratada",
    name: "Planta de tratamiento de agua potable — PTAP Ica",
    client_name: "Fondo de Inversión Agua Sur — Proyecto PTAP Ica", client_ruc: "20614785236", project_type: "saneamiento",
    location: "Los Aquijes, Ica", address: "Sector Yaurilla, Los Aquijes", region: "Ica",
    start: "2026-06-01", end: "2027-03-31", tc: 3.75, contract: 1050000, status: "cancelada",
    lat: -14.0700, lng: -75.7300, manager: "jcastillo", admin: "mparedes", resident: null,
    cancelledAt: "2026-09-18",
    phases: [
      { code: "F1", name: "Fase 1 · Movimiento de tierras y cimentación", start: "2026-06-01", end: "2026-08-31", sale: 380000, color: "#035AA6" },
      { code: "F2", name: "Fase 2 · Estructuras del reservorio", start: "2026-09-01", end: "2026-12-31", sale: 470000, color: "#04BF55" },
      { code: "F3", name: "Fase 3 · Equipamiento", start: "2027-01-01", end: "2027-03-31", sale: 200000, color: "#F21D2F" },
    ],
    wbs: [
      { code: "WBS-01", name: "OBRAS PRELIMINARES", phase: "F1", children: [
        { code: "WBS-01.01", name: "Movilización y campamento", type: "servicios", budget: 45000, gen: { kind: "generic", target: 43900, n: 4, pool: ["prefab", "aliaga"], desc: ["Movilización de equipos", "Instalación de campamento"], until: "2026-09-15" } },
        { code: "WBS-01.02", name: "Trazo y topografía", type: "servicios", budget: 12000, gen: { kind: "generic", target: 9800, n: 3, pool: ["topografo"], desc: ["Levantamiento topográfico"], until: "2026-09-15" } },
      ] },
      { code: "WBS-02", name: "MOVIMIENTO DE TIERRAS", phase: "F1", children: [
        { code: "WBS-02.01", name: "Excavación y nivelación", type: "alquileres", budget: 140000, gen: { kind: "generic", target: 104600, n: 5, pool: ["unimaq"], desc: ["Alquiler de excavadora y volquetes"], until: "2026-09-15" } },
      ] },
      { code: "WBS-03", name: "ESTRUCTURAS", phase: "F2", children: [
        { code: "WBS-03.01", name: "Mano de obra", type: "mano_obra", budget: 160000, gen: { kind: "payroll", weeks: [1, 15], target: 58400 } },
        { code: "WBS-03.02", name: "Concreto", type: "materiales", budget: 210000, gen: { kind: "generic", target: 18800, n: 2, pool: ["unicon"], desc: ["Concreto para solado y cimentación"], until: "2026-09-15" } },
        { code: "WBS-03.03", name: "Acero", type: "materiales", budget: 120000, gen: { kind: "none" } },
      ] },
      { code: "WBS-04", name: "EQUIPAMIENTO", phase: "F3", children: [
        { code: "WBS-04.01", name: "Bombas y filtros", type: "materiales", budget: 150000, gen: { kind: "none" } },
      ] },
      { code: "WBS-05", name: "GASTOS GENERALES", children: [
        { code: "WBS-05.01", name: "Planilla staff", type: "gastos_generales", budget: 53000, gen: { kind: "staff", from: "2026-06-30", monthly: 11466.67, until: "2026-09-18" } },
      ] },
    ],
    orders: [
      { type: "OS", wbs: "WBS-02.01", supplier: "unimaq", title: "Alquiler de maquinaria para excavación", base: 140000, freq: "mensual", date: "2026-06-01", status: "cerrada" },
      { type: "OC", wbs: "WBS-03.03", supplier: "ferreandina", title: "Acero de refuerzo para reservorio", base: 120000, freq: "unica", date: "2026-08-25", status: "anulada", noInvoices: true },
    ],
    valuations: { phases: { F1: [1, 3] }, pct: { F1: 0.62 },
      periods: [["2026-06-01", "2026-06-30"], ["2026-07-01", "2026-07-31"], ["2026-08-01", "2026-08-31"]], pendingFrom: 99 },
    fianzaExpiry: "2027-04-30",
  },
];
