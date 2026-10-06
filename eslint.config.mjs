import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * Flat ESLint config (Next.js 16 dropped `next lint`, so this runs directly).
 *
 * `core-web-vitals` already brings the Next.js rules (no `next/image` before
 * `next/font`, correct `<img>` vs `next/image`, script placement) plus
 * react/react-hooks/jsx-a11y/import; `typescript` adds the typed rules.
 */
const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "node_modules/**",
      "next-env.d.ts",
      "data/**",
      "coverage/**",
      "package-lock.json",
    ],
  },
  {
    rules: {
      // Application code may only log failures: free-form logging is how PII
      // ends up in request logs. src/lib/analytics.ts is the sanctioned sink.
      "no-console": ["error", { allow: ["error", "warn"] }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-non-null-asserted-optional-chain": "error",
    },
  },
  {
    // `scripts/` are operator CLIs — printing to stdout is their interface.
    files: ["scripts/**/*.ts", "next.config.ts"],
    rules: {
      "no-console": "off",
    },
  },
];

export default config;
