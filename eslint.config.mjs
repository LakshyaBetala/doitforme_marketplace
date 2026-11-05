import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated build output. Without these, `npm run lint` linted the
    // bundled Worker and reported ~37,000 problems, which buried every real
    // one and made the command useless as a check.
    ".open-next/**",
    ".wrangler/**",
    ".wrangler-dryrun/**",
    ".playwright-mcp/**",
    // The Expo app lints and type-checks on its own (see mobile/README.md).
    "mobile/**",
    // Claude Code git worktrees: full, stale checkouts of this repo. Linting
    // them reports the same files twice, and old versions of them.
    ".claude/**",
  ]),
]);

export default eslintConfig;
