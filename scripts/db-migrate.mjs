// Aplica las migraciones SQL de supabase/migrations en orden usando la Management API de Supabase.
// Uso: node scripts/db-migrate.mjs            (aplica las pendientes)
//      node scripts/db-migrate.mjs --sql "..." (ejecuta una consulta suelta)
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";

config({ path: ".env.local", override: true, quiet: true });

const REF = process.env.SUPABASE_PROJECT_REF;
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!REF || !TOKEN) throw new Error("Faltan SUPABASE_PROJECT_REF o SUPABASE_ACCESS_TOKEN en .env.local");

export async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  const idx = process.argv.indexOf("--sql");
  if (idx > -1) {
    console.log(JSON.stringify(await sql(process.argv[idx + 1]), null, 2));
    return;
  }
  await sql(`create table if not exists public.app_migrations (name text primary key, applied_at timestamptz default now());
             alter table public.app_migrations enable row level security;`);
  const done = new Set((await sql("select name from public.app_migrations")).map((r) => r.name));
  const dir = "supabase/migrations";
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    if (done.has(f)) {
      console.log(`· ${f} (ya aplicada)`);
      continue;
    }
    const body = readFileSync(join(dir, f), "utf8");
    await sql(`begin;\n${body}\ninsert into public.app_migrations(name) values ('${f}');\ncommit;`);
    console.log(`✓ ${f}`);
  }
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1].endsWith("db-migrate.mjs")) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
