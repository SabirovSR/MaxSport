import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool } from "@maxsport/shared";

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../deploy/migrations"
);

export async function runMigrations(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const applied = await pool.query(
      `SELECT 1 FROM schema_migrations WHERE filename = $1`,
      [file]
    );
    if (applied.rows[0]) continue;

    const sql = readFileSync(join(migrationsDir, file), "utf8");
    // DDL in PostgreSQL auto-commits; do not wrap schema files in BEGIN/COMMIT.
    await pool.query(sql);
    await pool.query(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [
      file,
    ]);
    console.log(`Applied migration ${file}`);
  }
}
