// Pins the platform's single money direction.
//
// DoItForMe is a freelance platform: the poster is the client and pays, the
// assigned worker does the work and is paid. Every lifecycle guard is built on
// that — deliver checks the worker, manual_release_escrow authorizes the poster,
// dispute and request-changes are poster actions.
//
// SERVICE listings had been modelled as a mirrored second direction where the
// poster collects instead of paying. That inverted every one of those guards at
// once, so a service listing could not complete even in principle: the customer
// was not allowed to fund it, the customer would have had to deliver the work,
// and the provider would have approved their own delivery. 407 of 444 listings
// are SERVICE; they took 787 applications and none ever funded, assigned,
// completed or paid.
//
// The fix is that a SERVICE listing is a shopfront advert, not a transaction.
// It cannot hold escrow at all. Hiring from one creates a normal engagement via
// /api/gig/request-service. These tests exist to stop the mirror coming back.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  posterIsRecipient,
  payoutRecipientId,
  payerId,
  isServiceAdvert,
  canFundEscrow,
  browserActionLabel,
  listingTypeLabel,
  responderNoun,
  KNOWN_LISTING_TYPES,
} from "../../lib/gigRoles.ts";

const POSTER = "poster-uuid";
const OTHER = "counterparty-uuid";
const gig = (listing_type) => ({ listing_type, poster_id: POSTER, assigned_worker_id: OTHER });

test("the assigned worker is paid on every kind of work this platform runs", () => {
  for (const t of ["HUSTLE", "COMPANY_TASK"]) {
    assert.equal(posterIsRecipient(gig(t)), false, `${t} must not pay the poster`);
    assert.equal(payoutRecipientId(gig(t)), OTHER, `${t} payout must go to the worker`);
    assert.equal(payerId(gig(t)), POSTER, `${t} must be funded by the poster`);
  }
});

test("a service listing is an advert and can never hold escrow", () => {
  // This is the whole fix. If canFundEscrow ever returns true for SERVICE, the
  // payment routes will accept a gig whose delivery step nobody can perform:
  // /api/gig/deliver only accepts the assigned worker, and on an advert the
  // person doing the work is the poster.
  const advert = gig("SERVICE");
  assert.equal(isServiceAdvert(advert), true);
  assert.equal(canFundEscrow(advert), false);
});

test("every listing that is not an advert can hold escrow", () => {
  for (const t of ["HUSTLE", "COMPANY_TASK", "MARKET"]) {
    assert.equal(canFundEscrow(gig(t)), true, `${t} must be fundable`);
    assert.equal(isServiceAdvert(gig(t)), false, `${t} is not an advert`);
  }
});

test("MARKET remains the one poster-is-paid type, and nothing else joins it", () => {
  // MARKET belongs to the sister marketplace and has zero rows here. It is kept
  // because the fee and release code already handles it. The assertion that
  // matters is the second one: no other type may drift into this branch again.
  assert.equal(posterIsRecipient(gig("MARKET")), true);
  assert.equal(payoutRecipientId(gig("MARKET")), POSTER);
  assert.equal(payerId(gig("MARKET")), OTHER);

  const posterPaid = KNOWN_LISTING_TYPES.filter((t) => posterIsRecipient(gig(t)));
  assert.deepEqual(posterPaid, ["MARKET"], "only MARKET may pay the poster");
});

test("payer and recipient are never the same person", () => {
  // If these collide, someone funds their own payout and the platform fee is
  // charged on a round trip.
  for (const t of KNOWN_LISTING_TYPES) {
    assert.notEqual(payoutRecipientId(gig(t)), payerId(gig(t)), `${t} routes money in a circle`);
  }
});

test("an unresolved counterparty returns null rather than guessing", () => {
  // Callers must refuse to settle. Falling back to a default here is how money
  // reaches the wrong side.
  assert.equal(payoutRecipientId({ listing_type: "HUSTLE", poster_id: POSTER, assigned_worker_id: null }), null);
  assert.equal(payerId({ listing_type: "MARKET", poster_id: POSTER, assigned_worker_id: null }), null);
});

test("an unknown listing type pays the worker and stays fundable", () => {
  // The safer default: a stray type must never silently divert money to whoever
  // created the listing, and must not be mistaken for an advert.
  const unknown = { listing_type: "SOMETHING_NEW", poster_id: POSTER, assigned_worker_id: OTHER };
  assert.equal(posterIsRecipient(unknown), false);
  assert.equal(payoutRecipientId(unknown), OTHER);
  assert.equal(isServiceAdvert(unknown), false);
});

test("listing type is matched case-insensitively", () => {
  assert.equal(isServiceAdvert({ listing_type: "service" }), true);
  assert.equal(canFundEscrow({ listing_type: "service" }), false);
  assert.equal(posterIsRecipient({ listing_type: "market", poster_id: POSTER, assigned_worker_id: OTHER }), true);
});

test("the reader is told to hire on an advert and to apply on a task", () => {
  assert.match(browserActionLabel(gig("SERVICE")), /request|hire/i);
  assert.match(browserActionLabel(gig("HUSTLE")), /apply/i);
  assert.match(browserActionLabel(gig("COMPANY_TASK")), /apply/i);
});

test("people who respond to an advert are enquiries, not applicants", () => {
  // Calling a prospective customer an applicant is what put a "Hire & pay"
  // button in front of the provider, aimed at the person meant to pay them.
  assert.match(responderNoun(gig("SERVICE"), 1), /enquiry/i);
  assert.match(responderNoun(gig("SERVICE"), 3), /enquiries/i);
  assert.match(responderNoun(gig("HUSTLE"), 1), /applicant/i);
  assert.match(responderNoun(gig("HUSTLE"), 3), /applicants/i);
});

test("no label ever renders a raw database enum", () => {
  for (const t of KNOWN_LISTING_TYPES) {
    const label = listingTypeLabel(gig(t));
    assert.notEqual(label, t, `${t} is being shown to users verbatim`);
    assert.doesNotMatch(label, /_/, `${label} still contains an underscore`);
    assert.notEqual(label, label.toUpperCase(), `${label} is shouting a column value`);
  }
});
