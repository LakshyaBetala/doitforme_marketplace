// Screenshot interactive states — the things a static page shot never shows.
//
// The mobile sheet, the account menu and the hover/focus states only exist after
// an interaction, so they are exactly where unfinished work hides. This drives
// each one and captures it mid-open and fully open.
//
//   node scripts/shoot-states.mjs [--out screenshots/states]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const argv = process.argv.slice(2);
const i = argv.indexOf("--out");
const OUT = i !== -1 && argv[i + 1] ? argv[i + 1] : "screenshots/states";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });

/* ---------------- phone: the sheet ---------------- */
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/design-lab`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(300);

  await shot(page, "phone-01-closed");

  await page.getByRole("button", { name: "Open menu" }).click();
  // Mid-slide. If the sheet were still teleporting, this frame and the next
  // would be identical — which is the point of capturing it.
  await page.waitForTimeout(90);
  await shot(page, "phone-02-sheet-opening");

  await page.waitForTimeout(400);
  await shot(page, "phone-03-sheet-open");

  // The account menu inside the sheet, which is the only way to sign out on a phone.
  await page.getByRole("button", { name: /Your account|Alex/ }).first().click();
  await page.waitForTimeout(350);
  await shot(page, "phone-04-account-menu");

  await ctx.close();
}

/* ---------------- desktop: the rail account menu ---------------- */
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/design-lab`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(300);

  await page.getByRole("button", { name: /Alex Kumar/ }).first().click();
  await page.waitForTimeout(350);
  await shot(page, "desktop-01-account-menu");

  // Hover on a nav item, to check the rail's hover state reads at all.
  await page.getByRole("link", { name: "Explore work" }).hover();
  await page.waitForTimeout(250);
  await shot(page, "desktop-02-nav-hover");

  // Keyboard focus. The focus ring is the thing nobody looks at and everybody
  // needs; it is defined once in workspace-theme.css.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.waitForTimeout(200);
  await shot(page, "desktop-03-focus-ring");

  await ctx.close();
}

await browser.close();
console.log(`states in ${OUT}/`);
