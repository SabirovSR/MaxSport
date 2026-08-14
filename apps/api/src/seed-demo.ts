import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createPool } from "@maxsport/shared";

const seedsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../deploy/seeds"
);

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const pool = createPool(databaseUrl);
  const sql = readFileSync(join(seedsDir, "demo_pitch.sql"), "utf8");
  await pool.query(sql);
  console.log("Demo pitch seed applied (no-op if no users yet).");
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
