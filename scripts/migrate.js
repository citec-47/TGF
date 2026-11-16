import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required in .env before running database migrations.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

try {
  const migrationDirectory = path.join(root, "db", "migrations");
  const migrations = (await readdir(migrationDirectory))
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  if (!migrations.length) throw new Error("No database migration files were found.");
  await pool.query(
    `CREATE TABLE IF NOT EXISTS tgf_schema_migrations (
       migration_name TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
  );
  for (const migrationName of migrations) {
    const migration = await readFile(path.join(migrationDirectory, migrationName), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(917321, 2)");
      const applied = await client.query(
        "SELECT 1 FROM tgf_schema_migrations WHERE migration_name = $1",
        [migrationName],
      );
      if (applied.rowCount) {
        await client.query("COMMIT");
        console.log(`Already applied ${migrationName}.`);
        continue;
      }
      await client.query(migration);
      await client.query(
        "INSERT INTO tgf_schema_migrations (migration_name) VALUES ($1)",
        [migrationName],
      );
      await client.query("COMMIT");
      console.log(`Applied ${migrationName}.`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
} catch (error) {
  const code =
    error && typeof error === "object" && "code" in error ? String(error.code) : "unexpected";
  console.error(`TGFVP database migrations failed (error code: ${code}).`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
