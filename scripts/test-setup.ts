/**
 * Runs before any test module is imported.
 *
 * `process.env` must be configured *before* `@/lib/db` is evaluated, because
 * the SQLite handle resolves its file path at first `getDb()`. Static imports
 * in a test file are hoisted above that file's top-level statements, so this
 * lives in a setup file instead of in the tests themselves.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

process.env.DATABASE_PATH ??= path.join(root, "data", "test.db");
process.env.SEED_ON_EMPTY ??= "true";
process.env.AI_DISABLED ??= "true";
