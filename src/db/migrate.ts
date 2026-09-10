import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDatabase } from "./client";
import { getEnvironment } from "@/config/env";

export async function runMigrations(
  connectionString = getEnvironment().DATABASE_URL,
) {
  const { db, pool } = createDatabase(connectionString);

  try {
    await migrate(db, { migrationsFolder: "drizzle" });
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations().catch((error: unknown) => {
    console.error("Database migration failed", error);
    process.exitCode = 1;
  });
}
