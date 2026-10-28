// Readable screenshots of specific regions.
//
// scripts/shoot.mjs takes full-page shots, and the design lab is ~18,000px tall —
// scaled to fit, every control is four pixels high and you cannot judge anything.
// This clips to one section at a time so the result is legible.
//
//   node scripts/shoot-regions.mjs [--out screenshots/regions] [--width 390]
import { chromium, devices } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const argv = process.argv.slice(2);
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : d;
};
const OUT = arg("out", "screenshots/regions");
mkdirSync(OUT, { recursive: true });

// Each target is a page plus the heading of the section to capture. The heading
// text is the anchor because it survives markup changes that a CSS selector
// would not, and the SECTION around it is what gets shot — a viewport clip only
// covers what is currently scrolled into view, which is why the first attempt
// failed with "clipped area outside the resulting image".
const TARGETS = [
  ["design-lab", "/design-lab", "Type scale"],
  ["design-lab", "/design-lab", "Buttons"],
  ["design-lab", "/design-lab", "Status pills"],
  ["design-lab", "/design-lab", "Gig cards"],
  ["design-lab", "/design-lab", "Empty states"],
  ["design-lab", "/design-lab", "The derived tech workflow"],
  ["design-lab", "/design-lab", "Form fields"],
  ["design-lab", "/design-lab", "The grape panel"],
];

const WIDTHS = [
  { name: "390", width: 390, height: 844, mobile: true },
  { name: "1440", width: 1440, height: 900, mobile: false },
];

const browser = await chromium.launch();

for (const vp of WIDTHS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    ...(vp.mobile ? { userAgent: devices["Pixel 7"].userAgent } : {}),
  });
  const page = await ctx.newPage();

  let current = "";
  for (const [slug, url, heading] of TARGETS) {
    if (current !== url) {
      await page.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 45000 });
      await page.evaluate(() => document.fonts?.ready);
      await page.waitForTimeout(400);
      current = url;
    }

    // The <section> that owns this heading. Screenshotting the element scrolls it
    // into view itself and sizes the shot to the content.
    const section = page.locator("section").filter({ has: page.getByRole("heading", { name: heading, exact: true }) }).first();
    if ((await section.count()) === 0) {
      console.log(`  skip  ${heading} @ ${vp.name} (section not found)`);
      continue;
    }

    const file = path.join(
      OUT,
      `${slug}--${heading.toLowerCase().replace(/[^a-z0-9]+/g, "-")}--${vp.name}.png`
    );
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    await section.screenshot({ path: file });
    console.log(`  ok    ${file}`);
  }
  await ctx.close();
}

await browser.close();
console.log(`\nregions in ${OUT}/\n`);
