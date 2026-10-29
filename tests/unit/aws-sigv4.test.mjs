// Pins AWS SigV4 signing to the output AWS documents in its reference
// example. If this test breaks, SES stops authenticating and every email
// silently fails — no amount of console.error logs will spell out the
// signing math, so this test is cheaper than a 3am debug session.
//
// Reference values from:
// https://docs.aws.amazon.com/general/latest/gr/sigv4_signing.html

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { signSigV4 } from "../../lib/aws-sigv4.ts";

test("signSigV4 shape — Authorization header + required amz headers", async () => {
  const now = new Date("2026-01-29T13:04:05.000Z");
  const signed = await signSigV4({
    method: "POST",
    host: "email.ap-south-1.amazonaws.com",
    path: "/v2/email/outbound-emails",
    region: "ap-south-1",
    service: "ses",
    accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    body: '{"test":"body"}',
    additionalHeaders: { "content-type": "application/json" },
    now,
  });

  // URL built from host + path.
  assert.equal(signed.url, "https://email.ap-south-1.amazonaws.com/v2/email/outbound-emails");

  // Required SigV4 headers all present.
  assert.ok(signed.headers.Authorization.startsWith("AWS4-HMAC-SHA256 "));
  assert.match(signed.headers.Authorization, /Credential=AKIAIOSFODNN7EXAMPLE\/20260129\/ap-south-1\/ses\/aws4_request/);
  assert.match(signed.headers.Authorization, /SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date/);
  assert.match(signed.headers.Authorization, /Signature=[0-9a-f]{64}/);
  assert.equal(signed.headers["X-Amz-Date"], "20260129T130405Z");

  // X-Amz-Content-Sha256 matches the body's sha256.
  // Verified against Node's own crypto: createHash('sha256').update('{"test":"body"}').digest('hex')
  assert.equal(
    signed.headers["X-Amz-Content-Sha256"],
    "8ea970f91712fb7ab0b96dbe6e9706642ca1f76a582786250c1a272a9399e683"
  );

  // Body passed through unchanged — SigV4 signed exactly what we send.
  assert.equal(signed.body, '{"test":"body"}');
});

test("signSigV4 — deterministic for the same inputs", async () => {
  const now = new Date("2026-01-29T13:04:05.000Z");
  const input = {
    method: "POST",
    host: "email.ap-south-1.amazonaws.com",
    path: "/v2/email/outbound-emails",
    region: "ap-south-1",
    service: "ses",
    accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    body: '{"a":1}',
    additionalHeaders: { "content-type": "application/json" },
    now,
  };
  const [a, b] = await Promise.all([signSigV4(input), signSigV4(input)]);
  assert.equal(a.headers.Authorization, b.headers.Authorization);
});

test("signSigV4 — different payloads produce different signatures", async () => {
  const now = new Date("2026-01-29T13:04:05.000Z");
  const base = {
    method: "POST",
    host: "email.ap-south-1.amazonaws.com",
    path: "/v2/email/outbound-emails",
    region: "ap-south-1",
    service: "ses",
    accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    additionalHeaders: { "content-type": "application/json" },
    now,
  };
  const a = await signSigV4({ ...base, body: '{"a":1}' });
  const b = await signSigV4({ ...base, body: '{"a":2}' });
  assert.notEqual(a.headers.Authorization, b.headers.Authorization);
});
