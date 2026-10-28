import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | null = null;

export function supabaseBrowser() {
  // Dev preview: fixtures instead of a backend, so the signed-in pages can be
  // looked at while Supabase is 402. See lib/devPreview.ts and the note on
  // devPreviewModule() below.
  if (process.env.NODE_ENV !== "production") {
    const preview = devPreviewModule();
    if (preview?.DEV_PREVIEW) {
      if (!client) client = preview.makePreviewClient() as ReturnType<typeof createBrowserClient>;
      return client;
    }
  }

  if (!client) {
    // Fail soft when Supabase env is missing. The hold page and the Round 1
    // portal are D1-backed and don't need Supabase, but RealtimeListener,
    // the landing page's optional sign-in greeting, and ~30 signed-in pages
    // are mounted/compiled across the same app — a construction-time throw
    // here crashes every one of them, including pages that don't touch
    // Supabase at all.
    //
    // Returning null changes the type and would force a null check in
    // every call site. Instead, construct against invalid placeholders:
    // `createBrowserClient` accepts them, and any subsequent network call
    // returns `{ data: { user: null }, error }`, which every caller
    // already handles as "logged out". Dev stays usable, production is
    // unaffected because env vars are set there.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
    const anon =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder.placeholder";
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL && typeof window !== "undefined") {
      console.warn("[supabaseBrowser] NEXT_PUBLIC_SUPABASE_URL missing — using placeholder, auth calls will return null user.");
    }
    client = createBrowserClient(url, anon);
  }
  return client;
}

/**
 * Load the dev-preview module only when this is not a production build.
 *
 * A plain top-level `import` kept lib/devPreview.ts in the production bundle
 * even though DEV_PREVIEW folds to a literal `false` there: the branch was dead,
 * but the module was still reachable from the import graph, so ~7.6KB of
 * fixtures shipped to both the client and the server. Not exploitable — the flag
 * is statically false — but it was dead weight on a 3MB Worker budget, and the
 * comment claiming it was tree-shaken was simply untrue.
 *
 * `process.env.NODE_ENV` is replaced with a literal at build time, so in a
 * production build the guard below is `if (false)` and webpack drops the
 * require() and everything it reaches.
 */
function devPreviewModule(): typeof import("./devPreview") | null {
  if (process.env.NODE_ENV === "production") return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./devPreview") as typeof import("./devPreview");
}
