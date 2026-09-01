// Runs every unit test in tests/unit.
//
// `tsx --test tests/unit/` looks correct but silently skips TypeScript: Node's
// default test-file patterns only match .js/.cjs/.mjs, so .test.ts files were
// collected by nobody and reported as passing runs that had never executed
// them. Node 20 also does not expand glob arguments, so the file list has to be
// built here and passed explicitly.

import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const dir = path.join(process.cwd(), "tests", "unit");
const files = readdirSync(dir)
  .filter((f) => /\.test\.(ts|mts|mjs|cjs|js)$/.test(f))
  .map((f) => path.join("tests", "unit", f))
  .sort();

if (files.length === 0) {
  console.error("No unit tests found in tests/unit — check the file naming (*.test.ts).");
  process.exit(1);
}

console.log(`Running ${files.length} unit test file(s):`);
for (const f of files) console.log(`  ${f}`);
console.log("");

const res = spawnSync("npx", ["tsx", "--test", ...files], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(res.status ?? 1);
