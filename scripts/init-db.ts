/**
 * Create the SQLite database and apply migrations/schema.sqlite.sql.
 * Usage: npm run db:init
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

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
db.close();

console.log(`✔ schema applied → ${dbPath}`);
