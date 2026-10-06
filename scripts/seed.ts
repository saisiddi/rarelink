/**
 * Seed the demo dataset.
 * Usage: npm run db:seed
 * Safe to run repeatedly — every insert is idempotent.
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { ensureSeed } from "../src/lib/db/seed.ts";

const dbPath = path.resolve(
  process.cwd(),
  process.env.DATABASE_PATH || "./data/rarelink.db",
);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const schema = fs.readFileSync(
  path.join(process.cwd(), "migrations", "schema.sqlite.sql"),
  "utf8",
);

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
db.exec(schema);
ensureSeed(db);

const counts = {
  bloodBanks: (db.prepare("SELECT COUNT(*) AS n FROM blood_banks").get() as { n: number }).n,
  inventory: (db.prepare("SELECT COUNT(*) AS n FROM blood_inventory").get() as { n: number }).n,
  donors: (db.prepare("SELECT COUNT(*) AS n FROM donors").get() as { n: number }).n,
  rareDonors: (
    db.prepare("SELECT COUNT(*) AS n FROM donors WHERE rare_phenotype IS NOT NULL").get() as {
      n: number;
    }
  ).n,
  requests: (db.prepare("SELECT COUNT(*) AS n FROM emergency_requests").get() as { n: number }).n,
};
db.close();

console.log(`✔ seeded → ${dbPath}`);
console.table(counts);
