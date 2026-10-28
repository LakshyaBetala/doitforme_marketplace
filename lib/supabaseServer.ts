import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function supabaseServer() {
  const cookieStore = await cookies(); // Required for Next.js 15+

  const real = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // ignore
          }
        },
      },
    }
  );

  // See the note in supabaseBrowser.ts. This one matters most for
  // WorkspaceLayout, which is a server component — its auth.getUser() is the
  // call that currently sends every workspace route to /login.
  //
  // The cast is `typeof real`, not `ReturnType<typeof createServerClient>`:
  // createServerClient is generic, so ReturnType resolves the parameter to its
  // constraint and hands back a looser client that cannot take type arguments —
  // which quietly broke `.maybeSingle<PublicUser>()` in app/u/[username].
  // Deriving the type from the real call site keeps the signature identical.
  if (process.env.NODE_ENV !== "production") {
    const preview = devPreviewModule();
    if (preview?.DEV_PREVIEW) return preview.makePreviewClient() as typeof real;
  }

  return real;
}

// Alias for backward-compatible import in dashboard/layout.tsx
export const createServer = supabaseServer;

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
