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
  for (const migrationName of migrations) {
    const migration = await readFile(path.join(migrationDirectory, migrationName), "utf8");
    await pool.query(migration);
    console.log(`Applied ${migrationName}.`);
  }
} catch (error) {
  const code =
    error && typeof error === "object" && "code" in error ? String(error.code) : "unexpected";
  console.error(`The TGFVP location migration failed (error code: ${code}).`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
