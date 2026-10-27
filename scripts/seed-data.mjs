// Datos maestros de la siembra. Los montos de la obra 010-HCVC provienen de la plantilla
// "EXPENSE FINANCIERO FASE 3-2026-Rev.JCC" entregada por el cliente.

export const TODAY = "2026-10-27";
export const PASSWORD = "GrupoCruz2026!";

export const COMPANIES = [
  { code: "01", name: "GC Ingeniería y Construcción", legal_name: "GRUPO CRUZ INGENIERÍA Y CONSTRUCCIÓN S.A.C.", ruc: "20602161529", tagline: "Ingeniería y Construcción", logo_key: "ingenieria", accent_color: "#035AA6", sort: 1 },
  { code: "02", name: "GC Infraestructura y Minería", legal_name: "GRUPO CRUZ INFRAESTRUCTURA Y MINERÍA S.A.C.", ruc: "20611874532", tagline: "Infraestructura y Minería", logo_key: "infraestructura", accent_color: "#035928", sort: 2 },
  { code: "03", name: "GC Edificaciones", legal_name: "GRUPO CRUZ EDIFICACIONES S.A.C.", ruc: "20612398471", tagline: "Edificaciones", logo_key: "edificaciones", accent_color: "#F21D2F", sort: 3 },
  { code: "04", name: "GC Contratistas Generales", legal_name: "GRUPO CRUZ CONTRATISTAS GENERALES S.A.C.", ruc: "20613057716", tagline: "Contratistas Generales", logo_key: "contratistas", accent_color: "#04BF55", sort: 4 },
];

// role por empresa; projects = null → todas las obras de la empresa
export const USERS = [
  { key: "gerencia", email: "gerencia@grupocruz.pe", full_name: "Carlos Mendoza Ríos", position: "Gerente General", phone: "987 654 321", dni: "40125896", avatar_color: "#062A4D", is_holding_admin: true, memberships: [] },
  { key: "jcastillo", email: "jcastillo@grupocruz.pe", full_name: "Juan Castillo Cruz", position: "Gerente de Proyectos", phone: "956 214 870", dni: "41587236", avatar_color: "#035AA6",
    memberships: [{ company: "01", role: "gerente_proyectos" }, { company: "02", role: "gerente_proyectos" }] },
  { key: "jrojas", email: "jrojas@grupocruz.pe", full_name: "Judith Rojas Huillca", position: "Administradora de obra", phone: "974 321 655", dni: "45896321", avatar_color: "#04BF55",
    memberships: [{ company: "01", role: "administrador", projects: ["010-HCVC", "011-RLAL"] }] },
  { key: "rquispe", email: "rquispe@grupocruz.pe", full_name: "Ricardo Quispe Mamani", position: "Ingeniero Residente", phone: "965 778 120", dni: "43215698", avatar_color: "#F21D2F",
    memberships: [{ company: "01", role: "residente", projects: ["010-HCVC", "011-RLAL", "012-IEPC"] }] },
  { key: "contabilidad", email: "contabilidad@grupocruz.pe", full_name: "Rosa Huamán Torres", position: "Contadora · Lima", phone: "944 102 336", dni: "10458963", avatar_color: "#7C3AED",
    memberships: [{ company: "01", role: "contabilidad" }, { company: "02", role: "contabilidad" }] },
  { key: "almacen", email: "almacen@grupocruz.pe", full_name: "Pedro Ccori Salas", position: "Almacenero de obra", phone: "932 554 781", dni: "46987412", avatar_color: "#035928",
    memberships: [{ company: "01", role: "almacen", projects: ["010-HCVC", "011-RLAL"] }] },
  { key: "mparedes", email: "mparedes@grupocruz.pe", full_name: "Miguel Paredes Villanueva", position: "Administrador de obra", phone: "951 336 902", dni: "42369857", avatar_color: "#0EA5E9",
    memberships: [{ company: "02", role: "administrador" }] },
  { key: "lfernandez", email: "lfernandez@grupocruz.pe", full_name: "Lucía Fernández Chávez", position: "Ingeniera Residente", phone: "987 220 514", dni: "47125896", avatar_color: "#D97706",
    memberships: [{ company: "02", role: "residente", projects: ["020-MTTN", "022-CM120"] }] },
];

// Proveedores por rubro (se crean en las empresas 01 y 02)
export const SUPPLIERS = [
  // alquileres
  { key: "alsina", ruc: "20100178762", name: "ENCOFRADOS ALSINA PERÚ S.A.C.", kind: "proveedor", pool: "alquileres", bank: "BCP" },
  { key: "nopin", ruc: "20510263841", name: "ANDAMIOS NOPIN S.A.C.", kind: "proveedor", pool: "alquileres", bank: "BBVA" },
  { key: "unimaq", ruc: "20100035121", name: "UNIMAQ S.A.", kind: "proveedor", pool: "maquinaria", bank: "BCP" },
  { key: "andinos", ruc: "20604512378", name: "EQUIPOS Y MONTAJES ANDINOS E.I.R.L.", kind: "proveedor", pool: "maquinaria", bank: "Interbank" },
  { key: "topo", ruc: "20553214698", name: "TOPOGRAFÍA & EQUIPOS GPS S.A.C.", kind: "proveedor", pool: "equipos", bank: "BCP" },
  { key: "rentpc", ruc: "20601478523", name: "RENT A PC PERÚ S.A.C.", kind: "proveedor", pool: "equipos", bank: "Scotiabank" },
  { key: "equiposmenores", ruc: "20609874125", name: "ALQUIMAQ EQUIPOS MENORES S.A.C.", kind: "proveedor", pool: "equipos", bank: "BBVA" },
  // materiales
  { key: "unicon", ruc: "20297543653", name: "UNICON — UNIÓN DE CONCRETERAS S.A.", kind: "proveedor", pool: "concreto", bank: "BCP" },
  { key: "ferreandina", ruc: "20602547891", name: "COMERCIAL FERRETERA ANDINA S.A.C.", kind: "proveedor", pool: "acero", bank: "BCP" },
  { key: "sanra", ruc: "20548712369", name: "DISTRIBUIDORA SANRA S.A.C.", kind: "proveedor", pool: "madera", bank: "Interbank" },
  { key: "maderera", ruc: "20603321457", name: "MADERERA SAN MARTÍN E.I.R.L.", kind: "proveedor", pool: "madera", bank: "BCP" },
  { key: "constructor", ruc: "20605874123", name: "FERRETERÍA EL CONSTRUCTOR E.I.R.L.", kind: "proveedor", pool: "ferreteria", bank: "BCP" },
  { key: "aditivos", ruc: "20517242161", name: "ADITIVOS ESPECIALES S.A.C.", kind: "proveedor", pool: "ferreteria", bank: "BBVA" },
  { key: "quimica", ruc: "20100097746", name: "QUÍMICA SUIZA INDUSTRIAL DEL PERÚ S.A.", kind: "proveedor", pool: "ferreteria", bank: "BCP" },
  { key: "ceramicos", ruc: "20508963214", name: "CERÁMICOS Y ACABADOS LIMA S.A.C.", kind: "proveedor", pool: "acabados", bank: "BCP" },
  { key: "vidrieria", ruc: "20604789632", name: "VIDRIERÍA Y ALUMINIOS MIRAFLORES S.A.C.", kind: "proveedor", pool: "acabados", bank: "Interbank" },
  { key: "pinturas", ruc: "20100120318", name: "PINTURAS CPP DISTRIBUCIONES S.A.C.", kind: "proveedor", pool: "acabados", bank: "BBVA" },
  { key: "agregados", ruc: "20601236985", name: "AGREGADOS Y CANTERAS DEL SUR S.A.C.", kind: "proveedor", pool: "agregados", bank: "BCP" },
  { key: "prefab", ruc: "20607412589", name: "MÓDULOS PREFABRICADOS TECNOFAST PERÚ S.A.C.", kind: "proveedor", pool: "prefabricados", bank: "BBVA" },
  // transporte
  { key: "aliaga", ruc: "20614385619", name: "TRANSPORTE ALIAGA JH E.I.R.L.", kind: "proveedor", pool: "transporte", bank: "BCP" },
  { key: "kaori", ruc: "10311895465", name: "TRANSPORTE KAORI — QUISPE ROJAS KAORI", kind: "proveedor", pool: "transporte_rh", bank: "BCP" },
  { key: "denis", ruc: "20527186511", name: "EMPRESA DE TRANSPORTE DENIS S.A.C.", kind: "proveedor", pool: "transporte", bank: "Interbank" },
  { key: "ransa", ruc: "20100039207", name: "RANSA COMERCIAL S.A.", kind: "proveedor", pool: "transporte", bank: "BCP" },
  // seguridad
  { key: "protecta", ruc: "20517207331", name: "PROTECTA Y SEGURIDAD S.A.", kind: "proveedor", pool: "sctr", bank: "BCP" },
  { key: "celestial", ruc: "20534426179", name: "CLÍNICA CELESTIAL S.A.C.", kind: "proveedor", pool: "emo", bank: "BBVA" },
  { key: "acr", ruc: "20606410841", name: "MULTISERVICIOS ACR S.A.C.", kind: "proveedor", pool: "epp", bank: "BCP" },
  { key: "segurindustria", ruc: "20100167351", name: "SEGURINDUSTRIA S.A.", kind: "proveedor", pool: "epp", bank: "Interbank" },
  { key: "rimac", ruc: "20100041953", name: "RÍMAC SEGUROS Y REASEGUROS", kind: "proveedor", pool: "sctr", bank: "BCP" },
  // servicios y campo
  { key: "claro", ruc: "20467534026", name: "AMÉRICA MÓVIL PERÚ S.A.C. (CLARO)", kind: "proveedor", pool: "servicios", bank: "BCP" },
  { key: "electro", ruc: "20116544289", name: "ELECTRO SUR ESTE S.A.A.", kind: "entidad", pool: "servicios", bank: "BCP" },
  { key: "hostal", ruc: "10425896314", name: "HOSTAL LOS ANDES — HUAMANI CCOPA ELENA", kind: "proveedor", pool: "campo", bank: "BCP" },
  { key: "pension", ruc: "10458712369", name: "PENSIÓN DOÑA ROSA — CUSI MAMANI ROSA", kind: "proveedor", pool: "campo", bank: "BCP" },
  { key: "chankas", ruc: "20490125874", name: "EXPRESO LOS CHANKAS S.R.L.", kind: "proveedor", pool: "campo", bank: "BCP" },
  { key: "grifo", ruc: "20564789123", name: "GRIFO SAN CRISTÓBAL E.I.R.L.", kind: "proveedor", pool: "combustible", bank: "BCP" },
  // subcontratistas (Hoja1 de la plantilla)
  { key: "navinco", ruc: "20600478521", name: "NAVINCO S.A.C.", kind: "subcontratista", pool: "subcontratos", bank: "BCP" },
  { key: "chilete", ruc: "20601589634", name: "CHILETE CONTRATISTAS E.I.R.L.", kind: "subcontratista", pool: "subcontratos", bank: "Interbank" },
  { key: "romani", ruc: "20602698745", name: "ROMANI INGENIEROS S.A.C.", kind: "subcontratista", pool: "subcontratos", bank: "BBVA" },
  { key: "topografo", ruc: "10441236587", name: "ING. MARCO ANTONIO SALAZAR (TOPÓGRAFO)", kind: "proveedor", pool: "honorarios", bank: "BCP" },
  // internos
  { key: "pl_obreros", ruc: "PLANILLA-OBR", name: "PLANILLA DE OBREROS", kind: "trabajador", pool: "planilla", bank: "BCP" },
  { key: "pl_staff", ruc: "PLANILLA-STF", name: "PLANILLA STAFF", kind: "trabajador", pool: "planilla", bank: "BCP" },
];

export const MATERIALS = [
  { code: "ALA-008", name: "Alambre negro recocido N° 8", unit: "kg", category: "acero", min_stock: 150, cost: 5.2 },
  { code: "ALA-016", name: "Alambre negro recocido N° 16", unit: "kg", category: "acero", min_stock: 120, cost: 5.6 },
  { code: "CLA-025", name: "Clavo para madera 2 1/2\"", unit: "kg", category: "consumibles", min_stock: 40, cost: 5.4 },
  { code: "CLA-030", name: "Clavo para madera 3\"", unit: "kg", category: "consumibles", min_stock: 60, cost: 5.3 },
  { code: "CLA-040", name: "Clavo para madera 4\"", unit: "kg", category: "consumibles", min_stock: 50, cost: 5.3 },
  { code: "MAD-T01", name: "Tabla de madera tornillo 1\" x 8\" x 10'", unit: "tabla", category: "madera", min_stock: 30, cost: 32 },
  { code: "MAD-P23", name: "Pie derecho madera eucalipto 2\" x 3\" x 10'", unit: "pza", category: "madera", min_stock: 40, cost: 14.5 },
  { code: "FEN-018", name: "Tablero fenólico 18 mm 1.22 x 2.44 m", unit: "pza", category: "madera", min_stock: 10, cost: 168 },
  { code: "CEM-T1", name: "Cemento Portland Tipo I (42.5 kg)", unit: "bolsa", category: "materiales", min_stock: 100, cost: 29.5 },
  { code: "ACE-012", name: "Acero corrugado 1/2\" x 9 m", unit: "varilla", category: "acero", min_stock: 80, cost: 41.8 },
  { code: "ACE-038", name: "Acero corrugado 3/8\" x 9 m", unit: "varilla", category: "acero", min_stock: 80, cost: 23.4 },
  { code: "ARE-GRU", name: "Arena gruesa", unit: "m3", category: "agregados", min_stock: 8, cost: 65 },
  { code: "PIE-CHA", name: "Piedra chancada 1/2\"", unit: "m3", category: "agregados", min_stock: 8, cost: 78 },
  { code: "AGU-CAJ", name: "Agua de mesa caja 6 x 2.5 L", unit: "caja", category: "consumibles", min_stock: 20, cost: 21 },
  { code: "DIS-C07", name: "Disco de corte metal 7\"", unit: "und", category: "consumibles", min_stock: 20, cost: 9.8 },
  { code: "DIS-D04", name: "Disco de desbaste 4 1/2\"", unit: "und", category: "consumibles", min_stock: 20, cost: 7.5 },
  { code: "DES-GLN", name: "Desmoldante para encofrado", unit: "gl", category: "consumibles", min_stock: 6, cost: 46 },
  { code: "ADI-GLN", name: "Aditivo acelerante de fragua", unit: "gl", category: "consumibles", min_stock: 4, cost: 58 },
  { code: "CIN-SEN", name: "Cinta de señalización amarilla 500 m", unit: "rollo", category: "epp", min_stock: 5, cost: 38 },
  { code: "EPP-CAS", name: "Casco de seguridad con barbiquejo", unit: "und", category: "epp", min_stock: 15, cost: 28 },
  { code: "EPP-GUA", name: "Guantes de cuero reforzado", unit: "par", category: "epp", min_stock: 40, cost: 12.5 },
  { code: "EPP-LEN", name: "Lentes de seguridad claros", unit: "und", category: "epp", min_stock: 30, cost: 7.9 },
  { code: "EPP-BOT", name: "Botas de seguridad punta de acero", unit: "par", category: "epp", min_stock: 10, cost: 96 },
  { code: "EPP-ARN", name: "Arnés de cuerpo entero con línea de vida", unit: "und", category: "epp", min_stock: 6, cost: 285 },
  { code: "EPP-CHA", name: "Chaleco reflectivo", unit: "und", category: "epp", min_stock: 20, cost: 15 },
  { code: "HER-PAL", name: "Pala tipo cuchara", unit: "und", category: "herramientas", min_stock: 6, cost: 42 },
  { code: "HER-CAR", name: "Carretilla buggy 5.5 p3", unit: "und", category: "herramientas", min_stock: 2, cost: 265 },
  { code: "TUB-PVC", name: "Tubo PVC SAP 4\" x 5 m", unit: "und", category: "materiales", min_stock: 10, cost: 48 },
  { code: "GEO-TEX", name: "Geotextil no tejido 200 g/m²", unit: "m2", category: "materiales", min_stock: 100, cost: 4.2 },
  { code: "YES-BOL", name: "Yeso bolsa 18 kg", unit: "bolsa", category: "materiales", min_stock: 20, cost: 14.8 },
];

export const EQUIPMENT = [
  { code: "EQ-001", name: "Vibradora de concreto 4 HP", equipment_type: "vibradora", brand: "Honda", model: "GX160", ownership: "alquilado", rate_amount: 45, rate_period: "dia" },
  { code: "EQ-002", name: "Vibradora de concreto 5.5 HP", equipment_type: "vibradora", brand: "Wacker Neuson", model: "M2000", ownership: "alquilado", rate_amount: 55, rate_period: "dia" },
  { code: "EQ-003", name: "Amoladora angular 7\"", equipment_type: "amoladora", brand: "Bosch", model: "GWS 22-180", ownership: "propio" },
  { code: "EQ-004", name: "Amoladora angular 4 1/2\"", equipment_type: "amoladora", brand: "DeWalt", model: "DWE4120", ownership: "propio" },
  { code: "EQ-005", name: "Taladro percutor 1/2\"", equipment_type: "taladro", brand: "Bosch", model: "GSB 16 RE", ownership: "propio" },
  { code: "EQ-006", name: "Rotomartillo SDS Plus", equipment_type: "taladro", brand: "Hilti", model: "TE 30-A36", ownership: "alquilado", rate_amount: 380, rate_period: "semana" },
  { code: "EQ-007", name: "Estación total", equipment_type: "estacion_total", brand: "Leica", model: "TS07 R500", ownership: "alquilado", rate_amount: 3800, rate_period: "mes" },
  { code: "EQ-008", name: "Nivel automático topográfico", equipment_type: "nivel", brand: "Topcon", model: "AT-B4A", ownership: "propio" },
  { code: "EQ-009", name: "Mezcladora de concreto 9 p3", equipment_type: "mezcladora", brand: "Kipor", model: "MZ-9", ownership: "propio" },
  { code: "EQ-010", name: "Compactadora tipo plancha", equipment_type: "compactadora", brand: "Wacker Neuson", model: "WP1550", ownership: "alquilado", rate_amount: 85, rate_period: "dia" },
  { code: "EQ-011", name: "Laptop oficina técnica", equipment_type: "laptop", brand: "Lenovo", model: "ThinkPad E14", ownership: "alquilado", rate_amount: 380, rate_period: "mes" },
  { code: "EQ-012", name: "Laptop administración de obra", equipment_type: "laptop", brand: "HP", model: "ProBook 450", ownership: "alquilado", rate_amount: 360, rate_period: "mes" },
  { code: "EQ-013", name: "Cortadora de concreto", equipment_type: "cortadora", brand: "Husqvarna", model: "FS 400", ownership: "propio" },
  { code: "EQ-014", name: "Grupo electrógeno 6.5 kW", equipment_type: "generador", brand: "Honda", model: "EG6500", ownership: "propio" },
];

export const WORKERS = [
  "Fredy Huamán Quispe", "Wilber Ccahuana Rojas", "Edwin Mamani Condori", "Julio César Pari", "Hernán Soto Villa",
  "Rubén Apaza Flores", "Elmer Chávez Rimachi", "Saúl Ticona Luque", "Yonel Cárdenas Paz", "Teófilo Ayala Huanca",
];
