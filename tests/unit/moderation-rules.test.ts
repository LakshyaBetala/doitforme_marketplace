import { test } from "node:test";
import assert from "node:assert/strict";
import { containsSensitiveInfo } from "../../lib/moderation-rules";

// Regression guard. The social-handle regex lists short platform aliases
// ("sc", "tg"). Without \b anchors they match INSIDE ordinary words — "escrow"
// contains "sc", "lightgrey" contains "tg" — which silently blocked legitimate
// listings and chat messages about the escrow flow itself.
test("ordinary words containing platform aliases are allowed", () => {
  const allowed = [
    "when does the escrow release",
    "lets discuss the scope of work",
    "funds are held in escrow before work starts",
    "describe the deliverables",
    "the transcript is attached",
  ];
  for (const text of allowed) {
    const result = containsSensitiveInfo(text);
    assert.equal(result.detected, false, `expected allowed but blocked: "${text}" (${result.reason})`);
  }
});

test("real contact sharing is still blocked", () => {
  const blocked = [
    "insta: some_user",
    "snap - myhandle",
    "telegram me at hustler99",
    "ping @lakshya_b",
    "mail me at foo at gmail dot com",
    "call 9876543210",
    "9 8 7 6 5 4 3 2 1 0",
  ];
  for (const text of blocked) {
    assert.equal(containsSensitiveInfo(text).detected, true, `expected blocked but allowed: "${text}"`);
  }
});

test("off-platform payment keywords are still blocked", () => {
  for (const text of ["pay via upi", "send it on paytm", "gpay works"]) {
    assert.equal(containsSensitiveInfo(text).detected, true, `expected blocked but allowed: "${text}"`);
  }
});

test("a real company listing passes end to end", () => {
  const listing = [
    "Need Flutter + Firebase Developer — Live Blood Donor App (6-week contract)",
    "Selection: apply with portfolio, shortlist, 20-minute call, 2 selected.",
    "Funds are held in escrow before work starts, reviewed weekly, released on final handover.",
    "2 positions. Rs 5000 each.",
  ].join("\n");
  assert.equal(containsSensitiveInfo(listing).detected, false);
});
