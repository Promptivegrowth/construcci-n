// Adjunta una imagen escaneada a los documentos de obra sembrados (contrato, OS del cliente, fianzas, pólizas).
// Uso: node scripts/seed-documents.mjs   (idempotente: solo procesa documentos sin archivo)
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import sharp from "sharp";

config({ path: ".env.local", override: true, quiet: true });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const money = (n) => `S/ ${Number(n ?? 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fdate = (d) => (d ? d.split("-").reverse().join("/") : "—");
const HEAD = { contrato: "CONTRATO DE EJECUCIÓN DE OBRA", orden_servicio_cliente: "ORDEN DE SERVICIO", carta_fianza: "CARTA FIANZA", poliza: "PÓLIZA DE SEGURO CAR", otro: "DOCUMENTO" };
const ISSUER = { carta_fianza: "BANCO DE CRÉDITO DEL PERÚ", poliza: "RÍMAC SEGUROS Y REASEGUROS" };

function svg(doc, project, company) {
  const lines = [
    `Obra: ${project.code} — ${project.name}`.slice(0, 88),
    `Cliente: ${project.client_name ?? ""}${project.client_ruc ? ` · RUC ${project.client_ruc}` : ""}`,
    `Contratista: ${company.legal_name} · RUC ${company.ruc}`,
    `Ubicación: ${[project.address, project.region].filter(Boolean).join(", ")}`,
    `Monto: ${money(doc.amount)}`,
    `Fecha de emisión: ${fdate(doc.issue_date)}${doc.expiry_date ? `   ·   Vigencia hasta: ${fdate(doc.expiry_date)}` : ""}`,
  ];
  const para = doc.doc_kind === "carta_fianza"
    ? ["Por la presente, garantizamos de manera solidaria, irrevocable, incondicional y de realización", "automática, sin beneficio de excusión, a favor del beneficiario, hasta por el monto indicado,", "para asegurar el fiel cumplimiento de las obligaciones del contratista."]
    : doc.doc_kind === "poliza"
      ? ["Cobertura todo riesgo construcción y montaje (CAR) que ampara daños materiales a la obra,", "equipos y responsabilidad civil frente a terceros durante el plazo de ejecución."]
      : ["Conste por el presente documento el acuerdo para la ejecución de la obra descrita, conforme", "al expediente técnico, presupuesto aprobado, cronograma y condiciones pactadas entre las partes."];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200">
  <rect width="900" height="1200" fill="#d9d4cb"/>
  <g transform="rotate(${(Math.random() * 2 - 1).toFixed(2)} 450 600)" font-family="Georgia, 'Times New Roman', serif" fill="#1f2328">
    <rect x="70" y="50" width="760" height="1100" fill="#fbfaf6"/>
    <rect x="70" y="50" width="760" height="10" fill="#062a4d"/>
    <text x="450" y="130" font-size="15" text-anchor="middle" fill="#555" letter-spacing="3">${esc(ISSUER[doc.doc_kind] ?? company.legal_name)}</text>
    <text x="450" y="185" font-size="30" font-weight="700" text-anchor="middle">${esc(HEAD[doc.doc_kind] ?? "DOCUMENTO")}</text>
    <text x="450" y="222" font-size="20" text-anchor="middle" fill="#035aa6">N° ${esc(doc.number ?? "S/N")}</text>
    <line x1="140" y1="250" x2="760" y2="250" stroke="#999"/>
    ${lines.map((l, i) => `<text x="130" y="${305 + i * 40}" font-size="18">${esc(l)}</text>`).join("")}
    ${para.map((l, i) => `<text x="130" y="${580 + i * 32}" font-size="17" fill="#333">${esc(l)}</text>`).join("")}
    ${Array.from({ length: 9 }).map((_, i) => `<rect x="130" y="${700 + i * 26}" width="${560 - (i % 3) * 80}" height="8" rx="3" fill="#e2ded6"/>`).join("")}
    <path d="M170 1010 C 210 960, 250 1060, 300 990 S 380 960, 410 1005" fill="none" stroke="#0b2545" stroke-width="2.5"/>
    <line x1="150" y1="1030" x2="400" y2="1030" stroke="#333"/>
    <text x="275" y="1055" font-size="14" text-anchor="middle">Firma autorizada</text>
    <circle cx="640" cy="1000" r="62" fill="none" stroke="#c8102e" stroke-width="3" opacity="0.7"/>
    <text x="640" y="995" font-size="13" text-anchor="middle" fill="#c8102e" opacity="0.8">RECIBIDO</text>
    <text x="640" y="1015" font-size="12" text-anchor="middle" fill="#c8102e" opacity="0.8">${esc(fdate(doc.issue_date))}</text>
  </g></svg>`;
}

const { data: docs, error } = await sb.from("project_documents").select("*, project:projects(*, company:companies(*))").is("file_path", null);
if (error) throw error;
let n = 0;
for (const d of docs ?? []) {
  const p = d.project;
  const buf = await sharp(Buffer.from(svg(d, p, p.company))).resize(720).jpeg({ quality: 70, mozjpeg: true }).toBuffer();
  const path = `${p.company_id}/${p.id}/documentos/${d.id}.jpg`;
  const up = await sb.storage.from("evidencias").upload(path, buf, { contentType: "image/jpeg", upsert: true });
  if (up.error) throw up.error;
  const { error: ue } = await sb.from("project_documents").update({ file_path: path }).eq("id", d.id);
  if (ue) throw ue;
  n++;
}
// Los UPDATE anteriores son carga de datos, no acciones de usuarios: se excluyen de la trazabilidad.
const ids = (docs ?? []).map((d) => d.id);
if (ids.length) await sb.from("audit_log").delete().eq("table_name", "project_documents").eq("action", "UPDATE").in("record_id", ids);
console.log(`✓ ${n} documentos con archivo adjunto`);
