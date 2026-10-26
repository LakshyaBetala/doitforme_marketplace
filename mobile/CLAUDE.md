# CLAUDE.md (mobile app)

Read `README.md` in this folder first. It is the full handoff: what the app is, how it talks to
the backend through the cookie bridge, what is done, the open Supabase sign-up blocker, and the
next steps. Then read `AGENTS.md` for Expo SDK 58 rules (routes are in `app/`, not `src/app/`).
The website's own `../CLAUDE.md` explains the backend this app depends on.

Rules that matter most:
- Never ask for or use the Supabase service-role key. The anon key is public.
- Do not edit `shared/*.ts` by hand; edit the website original and run `node scripts/sync-shared.mjs`.
- Do not create real users or send real OTP emails against production without the owner's approval.
- Commits must be the committer's own: no Claude co-author or session lines.
