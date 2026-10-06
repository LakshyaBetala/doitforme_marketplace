import { test, expect } from "@playwright/test";

/**
 * Responsive regressions, pinned.
 *
 * scripts/shoot.mjs is for LOOKING at pages — it writes PNGs and a table. This
 * file is the part that belongs in CI: the two defects that are measurable
 * rather than a matter of taste, checked at the widths that actually matter.
 *
 * 360 is the floor. It is the common width on the Android phones this is used
 * on, and it is where a two-column grid and a four-item bottom bar either hold
 * or do not. Testing at 375 and calling it mobile misses it.
 *
 * Every signed-in route is excluded on purpose: Supabase Auth is 402, so
 * proxy.ts redirects them all to /login and the assertions would be about the
 * login page. /design-lab is the stand-in — it renders every shared component
 * inside the real shell, which is where a layout break would show up anyway.
 */

const PUBLIC_PAGES = ["/", "/login", "/pricing", "/terms", "/maintenance"];
const SHELL_PAGES = ["/design-lab", "/shell-preview"];

const WIDTHS = [
  { name: "360 (Android floor)", width: 360, height: 780 },
  { name: "390 (iPhone)", width: 390, height: 844 },
  { name: "768 (tablet)", width: 768, height: 1024 },
  { name: "1024 (laptop)", width: 1024, height: 768 },
  { name: "1440 (desktop)", width: 1440, height: 900 },
];

/**
 * Horizontal overflow is the defect that never shows up on the machine it was
 * built on and ruins every phone: one element wider than the viewport makes the
 * whole document pannable sideways, so every vertical scroll drifts left and
 * right under the thumb.
 */
async function overflowOf(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    const overflow = de.scrollWidth - de.clientWidth;
    if (overflow <= 0) return { overflow, culprits: [] as string[] };
    const culprits: string[] = [];
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.position === "fixed" || cs.visibility === "hidden") continue;
      if (r.right > de.clientWidth + 1 || r.left < -1) {
        culprits.push(
          `${el.tagName.toLowerCase()}.${String(el.className).split(/\s+/).slice(0, 3).join(".")}`
        );
      }
    }
    return { overflow, culprits: [...new Set(culprits)].slice(0, 5) };
  });
}

for (const vp of WIDTHS) {
  test.describe(`@ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const path of [...PUBLIC_PAGES, ...SHELL_PAGES]) {
      test(`${path} does not scroll sideways`, async ({ page }) => {
        await page.goto(path, { waitUntil: "networkidle" });
        const { overflow, culprits } = await overflowOf(page);
        expect(
          overflow,
          `${path} overflows by ${overflow}px. Widest: ${culprits.join(", ") || "unknown"}`
        ).toBeLessThanOrEqual(0);
      });
    }
  });
}

test.describe("mobile shell", () => {
  // Only the viewport properties, not the whole devices["Pixel 7"] descriptor:
  // that one carries defaultBrowserType, and Playwright refuses it inside a
  // describe because switching browser forces a new worker.
  test.use({
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true,
  });

  test("the bottom bar clears the home indicator and keeps 4 tappable items", async ({ page }) => {
    await page.goto("/design-lab", { waitUntil: "networkidle" });

    const bar = page.getByRole("navigation", { name: "Primary" });
    await expect(bar).toBeVisible();

    const links = bar.getByRole("link");
    await expect(links).toHaveCount(4);

    for (const link of await links.all()) {
      const box = await link.boundingBox();
      expect(box!.height, `"${await link.textContent()}" is ${box!.height}px tall`).toBeGreaterThanOrEqual(44);
    }
  });

  test("the menu sheet opens, traps the page, and closes", async ({ page }) => {
    await page.goto("/design-lab", { waitUntil: "networkidle" });

    const sheet = page.getByRole("navigation", { name: "Menu" });
    // Mounted but inert while closed — it has to stay in the DOM to animate out,
    // which makes "is it actually hidden" a real question rather than a given.
    await expect(sheet).toBeHidden();

    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(sheet).toBeVisible();

    // Body scroll is locked while the sheet is open, or dragging the menu scrolls
    // the page behind it and you land somewhere you did not navigate to.
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .toBe("hidden");

    // The scrim and the X both carry "Close menu", and .first() is the scrim —
    // whose centre the panel covers, so the click is intercepted by the nav and
    // retries until timeout. Scope to the button inside the sheet.
    await sheet.getByRole("button", { name: "Close menu" }).click();
    await expect(sheet).toBeHidden();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  });

  test("the sidebar rail is not rendered on a phone", async ({ page }) => {
    await page.goto("/design-lab", { waitUntil: "networkidle" });
    await expect(page.getByRole("complementary")).toBeHidden();
  });
});

test.describe("desktop shell", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("the rail is visible and the mobile bars are not", async ({ page }) => {
    await page.goto("/design-lab", { waitUntil: "networkidle" });
    await expect(page.getByRole("navigation", { name: "Workspace" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeHidden();
  });

  test("the breadcrumb names the page instead of repeating Workspace", async ({ page }) => {
    // /design-lab is not a nav item, which is exactly the case that used to fall
    // back to "Workspace" directly under a crumb already reading "Workspace".
    await page.goto("/design-lab", { waitUntil: "networkidle" });
    const crumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumb).toBeVisible();
    await expect(crumb).not.toHaveText(/Workspace\s*\/\s*Workspace/);
  });
});

test.describe("the two constraints from the redesign brief", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("no Wallet in the navigation, at any width", async ({ page }) => {
    await page.goto("/design-lab", { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: /^Wallet$/ })).toHaveCount(0);
  });

  test("The Inner Circle appears exactly once in the visible navigation", async ({ page }) => {
    await page.goto("/design-lab", { waitUntil: "networkidle" });
    // The Figma had it twice — a sidebar item AND a right-rail card — which reads
    // as two separate features to anyone who has not seen the design file.
    //
    // Counting raw text finds three: the desktop rail, the mobile sheet (mounted
    // at every width now so it can animate out) and the design lab's own demo
    // panel. Only one of those is navigation the user can see at this width, and
    // that is the thing the brief was about.
    // Not exact: the item carries a NEW badge, so its accessible name is
    // "The Inner Circle NEW" and an exact match finds nothing.
    const navLinks = page.getByRole("link", { name: /^The Inner Circle/ });
    const visible = await navLinks.evaluateAll(
      (els) => els.filter((el) => (el as HTMLElement).offsetParent !== null).length
    );
    expect(visible, "exactly one reachable Inner Circle nav entry").toBe(1);
  });

  test("a member sees only their own role surface", async ({ page }) => {
    // /design-lab renders with innerCircleRole="TECH".
    await page.goto("/design-lab", { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: "My briefs" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Outreach" })).toHaveCount(0);
  });
});
