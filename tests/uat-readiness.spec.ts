import { test, expect } from "@playwright/test";

/**
 * Pre-UAT gate.
 *
 * Run before a real payment goes through the system. Covers the two things that
 * break a live test: a layout that traps the user on mobile, and an endpoint
 * that should refuse an anonymous caller but doesn't.
 *
 * Everything here is read-only and unauthenticated — safe against production.
 */

const PUBLIC_ROUTES = ["/", "/login", "/talent", "/pricing", "/terms", "/privacy-policy", "/refund-policy"];
const PROTECTED_ROUTES = ["/dashboard", "/post", "/profile", "/feed", "/messages", "/activity", "/payouts"];

test.describe("mobile layout", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const path of PUBLIC_ROUTES) {
    test(`${path} does not scroll sideways on a phone`, async ({ page }) => {
      await page.goto(path);
      // Horizontal overflow is the single most common mobile break: content is
      // reachable but the page feels broken and pinch-zooms unexpectedly.
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      );
      expect(overflows, `${path} overflows horizontally at 390px`).toBe(false);
    });
  }

  test("landing page scrolls vertically and is not height-locked", async ({ page }) => {
    await page.goto("/");
    // A tall page wrapped in items-center with a fixed height traps content
    // above the fold — the exact bug called out in the project conventions.
    const canScroll = await page.evaluate(() => {
      const el = document.documentElement;
      return el.scrollHeight > el.clientHeight;
    });
    expect(canScroll, "landing page has nothing to scroll — content may be clipped").toBe(true);

    // The app may scroll the window or an inner container (the dashboard uses
    // an overflow-y-auto <main>), so assert that SOMETHING actually moves
    // rather than assuming which element is the scroller.
    const scrolled = await page.evaluate(() => {
      window.scrollTo(0, 400);
      if (window.scrollY > 0) return true;
      const candidates = Array.from(document.querySelectorAll("body *")) as HTMLElement[];
      for (const el of candidates) {
        if (el.scrollHeight > el.clientHeight + 50) {
          const before = el.scrollTop;
          el.scrollTop = 200;
          if (el.scrollTop > before) return true;
          el.scrollTop = before;
        }
      }
      return false;
    });
    expect(scrolled, "nothing on the page scrolls — content below the fold is unreachable").toBe(true);
  });

  test("no element renders wider than the viewport", async ({ page }) => {
    await page.goto("/");
    const offenders = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      return Array.from(document.querySelectorAll("body *"))
        .filter((el) => (el as HTMLElement).getBoundingClientRect().width > vw + 1)
        .slice(0, 5)
        .map((el) => `${el.tagName}.${(el.className || "").toString().slice(0, 40)}`);
    });
    expect(offenders, `elements wider than viewport: ${offenders.join(", ")}`).toEqual([]);
  });
});

test.describe("auth gates hold", () => {
  for (const path of PROTECTED_ROUTES) {
    test(`${path} bounces an anonymous visitor`, async ({ page }) => {
      await page.goto(path);
      await page.waitForURL(/\/login/, { timeout: 15000 });
      expect(page.url()).toContain("/login");
    });
  }
});

test.describe("money endpoints refuse anonymous callers", () => {
  // These are the routes that move or record money. Every one of them must
  // reject a caller with no session — verify-payment in particular had no
  // authentication at all before the 2026-08-12 audit.
  const MUST_REJECT = [
    { path: "/api/payments/verify-payment", body: { orderId: "ord_fake" } },
    { path: "/api/payments/create-order", body: { gigId: "00000000-0000-0000-0000-000000000000" } },
    { path: "/api/escrow/release", body: { gigId: "00000000-0000-0000-0000-000000000000" } },
    { path: "/api/admin/payouts", body: { id: "1", action: "PAID" } },
    { path: "/api/admin/assign-managed", body: { gigId: "x", workerId: "y" } },
    { path: "/api/gig/apply", body: { gigId: "x" } },
  ];

  for (const { path, body } of MUST_REJECT) {
    test(`POST ${path} is not open to the public`, async ({ request }) => {
      const res = await request.post(path, { data: body, failOnStatusCode: false });
      expect(
        [401, 403].includes(res.status()),
        `${path} returned ${res.status()} to an anonymous caller — expected 401/403`
      ).toBe(true);
    });
  }

  test("GET /api/admin/payouts is not readable anonymously", async ({ request }) => {
    const res = await request.get("/api/admin/payouts", { failOnStatusCode: false });
    expect([401, 403]).toContain(res.status());
  });
});

test.describe("cron endpoints require the shared secret", () => {
  for (const path of [
    "/api/cron/auto-release",
    "/api/cron/nudge-posters",
    "/api/cron/process-payouts",
  ]) {
    test(`${path} rejects a request with no secret`, async ({ request }) => {
      const res = await request.get(path, { failOnStatusCode: false });
      expect(res.status(), `${path} is publicly triggerable`).toBe(401);
    });
  }
});

test.describe("webhook rejects forged calls", () => {
  // Cashfree is gone; this used to POST /api/webhooks/cashfree, which 404s now,
  // so the suite was asserting nothing about the gateway actually in use.
  test("razorpay webhook refuses an unsigned payload", async ({ request }) => {
    const res = await request.post("/api/webhooks/razorpay", {
      data: {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_forged",
              order_id: "order_forged",
              status: "captured",
              amount: 100000,
              notes: { gig_id: "forged", worker_id: "forged" },
            },
          },
        },
      },
      failOnStatusCode: false,
    });
    // 401 = signature rejected. 503 = the secret is not configured, in which
    // case the handler refuses to settle at all rather than trusting the body.
    expect(
      [401, 503].includes(res.status()),
      `unsigned webhook returned ${res.status()} — escrow could be funded for free`
    ).toBe(true);
  });
});
