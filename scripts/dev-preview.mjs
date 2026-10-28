// Start the dev server in PREVIEW mode: the signed-in pages render against
// fixtures instead of Supabase, which is answering 402 on everything.
//
//   node scripts/dev-preview.mjs                 # Inner Circle role: TECH
//   node scripts/dev-preview.mjs --outreach      # ... OUTREACH, to see the CRM
//   node scripts/dev-preview.mjs --port 3100
//   node scripts/dev-preview.mjs --lan           # also reachable from your phone
//
// A launcher rather than inline env vars in package.json because `FOO=1 next dev`
// is not valid on Windows cmd/PowerShell, and the alternative is adding cross-env
// as a dependency to set two variables.
//
// What makes this safe is in lib/devPreview.ts: the flag is ANDed with
// `process.env.NODE_ENV !== "production"`, a compile-time constant, so a
// production build folds the whole thing away and no env var can switch it on.
import { spawn } from "node:child_process";

const argv = process.argv.slice(2);
const has = (f) => argv.includes(`--${f}`);
const val = (f, d) => {
  const i = argv.indexOf(`--${f}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : d;
};

const port = val("port", "3000");
const role = has("outreach") ? "OUTREACH" : "TECH";

const args = ["next", "dev", "--webpack", "--port", port];
// Binding to 0.0.0.0 is what lets you open it on a phone on the same Wi-Fi,
// which is the only way to judge the touch work for real.
if (has("lan")) args.push("--hostname", "0.0.0.0");

console.log(`\n  dev preview — fixtures, no backend`);
console.log(`  Inner Circle role: ${role}${has("outreach") ? "" : "   (--outreach for the CRM)"}`);
console.log(`  http://localhost:${port}/dashboard\n`);

// shell:true is required on Windows: since Node 20, spawning a .cmd shim
// without it fails with EINVAL, which silently left no server running at all.
const child = spawn("npx", args, {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    MAINTENANCE_MODE: "off",
    NEXT_PUBLIC_DEV_PREVIEW: "1",
    NEXT_PUBLIC_DEV_PREVIEW_ROLE: role,
  },
});

child.on("exit", (code) => process.exit(code ?? 0));
