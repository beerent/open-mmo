import { readFileSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { pool } from "./pool.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const { rows: applied } = await client.query(
      "SELECT version FROM schema_migrations ORDER BY version"
    );
    const appliedSet = new Set(applied.map((r) => r.version));

    const migrationsDir = resolve(__dirname, "migrations");
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (appliedSet.has(file)) continue;

      const sql = readFileSync(resolve(migrationsDir, file), "utf-8");
      console.log(`[DB] Applying migration: ${file}`);

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (version) VALUES ($1)",
          [file]
        );
        await client.query("COMMIT");
        console.log(`[DB] Applied: ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }

    console.log("[DB] Migrations complete");
  } finally {
    client.release();
  }
}

// Run directly via `pnpm --filter @shireland/database migrate`
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith("migrate.ts") ||
    process.argv[1].endsWith("migrate.js"));

if (isDirectRun) {
  runMigrations()
    .then(() => pool.end())
    .catch((err) => {
      console.error("[DB] Migration failed:", err);
      pool.end();
      process.exit(1);
    });
}
