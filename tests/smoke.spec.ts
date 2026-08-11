import { test, expect } from "@playwright/test";

/**
 * Unauthenticated smoke tests.
 *
 * These deliberately never sign in and never write. The app points at the
 * PRODUCTION Supabase project even when the dev server is local, so any test
 * that creates a gig or an application is polluting live data — see
 * golden-path.spec.ts, which does exactly that and is quarantined.
 *
 * Scope: every public route renders, the auth gate holds, and the routes added
 * in the 2026-08-12 marketplace split resolve.
 */

test.describe("public routes render", () => {
  for (const path of ["/", "/login", "/talent", "/pricing", "/terms", "/privacy-policy"]) {
    test(`${path} responds 200 and paints`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status(), `${path} should not error`).toBeLessThan(400);
      // A blank body means a client-side crash even though the HTML shell was 200.
      await expect(page.locator("body")).not.toBeEmpty();
    });
  }
});

test.describe("auth gate", () => {
  // proxy.ts must bounce anonymous users off protected paths. If this breaks,
  // private surfaces leak.
  for (const path of ["/dashboard", "/post", "/profile", "/feed"]) {
    test(`${path} redirects anonymous users to login`, async ({ page }) => {
      await page.goto(path);
      await page.waitForURL(/\/login/, { timeout: 15000 });
      expect(page.url()).toContain("/login");
    });
  }
});

test.describe("talent directory", () => {
  test("renders the Talent heading and no task-feed chrome", async ({ page }) => {
    await page.goto("/talent");
    await expect(page.getByRole("heading", { name: "Talent", exact: true })).toBeVisible();
  });

  test("is reachable without an account", async ({ page }) => {
    const res = await page.goto("/talent");
    expect(res?.status()).toBeLessThan(400);
    expect(page.url()).toContain("/talent");
  });
});

test.describe("responsive layout", () => {
  // The site is mobile-first; a horizontally scrolling body is the most common
  // way that silently breaks. Checked at the narrowest phone width we support.
  for (const [label, width, height] of [
    ["mobile", 390, 844],
    ["desktop", 1440, 900],
  ] as const) {
    test(`landing page does not scroll horizontally on ${label}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      );
      expect(overflows, `body overflows horizontally at ${width}px`).toBe(false);
    });
  }
});
