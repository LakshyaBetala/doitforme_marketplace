// Render + optionally send the six Round 1 email templates.
//
//   node scripts/preview-round1-emails.mjs              # just write HTML files to scratchpad/
//   node scripts/preview-round1-emails.mjs --send=you@example.com   # also send the invite live
//
// Writing to scratchpad/ costs nothing and lets you look at every template
// side-by-side in a browser. Sending is only live when a provider key
// (ZEPTOMAIL_TOKEN / BREVO_API_KEY / RESEND_API_KEY) is present in the
// environment, same as lib/email.ts expects at runtime.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const target = (process.argv.find((a) => a.startsWith("--send=")) || "").split("=")[1] || "";

// Dynamic import so dotenv can land first — lib/email.ts reads env at import time.
try {
  const { config } = await import("dotenv");
  config({ path: ".env.local", quiet: true });
  config({ quiet: true });
} catch {
  // dotenv is a dev dep; if it's not installed we just rely on exported env.
}

const { render, wrap, sendEmail, activeEmailProvider } = await import("../lib/email.ts");

const SAMPLE_TOKEN = "preview-token-abc123def456ghi789jkl012mno345";
const SAMPLE_NAME = "Mouriyan";

const KINDS = [
  {
    kind: "inner_circle_round1_invite",
    args: { to: target || "preview@local", recipientName: SAMPLE_NAME, extra: { token: SAMPLE_TOKEN, totalCohort: 1300 } },
  },
  {
    kind: "inner_circle_round1_reminder",
    args: { to: "preview@local", recipientName: SAMPLE_NAME, extra: { token: SAMPLE_TOKEN, hoursLeft: 6 } },
  },
  {
    kind: "inner_circle_round1_submitted",
    args: { to: "preview@local", recipientName: SAMPLE_NAME },
  },
  {
    kind: "inner_circle_round1_expired",
    args: { to: "preview@local", recipientName: SAMPLE_NAME },
  },
  {
    kind: "inner_circle_round1_advanced",
    args: { to: "preview@local", recipientName: SAMPLE_NAME, extra: { note: "Clean fit column, strong decision-makers. See you in Round 2." } },
  },
  {
    kind: "inner_circle_round1_rejected",
    args: { to: "preview@local", recipientName: SAMPLE_NAME, extra: { note: "The fit column was mostly generic. For Round 2, show us a reason that could only apply to that specific company." } },
  },
];

const outDir = path.join(process.cwd(), "scratchpad", "round1-emails");
mkdirSync(outDir, { recursive: true });

// Build an index page so the whole set is browsable with one open.
const indexItems = [];

for (const { kind, args } of KINDS) {
  const rendered = render(kind, args);
  const html = wrap(rendered);
  const file = path.join(outDir, `${kind}.html`);
  writeFileSync(file, html, "utf8");
  indexItems.push({ kind, subject: rendered.subject, file: `${kind}.html` });
  console.log(`✓ wrote ${path.relative(process.cwd(), file)}  —  subject: ${rendered.subject}`);
}

const indexHtml = `<!doctype html>
<html>
<head>
<meta charset="utf-8"><title>Round 1 email previews</title>
<style>
  body { font: 14px/1.5 system-ui, sans-serif; margin: 2rem; background: #f6f6f8; color: #111; }
  h1 { font-size: 20px; }
  ul { list-style: none; padding: 0; }
  li { margin: .6rem 0; padding: .9rem 1rem; background: #fff; border: 1px solid #eee; border-radius: 8px; }
  a { color: #8825F5; text-decoration: none; font-weight: 600; }
  a:hover { text-decoration: underline; }
  .sub { color: #666; font-size: 13px; margin-top: 2px; }
  code { background: #f0f0f3; padding: 1px 5px; border-radius: 3px; font-size: 12px; }
</style>
</head>
<body>
<h1>Inner Circle · Round 1 · email previews</h1>
<p>These are the <strong>exact HTML bodies</strong> candidates will receive. Open each file in a browser to see rendering.</p>
<ul>
${indexItems.map((i) => `<li><a href="${i.file}" target="_blank">${i.kind}</a><div class="sub">${i.subject}</div></li>`).join("\n")}
</ul>
</body>
</html>`;
writeFileSync(path.join(outDir, "index.html"), indexHtml, "utf8");
console.log(`\n✓ open ${path.join(outDir, "index.html")} in a browser to preview all six.`);

// ─── Live send (optional) ─────────────────────────────────────────────────
if (target) {
  const provider = activeEmailProvider();
  if (!provider) {
    console.log("\n⚠  --send= was provided but no email provider is configured.");
    console.log("    Set ONE of ZEPTOMAIL_TOKEN / BREVO_API_KEY / RESEND_API_KEY and re-run.");
    console.log("    Example:  ZEPTOMAIL_TOKEN=... node scripts/preview-round1-emails.mjs --send=you@domain.com");
    process.exit(0);
  }
  console.log(`\n→ Sending invite to ${target} via ${provider.name}…`);
  const result = await sendEmail("inner_circle_round1_invite", {
    to: target,
    recipientName: SAMPLE_NAME,
    extra: { token: SAMPLE_TOKEN },
  });
  if (result.ok) {
    console.log(`✓ Invite accepted by ${provider.name}. Check ${target} (give it a minute).`);
  } else {
    console.log(`✗ Send failed: ${result.skipped || "unknown"}.`);
    console.log("  — if this says 'DAILY SEND CAP REACHED', switch providers.");
    console.log("  — if it says 'provider 403' or similar, your domain isn't verified yet.");
    process.exit(1);
  }
}
