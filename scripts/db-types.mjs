// Regenera src/lib/database.types.ts desde la base (usa SUPABASE_ACCESS_TOKEN de .env.local).
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { config } from "dotenv";
config({ path: ".env.local", override: true, quiet: true });
const out = execSync(`npx --yes supabase gen types typescript --project-id ${process.env.SUPABASE_PROJECT_REF} --schema public`, { env: process.env, maxBuffer: 1 << 26 });
writeFileSync("src/lib/database.types.ts", out);
console.log("✓ tipos actualizados");
