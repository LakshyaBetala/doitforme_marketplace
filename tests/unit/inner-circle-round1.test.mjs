// Deterministic unit tests for the Inner Circle · Round 1 flow.
//
// Everything here exercises PURE functions from lib/innerCircleRound1.ts —
// no D1, no Supabase, no fetch. The flow has moving pieces (24-hour clocks,
// four reminder buckets, SHA-256 hashing, HMAC session signing) that are
// easy to subtly break and hard to notice in staging because the breaks
// only show up at specific wall-clock times.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CAMPAIGN_SECONDS,
  LOGIN_MAX_FAILS,
  LOGIN_WINDOW_SECONDS,
  REMINDER_BUCKETS,
  TASK_WINDOW_SECONDS,
  computeCampaignClose,
  computeDeadline,
  constantTimeEqual,
  dueReminderBucket,
  generateToken,
  hashDob,
  isValidSubmissionUrl,
  nextReminderAt,
  normaliseDob,
  parseRemindersSent,
  signSession,
  verifySession,
} from "../../lib/innerCircleRound1.ts";

const SECRET = "test-session-secret-just-for-tests";
const PEPPER = "test-dob-pepper";

// ─── Deadline math ──────────────────────────────────────────────────────

test("computeDeadline = started_at + 24h, exactly", () => {
  const started = 1_735_000_000;
  assert.equal(computeDeadline(started), started + 86_400);
  assert.equal(computeDeadline(0), TASK_WINDOW_SECONDS);
});

test("computeCampaignClose = invited_at + 7d, exactly", () => {
  const invited = 1_735_000_000;
  assert.equal(computeCampaignClose(invited), invited + 7 * 86_400);
  assert.equal(CAMPAIGN_SECONDS, 7 * 86_400);
});

// ─── Reminder bucket selection ──────────────────────────────────────────

test("reminder buckets are ordered earliest-first", () => {
  // The order matters: nextReminderAt walks the list and returns the first
  // unsent bucket that lies in the future. If the ordering is wrong, a
  // candidate who hasn't been reminded at all would get the 30m one first.
  const bs = REMINDER_BUCKETS.map((b) => b.before);
  const sorted = [...bs].sort((a, b) => b - a);
  assert.deepEqual(bs, sorted, "REMINDER_BUCKETS must be ordered largest 'before' first");
});

test("dueReminderBucket returns the right bucket at each crossing", () => {
  const deadline = 1_000_000;
  // At each exact crossing point, that bucket is due.
  assert.equal(dueReminderBucket(deadline, deadline - 12 * 3600, []), "12h");
  assert.equal(dueReminderBucket(deadline, deadline - 6 * 3600, ["12h"]), "6h");
  assert.equal(dueReminderBucket(deadline, deadline - 3 * 3600, ["12h", "6h"]), "3h");
  assert.equal(dueReminderBucket(deadline, deadline - 30 * 60, ["12h", "6h", "3h"]), "30m");
});

test("dueReminderBucket returns null when all sent or deadline past", () => {
  const deadline = 1_000_000;
  // All sent — nothing to fire.
  assert.equal(
    dueReminderBucket(deadline, deadline - 30 * 60, ["12h", "6h", "3h", "30m"]),
    null
  );
  // Deadline has passed — not a reminder situation, that's an expiry.
  assert.equal(dueReminderBucket(deadline, deadline + 1, []), null);
});

test("dueReminderBucket skips the bucket already sent", () => {
  const deadline = 1_000_000;
  // Candidate opened portal very late — 12h and 6h both already due, but
  // 12h is marked sent (we did fire it). We should hand back 6h, not try
  // to replay 12h.
  const now = deadline - 5 * 3600;
  assert.equal(dueReminderBucket(deadline, now, ["12h"]), "6h");
});

test("nextReminderAt advances through the buckets correctly", () => {
  const started = 1_000_000;
  const deadline = started + 86_400;

  // At start, next tick is 12h before deadline (started + 12h).
  const t1 = nextReminderAt(deadline, [], started);
  assert.equal(t1, deadline - 12 * 3600);

  // After firing 12h, next is 6h before deadline.
  const t2 = nextReminderAt(deadline, ["12h"], started);
  assert.equal(t2, deadline - 6 * 3600);

  // After all four, null — no more work on this row.
  const t3 = nextReminderAt(deadline, ["12h", "6h", "3h", "30m"], started);
  assert.equal(t3, null);
});

test("nextReminderAt returns null for a candidate who started with <30m left", () => {
  // Edge case: a candidate claims the invite in the last 29 minutes before
  // campaign close. There's no reminder slot left — the only email they'll
  // get before the deadline is nothing, and that's correct.
  const started = 1_000_000;
  const deadline = started + 1500; // 25 minutes
  const next = nextReminderAt(deadline, [], started);
  assert.equal(next, null);
});

// ─── parseRemindersSent robustness ──────────────────────────────────────

test("parseRemindersSent handles empty, malformed, and unknown keys", () => {
  assert.deepEqual(parseRemindersSent(null), []);
  assert.deepEqual(parseRemindersSent("[]"), []);
  assert.deepEqual(parseRemindersSent("not-json"), []);
  assert.deepEqual(parseRemindersSent('{"a":1}'), []); // not an array
  assert.deepEqual(parseRemindersSent('["12h","hoax","6h"]'), ["12h", "6h"]);
});

// ─── DOB normalisation ──────────────────────────────────────────────────

test("normaliseDob accepts ISO and DD-MM-YYYY, rejects garbage", () => {
  assert.equal(normaliseDob("2000-05-14"), "2000-05-14");
  assert.equal(normaliseDob("14-05-2000"), "2000-05-14");
  assert.equal(normaliseDob("14/05/2000"), "2000-05-14");
  assert.equal(normaliseDob("1990-02-29"), null); // not a leap year
  assert.equal(normaliseDob("1888-01-01"), null); // too old
  assert.equal(normaliseDob("not a date"), null);
  assert.equal(normaliseDob(""), null);
  assert.equal(normaliseDob(null), null);
});

// ─── Hashing + session signing (async, need top-level await) ────────────

test("hashDob is deterministic and differs with the token (salt)", async () => {
  const h1 = await hashDob("2000-05-14", "token-a", PEPPER);
  const h2 = await hashDob("2000-05-14", "token-a", PEPPER);
  const h3 = await hashDob("2000-05-14", "token-b", PEPPER);
  assert.equal(h1, h2, "same inputs → same hash");
  assert.notEqual(h1, h3, "different token → different hash (prevents cross-row rainbow table)");
});

test("constantTimeEqual compares correctly", () => {
  assert.equal(constantTimeEqual("abc", "abc"), true);
  assert.equal(constantTimeEqual("abc", "abd"), false);
  assert.equal(constantTimeEqual("abc", "abcd"), false, "different lengths must fail");
  assert.equal(constantTimeEqual("", ""), true);
});

test("signSession round-trips and verifySession rejects tampered input", async () => {
  const cookie = await signSession(42, SECRET);
  const ok = await verifySession(cookie, SECRET);
  assert.ok(ok, "fresh cookie must verify");
  assert.equal(ok.id, 42);

  // Tamper with the id — signature no longer matches.
  const [idPart, expPart, sigPart] = cookie.split(".");
  const tampered = `99.${expPart}.${sigPart}`;
  const bad = await verifySession(tampered, SECRET);
  assert.equal(bad, null, "tampered id must not verify");

  // Signed with a different secret → must reject.
  const bad2 = await verifySession(cookie, "other-secret");
  assert.equal(bad2, null, "wrong secret must not verify");
});

test("verifySession rejects an expired cookie", async () => {
  // Fabricate a cookie whose exp is 10 minutes in the past but with a valid
  // signature against SECRET. The signSession helper always produces a
  // forward-dated cookie, so we construct one by hand.
  const expired = Math.floor(Date.now() / 1000) - 600;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const payload = `7.${expired}`;
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const b64url = (bytes) => {
    let s = "";
    for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };
  const cookie = `${payload}.${b64url(sig)}`;
  const bad = await verifySession(cookie, SECRET);
  assert.equal(bad, null, "expired cookie must not verify even with a valid signature");
});

// ─── Token generation ───────────────────────────────────────────────────

test("generateToken returns URL-safe 32-byte tokens, no two the same", () => {
  const n = 100;
  const tokens = new Set();
  for (let i = 0; i < n; i++) {
    const t = generateToken();
    assert.match(t, /^[A-Za-z0-9_-]+$/, `token "${t}" must be base64url`);
    assert.ok(t.length >= 43, "32 random bytes base64url is 43 chars after unpadding");
    tokens.add(t);
  }
  assert.equal(tokens.size, n, "all tokens must be unique over a small sample");
});

// ─── Submission URL validation ──────────────────────────────────────────

test("isValidSubmissionUrl accepts Google Sheets URLs only", () => {
  assert.equal(
    isValidSubmissionUrl("https://docs.google.com/spreadsheets/d/abc/edit"),
    true
  );
  // Protocol must be https.
  assert.equal(
    isValidSubmissionUrl("http://docs.google.com/spreadsheets/d/abc"),
    false
  );
  // Not Google Sheets.
  assert.equal(isValidSubmissionUrl("https://notion.so/sheet"), false);
  assert.equal(isValidSubmissionUrl("https://example.com/docs.google.com"), false);
  assert.equal(isValidSubmissionUrl("not-a-url"), false);
});

// ─── Constants sanity ───────────────────────────────────────────────────

test("rate-limit constants are what the plan says", () => {
  assert.equal(LOGIN_MAX_FAILS, 5, "docs promise 5 attempts per window");
  assert.equal(LOGIN_WINDOW_SECONDS, 15 * 60, "docs promise a 15-minute window");
});
