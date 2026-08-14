import { createPool } from "@maxsport/shared";
import { runMigrations } from "./migrate-runner.js";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const pool = createPool(databaseUrl);
  await runMigrations(pool);
  console.log("Migrations complete.");
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
