/**
 * Drop and recreate the local database with fresh demo data.
 * Usage: npm run db:reset
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { seedDatabase } from "../src/lib/db/seed.ts";

const dbPath = path.resolve(
  process.cwd(),
  process.env.DATABASE_PATH || "./data/rarelink.db",
);

for (const suffix of ["", "-wal", "-shm", "-journal"]) {
  const p = `${dbPath}${suffix}`;
  if (fs.existsSync(p)) fs.rmSync(p);
}
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const schema = fs.readFileSync(
  path.join(process.cwd(), "migrations", "schema.sqlite.sql"),
  "utf8",
);

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
db.exec(schema);
seedDatabase(db);
db.close();

console.log(`✔ database reset + reseeded → ${dbPath}`);
