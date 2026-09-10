import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getEnvironment } from "@/config/env";
import * as schema from "./schema";

export function createDatabase(connectionString: string) {
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  return { db, pool };
}

export type Database = ReturnType<typeof createDatabase>["db"];

const globalForDatabase = globalThis as unknown as {
  database?: ReturnType<typeof createDatabase>;
};

export function getDatabase() {
  if (!globalForDatabase.database) {
    globalForDatabase.database = createDatabase(getEnvironment().DATABASE_URL);
  }

  return globalForDatabase.database;
}
