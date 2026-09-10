// The reference code in a server-error message has to actually reference
// something.
//
// A student wrote in blocked from signing up, quoting "ERR-857F". That code was
// Math.random(), so it matched nothing: not a log, not another report, not even
// a second occurrence of the same fault — which would have produced a different
// code every time. The message also said "We've been notified", and nothing was
// notified anywhere.
//
// These tests pin the properties that make a code worth quoting.

import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyError, friendlyError } from "../../lib/errors.ts";

const refFor = (e) => classifyError(e).ref;

test("the same fault always produces the same code", () => {
  // The whole point. Two students hitting one bug must quote one code.
  const a = refFor({ message: "Database error saving new user" });
  const b = refFor({ message: "Database error saving new user" });
  assert.equal(a, b);
  assert.match(a, /^ERR-[0-9A-F]{4}$/);
});

test("different faults produce different codes", () => {
  const a = refFor({ message: "Database error saving new user" });
  const b = refFor({ message: "Error sending confirmation email" });
  assert.notEqual(a, b, "two unrelated faults collided — the code says nothing");
});

test("codes ignore volatile digits so one bug is one code", () => {
  // Ids and timestamps inside a message must not split one fault into
  // thousands of distinct codes.
  const a = refFor({ message: "insert failed for row 918273645" });
  const b = refFor({ message: "insert failed for row 111222333" });
  assert.equal(a, b);
});

test("only server-side faults carry a code", () => {
  // A code on "wrong password" invites the user to report their own typo.
  const mine = classifyError({ message: "Invalid login credentials" });
  assert.equal(mine.side, "you");
  assert.equal(mine.ref, undefined);

  const ours = classifyError({ message: "something we have never seen" });
  assert.equal(ours.side, "us");
  assert.ok(ours.ref);
});

test("we no longer claim to have been notified", () => {
  // There is no error reporting pipeline. Saying otherwise tells a blocked user
  // to sit and wait for a fix that nobody knows is needed.
  const text = friendlyError({ message: "something we have never seen" });
  assert.doesNotMatch(text, /notified/i);
});

test("a network failure is not blamed on us, and carries no code", () => {
  const net = classifyError({ message: "Failed to fetch" });
  assert.equal(net.side, "network");
  assert.equal(net.ref, undefined);
});

test("known Postgres codes stay user-facing rather than becoming a mystery", () => {
  assert.equal(classifyError({ code: "23505", message: "dupe" }).side, "you");
  assert.equal(classifyError({ code: "42501", message: "denied" }).side, "you");
});
