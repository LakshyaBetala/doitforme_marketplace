// Screenshot every reachable surface at every viewport that matters, and report
// the two layout defects that are measurable rather than visual.
//
// Why a script and not the Playwright test suite: this is for LOOKING at pages,
// so the output is PNGs plus a short table. The assertions that belong in CI live
// in tests/responsive.spec.ts.
//
//   node scripts/shoot.mjs [--out screenshots/responsive] [--only design-lab]
//
// Needs a dev server on :3000 with MAINTENANCE_MODE=off.
import { chromium, devices } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};
const OUT = arg("out", "screenshots/responsive");
const ONLY = arg("only", null);

// 360 is the floor that matters: it is the common width on the Android phones
// this is actually used on, and it is where a 4-item bottom bar and a two-column
// grid either hold or do not. 390 is the modern iPhone. 768 is the iPad portrait
// break where the sidebar is still hidden. 1024 is where the rail appears.
const VIEWPORTS = [
  { name: "360-android", width: 360, height: 780, mobile: true },
  { name: "390-iphone", width: 390, height: 844, mobile: true },
  { name: "768-tablet", width: 768, height: 1024, mobile: true },
  { name: "1024-laptop", width: 1024, height: 768, mobile: false },
  { name: "1440-desktop", width: 1440, height: 900, mobile: false },
];

const PAGES = [
  { slug: "design-lab", url: "/design-lab" },
  { slug: "shell-preview", url: "/shell-preview" },
  { slug: "landing", url: "/" },
  { slug: "login", url: "/login" },
  { slug: "talent", url: "/talent" },
  { slug: "pricing", url: "/pricing" },
  { slug: "maintenance", url: "/maintenance" },
];

const pages = ONLY ? PAGES.filter((p) => p.slug === ONLY) : PAGES;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const rows = [];
const problems = [];

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    ...(vp.mobile ? { userAgent: devices["Pixel 7"].userAgent } : {}),
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160));
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 160)}`));

  for (const p of pages) {
    consoleErrors.length = 0;
    let status = "?";
    try {
      const res = await page.goto(`${BASE}${p.url}`, { waitUntil: "networkidle", timeout: 45000 });
      status = res?.status() ?? "?";
    } catch (e) {
      problems.push(`${p.slug} @ ${vp.name}: navigation failed — ${String(e).slice(0, 120)}`);
      continue;
    }
    // Fonts and any entry animation. Without this, screenshots catch type
    // mid-swap and elements mid-fade, which reads as a layout bug that is not one.
    await page.evaluate(() => document.fonts?.ready);
    await page.waitForTimeout(450);

    const file = path.join(OUT, `${p.slug}--${vp.name}.png`);
    await page.screenshot({ path: file, fullPage: true });

    // HORIZONTAL OVERFLOW. The defect that is invisible on a desktop and ruins a
    // phone: one element wider than the viewport makes the whole page pannable
    // sideways, so every vertical scroll drifts. Measured, not eyeballed.
    const m = await page.evaluate(() => {
      const de = document.documentElement;
      const overflow = de.scrollWidth - de.clientWidth;
      const wide = [];
      if (overflow > 0) {
        for (const el of document.querySelectorAll("body *")) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.right > de.clientWidth + 1 || r.left < -1) {
            const cs = getComputedStyle(el);
            if (cs.position === "fixed" || cs.visibility === "hidden") continue;
            wide.push(
              `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.split(/\s+/).slice(0, 3).join(".") : ""} (${Math.round(r.left)}→${Math.round(r.right)})`
            );
          }
        }
      }

      // TOUCH TARGETS under 40px. Anything tappable smaller than that is a
      // coin-flip with a thumb.
      //
      // EXCEPT a link sitting inside a sentence. WCAG 2.5.8 exempts targets "in
      // a sentence or block of text" precisely because the alternative is
      // padding an inline link until it breaks the line height of the prose
      // around it. Flagging those produced noise that would have been "fixed" by
      // making the writing worse.
      const inSentence = (el) => {
        if (el.tagName !== "A") return false;
        const p = el.parentElement;
        if (!p) return false;
        if (!/^(P|LI|SPAN|SMALL|TD|DD|DT|H1|H2|H3|H4|H5|H6|LABEL)$/.test(p.tagName)) return false;
        // Real prose around it, not a list item that only holds the link.
        return (p.textContent || "").trim().length > (el.textContent || "").trim().length + 8;
      };

      const small = [];
      for (const el of document.querySelectorAll(
        'a, button, [role="button"], input:not([type="hidden"]), select, textarea'
      )) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (getComputedStyle(el).visibility === "hidden") continue;
        if (inSentence(el)) continue;
        if (r.height < 40 || r.width < 24) {
          const label = (el.getAttribute("aria-label") || el.textContent || el.tagName)
            .trim()
            .slice(0, 34);
          small.push(`${Math.round(r.width)}x${Math.round(r.height)} "${label}"`);
        }
      }

      return {
        overflow,
        wide: [...new Set(wide)].slice(0, 6),
        small: [...new Set(small)].slice(0, 6),
        scrollHeight: de.scrollHeight,
      };
    });

    rows.push({
      page: p.slug,
      vp: vp.name,
      status,
      h: m.scrollHeight,
      overflow: m.overflow,
      small: m.small.length,
      errs: consoleErrors.length,
    });

    if (m.overflow > 0) {
      problems.push(
        `OVERFLOW ${m.overflow}px — ${p.slug} @ ${vp.name}\n      ${m.wide.join("\n      ") || "(culprit not isolated)"}`
      );
    }
    if (m.small.length && vp.mobile) {
      problems.push(`SMALL TAP TARGETS — ${p.slug} @ ${vp.name}\n      ${m.small.join("\n      ")}`);
    }
    if (consoleErrors.length) {
      problems.push(`CONSOLE — ${p.slug} @ ${vp.name}\n      ${consoleErrors.slice(0, 3).join("\n      ")}`);
    }
  }
  await context.close();
}
await browser.close();

console.log(
  `\n${"page".padEnd(15)}${"viewport".padEnd(14)}${"status".padEnd(8)}${"height".padEnd(8)}${"ovf".padEnd(6)}${"small".padEnd(7)}errs`
);
console.log("-".repeat(64));
for (const r of rows) {
  console.log(
    String(r.page).padEnd(15) +
      String(r.vp).padEnd(14) +
      String(r.status).padEnd(8) +
      String(r.h).padEnd(8) +
      String(r.overflow).padEnd(6) +
      String(r.small).padEnd(7) +
      String(r.errs)
  );
}

console.log(`\n${problems.length} problem(s)\n`);
for (const p of problems) console.log("  - " + p);
console.log(`\nscreenshots in ${OUT}/\n`);
