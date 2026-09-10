// Pins who gets paid for each listing type.
//
// The bug this guards against was live and silent: payments/create-order set the
// recipient to the assigned worker unconditionally, while cron/auto-release paid
// the poster only when listing_type === 'MARKET'. There are zero MARKET rows, so
// both landed on the worker and agreed by accident.
//
// That is wrong for SERVICE, which is 407 of 444 live listings. On a SERVICE
// listing the poster is the one selling, and the assigned_worker_id column holds
// the CLIENT who wants to hire them. Paying "the worker" there pays the customer.
//
// It had never fired because no SERVICE listing had ever been funded — 787
// applications, zero conversions — so this is a latent-loss test, not a
// regression test. Keep it that way.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  posterIsRecipient,
  payoutRecipientId,
  payerId,
  gigDirection,
  browserActionLabel,
  listingTypeLabel,
  KNOWN_LISTING_TYPES,
} from "../../lib/gigRoles.ts";

const POSTER = "poster-uuid";
const OTHER = "counterparty-uuid";
const gig = (listing_type) => ({ listing_type, poster_id: POSTER, assigned_worker_id: OTHER });

test("the poster is paid on listings where they are selling", () => {
  for (const t of ["SERVICE", "MARKET"]) {
    assert.equal(posterIsRecipient(gig(t)), true, `${t} should pay the poster`);
    assert.equal(payoutRecipientId(gig(t)), POSTER, `${t} payout must go to the poster`);
    assert.equal(payerId(gig(t)), OTHER, `${t} must be funded by the client`);
    assert.equal(gigDirection(gig(t)), "SUPPLY");
  }
});

test("the assigned worker is paid on listings where the poster is buying", () => {
  for (const t of ["HUSTLE", "COMPANY_TASK"]) {
    assert.equal(posterIsRecipient(gig(t)), false, `${t} should pay the worker`);
    assert.equal(payoutRecipientId(gig(t)), OTHER, `${t} payout must go to the worker`);
    assert.equal(payerId(gig(t)), POSTER, `${t} must be funded by the poster`);
    assert.equal(gigDirection(gig(t)), "DEMAND");
  }
});

test("payer and recipient are never the same person", () => {
  // If these ever collide, someone funds their own payout and the platform fee
  // is charged on a round trip.
  for (const t of KNOWN_LISTING_TYPES) {
    assert.notEqual(payoutRecipientId(gig(t)), payerId(gig(t)), `${t} routes money in a circle`);
  }
});

test("an unresolved counterparty returns null rather than guessing", () => {
  // Callers must refuse to settle. Falling back to a default here is how money
  // reaches the wrong side.
  assert.equal(payoutRecipientId({ listing_type: "HUSTLE", poster_id: POSTER, assigned_worker_id: null }), null);
  assert.equal(payerId({ listing_type: "SERVICE", poster_id: POSTER, assigned_worker_id: null }), null);
});

test("an unknown listing type defaults to paying the worker, not the poster", () => {
  // The safer default: a stray type must never silently divert money to whoever
  // created the listing.
  const unknown = { listing_type: "SOMETHING_NEW", poster_id: POSTER, assigned_worker_id: OTHER };
  assert.equal(posterIsRecipient(unknown), false);
  assert.equal(payoutRecipientId(unknown), OTHER);
});

test("listing type is matched case-insensitively", () => {
  assert.equal(posterIsRecipient({ listing_type: "service", poster_id: POSTER, assigned_worker_id: OTHER }), true);
});

test("the browser is told to hire on supply and apply on demand", () => {
  assert.match(browserActionLabel(gig("SERVICE")), /request|hire/i);
  assert.match(browserActionLabel(gig("HUSTLE")), /apply/i);
});

test("no label ever renders a raw database enum", () => {
  for (const t of KNOWN_LISTING_TYPES) {
    const label = listingTypeLabel(gig(t));
    assert.notEqual(label, t, `${t} is being shown to users verbatim`);
    assert.doesNotMatch(label, /_/, `${label} still contains an underscore`);
    assert.notEqual(label, label.toUpperCase(), `${label} is shouting a column value`);
  }
});
