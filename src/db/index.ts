import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL environment variable is not set");
  const sql = neon(url);
  return drizzle({ client: sql, schema });
}

type Db = ReturnType<typeof createDb>;

let _db: Db | undefined;

// Lazy proxy so importing this module doesn't require DATABASE_URL at build time
export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    _db ??= createDb();
    const value = Reflect.get(_db as object, prop);
    return typeof value === "function" ? value.bind(_db) : value;
  },
});

export async function getDb() {
  return db;
}
