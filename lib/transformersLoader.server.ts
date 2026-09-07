// Server-side stand-in for ./transformersLoader.ts — see that file for why.
//
// next.config.ts aliases the browser loader to this one when `isServer`, so the
// server bundle contains this module instead of a reference to
// @xenova/transformers. Nothing here can be reached in practice: the only
// caller is useModeration's loadModel(), which runs from a browser event
// handler (typing / focus), never during render. The throw is a tripwire, not a
// fallback — if it ever fires, something started calling the client moderation
// model during SSR and that needs fixing rather than catching.
//
// Server-side moderation is a different code path entirely: lib/moderation.ts
// runs regex only and deliberately fails open.

import type { TransformersModule } from "./transformersLoader";

export type { TransformersModule };

export async function loadTransformers(): Promise<TransformersModule> {
  throw new Error(
    "@xenova/transformers is browser-only. Server-side moderation goes through lib/moderation.ts."
  );
}
