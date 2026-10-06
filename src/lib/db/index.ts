/**
 * SQLite access layer (node:sqlite — zero native dependencies).
 *
 * Everything here is intentionally thin: queries live with the features that
 * need them, and every table/column mirrors `migrations/postgres.sql` so the
 * storage engine can be swapped without touching the domain layer.
 */

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

import { ensureSeed } from "@/lib/db/seed";

const ROOT = process.cwd();
const SCHEMA_FILE = path.join(ROOT, "migrations", "schema.sqlite.sql");
const DEFAULT_DB_PATH = path.join(ROOT, "data", "rarelink.db");

let instance: DatabaseSync | null = null;

function resolveDbPath(): string {
  const raw = process.env.DATABASE_PATH?.trim();
  if (!raw) return DEFAULT_DB_PATH;
  if (path.isAbsolute(raw)) return raw;
  // Operator-supplied relative path: deliberately outside the traced folders.
  return path.join(/* turbopackIgnore: true */ ROOT, raw);
}

function applySchema(db: DatabaseSync): void {
  const sql = fs.readFileSync(SCHEMA_FILE, "utf8");
  db.exec(sql);
}

export function getDb(): DatabaseSync {
  if (instance) return instance;

  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  applySchema(db);

  // First run should just work: `npm run dev` seeds a demo dataset if empty.
  if (process.env.SEED_ON_EMPTY !== "false") {
    ensureSeed(db);
  }

  instance = db;
  return db;
}

/** Test/reset hook — closes the handle so the file can be swapped. */
export function closeDb(): void {
  if (instance) {
    try {
      instance.close();
    } catch {
      /* already closed */
    }
    instance = null;
  }
}

export function isDemoDataset(): boolean {
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM data_sources WHERE is_live = 1")
    .get() as { n?: number | bigint } | undefined;
  const live = Number(row?.n ?? 0);
  if (live > 0) return false;
  const configured =
    (process.env.ERAKTKOSH_BASE_URL?.trim() || process.env.IRCS_BASE_URL?.trim()) !== "";
  return !configured;
}

// --- tiny helpers used across the app --------------------------------------

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : Math.random().toString(36).slice(2, 18).padEnd(16, "0");
  return `${prefix}_${rand}`;
}

export function bool(v: unknown): boolean {
  return v === 1 || v === true || v === "1";
}

export function jsonOrNull<T>(v: unknown, fallback: T): T {
  if (typeof v !== "string" || !v) return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}
