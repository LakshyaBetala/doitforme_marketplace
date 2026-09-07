// Browser-side entry point to @xenova/transformers.
//
// This file exists to keep the bare specifier "@xenova/transformers" out of the
// SERVER module graph. Next compiles "use client" components for SSR as well as
// for the browser, so a plain `await import('@xenova/transformers')` inside
// useModeration.ts lands in the server bundle too — and from there it drags in
// onnxruntime-node's per-platform `.node` native binaries and @xenova's own
// copy of sharp. esbuild has no loader for `.node`, so the Cloudflare Worker
// build fails outright.
//
// The obvious fixes do not work:
//   - `serverExternalPackages` makes it a runtime `require`, which is fine on a
//     Node server with node_modules on disk but impossible in a Worker, so
//     OpenNext has to bundle it and hits the same binaries.
//   - `resolve.alias` to `false` loses: Next puts ~75 entries in
//     `config.externals`, and webpack resolves externals at `factorize`, BEFORE
//     alias resolution. The alias is never consulted.
//
// What does work is aliasing a LOCAL path. Externals only match bare
// node_modules specifiers, so a relative module is untouched by them: on the
// server, next.config.ts points this import at ./transformersLoader.server.ts,
// and the library never enters the graph at all.
//
// Keep the import below as the ONLY reference to @xenova/transformers in the
// codebase.

export type TransformersModule = {
  env?: { allowLocalModels: boolean; useBrowserCache: boolean };
  pipeline?: (task: string, model: string) => Promise<unknown>;
  default?: {
    env?: { allowLocalModels: boolean; useBrowserCache: boolean };
    pipeline?: (task: string, model: string) => Promise<unknown>;
  };
};

export async function loadTransformers(): Promise<TransformersModule> {
  return (await import("@xenova/transformers")) as unknown as TransformersModule;
}
