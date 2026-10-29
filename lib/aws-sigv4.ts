// Minimal AWS Signature Version 4 signer, native crypto only.
//
// Used by lib/email.ts to call the SES V2 API from the Cloudflare Worker
// without pulling in the AWS SDK (which doesn't tree-shake and would push
// us past the 3 MB Worker budget — see CLAUDE.md on the Xenova trap).
//
// Only the HTTP-request flavour (not S3 presigned URLs or STS) is here, and
// only what SES actually needs: POST with a JSON body, no query parameters.
// If you need more surface area, read the AWS doc for SigV4 before extending
// — the canonical-request format is finicky and silent on the wrong path.

export interface SignedRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export interface SigV4Input {
  method: "POST" | "GET" | "PUT" | "DELETE";
  host: string;              // e.g. "email.ap-south-1.amazonaws.com"
  path: string;              // e.g. "/v2/email/outbound-emails" — must start with /
  region: string;            // e.g. "ap-south-1"
  service: string;           // e.g. "ses"
  accessKeyId: string;
  secretAccessKey: string;
  body: string;              // JSON-stringified payload (or "" for GET)
  additionalHeaders?: Record<string, string>;
  now?: Date;                // injectable for tests
}

/** HMAC-SHA256(key, data) → raw bytes. */
async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

async function sha256Hex(data: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** YYYYMMDD'T'HHMMSS'Z' → the X-Amz-Date header format. */
function amzDate(d: Date): { amzDate: string; dateStamp: string } {
  const iso = d.toISOString(); // 2026-01-29T13:04:05.000Z
  const amz = iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return { amzDate: amz, dateStamp: amz.slice(0, 8) };
}

/**
 * Signs an HTTP request with AWS SigV4 and returns the full {url, headers, body}
 * ready for fetch(). Deterministic given a fixed `now` (tests pass a frozen Date).
 */
export async function signSigV4(input: SigV4Input): Promise<SignedRequest> {
  const now = input.now ?? new Date();
  const { amzDate: timestamp, dateStamp } = amzDate(now);
  const payloadHash = await sha256Hex(input.body);

  // Headers that will be signed. Host and x-amz-date are required; everything
  // in additionalHeaders is signed too so the Authorization header covers them.
  const headers: Record<string, string> = {
    host: input.host,
    "x-amz-date": timestamp,
    "x-amz-content-sha256": payloadHash,
    ...Object.fromEntries(
      Object.entries(input.additionalHeaders || {}).map(([k, v]) => [k.toLowerCase(), v])
    ),
  };

  const sortedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaderNames.map((h) => `${h}:${headers[h].trim()}\n`).join("");
  const signedHeaders = sortedHeaderNames.join(";");

  // Canonical request. SigV4 is sensitive to trailing newlines and header
  // ordering — do not reformat this block.
  const canonicalRequest = [
    input.method,
    input.path,
    "",                      // canonical query string (empty — SES uses POST body)
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    timestamp,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  // Derive signing key through the four-step HMAC chain. The initial "AWS4" +
  // secret bit is the one easy to miss — it's what makes the key date-scoped.
  const kDate = await hmac(new TextEncoder().encode("AWS4" + input.secretAccessKey), dateStamp);
  const kRegion = await hmac(kDate, input.region);
  const kService = await hmac(kRegion, input.service);
  const kSigning = await hmac(kService, "aws4_request");
  const signature = toHex(await hmac(kSigning, stringToSign));

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    url: `https://${input.host}${input.path}`,
    headers: {
      ...input.additionalHeaders,
      Host: input.host,
      "X-Amz-Date": timestamp,
      "X-Amz-Content-Sha256": payloadHash,
      Authorization: authorization,
    },
    body: input.body,
  };
}
