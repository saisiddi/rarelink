import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.join(root, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // Every DB-touching test shares one SQLite file — never run them at once.
    fileParallelism: false,
    setupFiles: [path.join(root, "scripts", "test-setup.ts")],
    env: {
      DATABASE_PATH: path.join(root, "data", "test.db"),
      SEED_ON_EMPTY: "true",
      AI_DISABLED: "true",
    },
  },
});
