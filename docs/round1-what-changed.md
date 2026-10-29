# Round 1 Sales — what happened, what changed, what's left

**29 October 2026.** An overnight record of taking the Inner Circle Round 1 Sales
pipeline from a feature branch to a live, tested deployment. It covers what was
found, what was changed relative to the original Round 1 branch, and what still
has to happen before the first invite goes out.

Read alongside [`round1-sales-process.md`](./round1-sales-process.md) (the
playbook), [`inner-circle-round1.md`](./inner-circle-round1.md) (architecture)
and [`mail-plan.md`](./mail-plan.md) (sending).

---

## 1. What happened

**The live site was built from neither line of work.** Two branches had
diverged: `main` held the Round 1 Sales pipeline (merged from
`inner-circle-round1-sales`), and `cloudflare-migration` held 28 other
commits — the operating model, the `/app` surface, agency pricing, the HLD,
the Android build and the mail-DNS scripts. The deployed Worker predated both,
so sending the campaign would have pointed 1,081 people at pages that were not
live. Those 28 commits also existed only on one laptop; they were pushed to
GitHub before anything else was touched.

**Unified onto one trunk.** `main`, the Round 1 playbook commit that had never
been merged (`360fe5c`), and `cloudflare-migration` were merged into one branch,
which became `main`. Three conflicts were resolved as unions, because in each
case both sides were adding to the same list (the maintenance allowlist, the
email reply-to, a test regex).

**Deliberately not merged:** `feat/mobile-app` (the Expo app the interns are
building, with its own UI) and `ui-ux-final`, which turned out to be wholly
contained inside the app branch. Four branches from February to April had
nothing that was not already on the trunk.

**Deployed, and the first live check failed.** After deploy, the Round 1 portal
answered `307 → /login`. The two branches were each correct alone and wrong
together: one protected `/inner-circle` for the member workspace, the other put
the portal under `/inner-circle/sales/round-1` with its own login, and
candidates have no account to log in with. The build was green and 182 tests
passed. Fixed, covered by a new test, redeployed and confirmed live.

**Audited as a candidate would use it** — on a phone and on desktop, against a
local copy of production with seeded candidates, then against the live
database with read-only audits. Every fix in §2 came from something observed,
not assumed.

**Reviewed adversarially before the final deploy** — see §4.

---

## 2. What changed versus the original Round 1 Sales branch

Base: `inner-circle-round1-sales` at `360fe5c`. Everything below is on `main`.

### People can actually see that Round 1 is live

| Before | Now |
|---|---|
| Not on the landing page at all, where most visitors arrive | A solid purple **"Inner Circle · Round 1 — Sales is live"** card is the first thing in the landing-page hero, above the headline |
| On the hold page, inside the purple Inner Circle panel, in lavender on purple with a translucent button — it read as part of the panel (contrast ~2.2:1 to ~2.9:1) | The same card, above the form. White on solid purple (5.8:1) and a solid white button that nothing else on either page uses |
| On a phone the entry sat **2.06 screens down**, below the submit button of the person ticking the Inner Circle box | On the first screen of a phone |

Both pages render one shared component (`components/Round1LiveBanner.tsx`), so
they cannot drift. Its "Not invited yet? Put your hand up" link goes to the
waitlist form, because the portal is a return login that cannot help someone
without an invite.

### Everyone who needs to get in, can

- **Admins could not sign in to run the campaign.** `/admin` was open during
  the hold, but it redirects to `/login`, which was not. On any device without
  a live session, no invite could be sent. `/login` and the Google sign-in
  callback now work during the hold.
- **Candidates were bounced to a login they cannot pass** (the merge bug above).
  The middleware's path lists now live in `lib/routeGuards.ts` with an explicit
  exemption for surfaces that have their own login, and a test that pins every
  path that matters.
- A bare `/auth` entry would also have opened `/auth-transfer`, which installs a
  session from tokens in the URL. The entry is `/auth/`, and the test pins
  `/auth-transfer` as held.

### The selection measures what it says it measures

- **The Tech people no longer receive the Sales task.** The invite route took
  the oldest Inner Circle opt-ins regardless of side. It now excludes the 242
  who chose *Build the work*, and sends *Bring the work in* (188) before
  *Not sure yet* (893). Proven against the live database.
- **A Google Doc, or our own blank template, no longer counts as a finished
  round.** The link check looked at the host only. It now requires a
  spreadsheet, and refuses the template's own ID with a message telling the
  candidate exactly what to do.

### The candidate never hits a dead end

- **Reminders go to the one-screen return login**, not the six-screen invite
  letter that ends in *Start my 24 hours*. That letter is the wrong page for
  someone whose clock is already running, especially on a second device.
- **"Already started? Sign in to your task"** on the invite page, for anyone
  reopening their invite on another device.
- **Any candidate with a result goes to their dashboard.** Expired, advanced or
  rejected candidates used to be shown the letter and a Start button instead.
- **The lockout message names the way back in** (the invite link) rather than
  only saying "try again later".
- **"Add someone else" no longer carries over the Inner Circle opt-in.** It
  used to leave the box ticked, putting the next person forward on someone
  else's say-so.

### Copy that was wrong

- The invite page's numbers were stale **and** swapped ("607 submitted
  interest", "1,300+ on the waitlist"; live: 1,323 and 2,207). "One of 1,300"
  now reads the live count.
- "The portal keeps your draft here" — nothing was stored. The copy now says
  the work lives in their own Google Sheet.
- The hold page said selection was "still being built" two inches from
  "Sales is live", and the panel said "Arriving with the relaunch".
- "Reply to Mouriyan on this email", printed on a web page.

### Security and reliability

- **The tracking endpoint could take the campaign down.** It accepted
  unauthenticated writes against D1's 100,000-a-day allowance, the same
  allowance signups and submissions use. It now drops anonymous events (the
  admin funnel ignored them anyway) and caps each candidate at 120 an hour.
- **Every email was pulling a 912 KB logo** to display it at 40 pixels. It now
  uses the 37 KB app icon (same mark).
- The merge's reply-to fallback pointed at a founder's personal Gmail; it is
  `support@doitforme.in`.

### Smaller UI fixes

Footer contrast on the hold page (3.78:1 → 7.29:1); 44 px tap target on the
template button; an instruction styled as a dead button; birthday autofill on
both date-of-birth fields; the earnings page restored inside the member shell
after the merge moved it out.

### Tooling and documents

- `docs/mail-plan.md` — which mail goes through which provider and why, the
  pre-send blockers in order, pacing, the 24-hour timeline, failure modes,
  consent.
- `scripts/render-invite-for-merge.mjs` — renders the real invite letter with
  merge placeholders for Sender.net, so the campaign copy cannot drift from the
  code.
- `CLAUDE.md` — current Worker headroom, the route-list trap, the five crons.

---

## 3. What was verified, and how

| What | How | Result |
|---|---|---|
| Unit tests | `npm run test:unit` | 190 / 190 |
| Worker size | `wrangler deploy --dry-run` | 2329.62 KiB of 3072 KiB (75.8%) |
| Full candidate journey | Browser, local copy of production, seeded D1 | Claim → 24h timer → submit → return login → lockout → switch to Tech, all correct |
| The 24-hour machine | Ran the reminder cron against seeded rows, twice | 12h reminder sent, next one scheduled exactly 6h before the deadline; overdue candidate expired; second run sent nothing |
| Submission rules | Hostile inputs through the real API | Doc, Form, template, `http://`, lookalike hosts, `javascript:` all refused; a real copy accepted |
| Login | Wrong DOB, unknown email, 6 attempts | Unknown email and wrong DOB are indistinguishable; 6th attempt locked |
| Database constraints the money path relies on | `npm run db:audit` (read-only, live) | 8 / 8 |
| What a stranger can read | `npm run db:anon-audit` (read-only, live) | 49 / 49, nothing private |
| Live site | `scratchpad/live-verify.mjs`, 51 explicit checks | see §4 |

---

## 4. Pre-deploy review

**Not finished — stopped at the session limit.** A five-lens adversarial review
(routing/auth, Round 1 backend, UI/React, regressions, docs-truth; three
skeptics per finding) had completed 51 of 53 agents. Its results are cached;
resume it rather than re-running:

```
Workflow({ scriptPath: "C:\\Users\\laksh\\.claude\\projects\\c--Users-laksh-doitforme1\\7f244d3f-bba9-48dc-8a66-257caf1ba8f1\\workflows\\scripts\\review-tonights-deploy-wf_a6c7812e-e37.js", resumeFromRunId: "wf_a6c7812e-e37" })
```

**Production is still on `79ebe76`** (the portal fix). Nothing after it is
deployed. Next session, in order: finish the review → fix what survives →
clean build (`BUILD EXIT: 0`) → look at the Round 1 card on `/` and
`/maintenance` at 390px and 1440px → deploy → run
`scratchpad/live-verify.mjs` (expect 51/51; it was 43/51 before deploy, the 8
failures being exactly the changes waiting to ship) → push.

---

## 5. What is left

### Before the first invite — only you can do these

All in [`mail-plan.md`](./mail-plan.md) §2, with exact commands. Until 1 and 2
are done, the portal pages load but every Round 1 action answers "unavailable".

1. **Create the two Round 1 tables in production D1.** First — with the secrets
   set and no tables, the portal fails with errors instead of "unavailable".
2. **Set `ROUND1_DOB_PEPPER` and `ROUND1_SESSION_SECRET`.** Keep a copy of the
   pepper: if it is lost or rotated, every candidate who has started is locked
   out of both the return login and their invite link.
3. **Replace the template sheet's header row.** It has 5 columns; the dashboard
   asks for 10, including the one-line fit note candidates are judged on. The
   exact row is in the mail plan.
4. **Repair the mail DNS** (`node scripts/fix-mail-records.mjs --apply`):
   `email.doitforme.in` is still behind Cloudflare's proxy, and five dead Google
   MX records remain.
5. **Set up Sender.net** with its DKIM record — and do not add its SPF include;
   the domain is at 9 of 10 SPF lookups.
6. **Rotate the three Cloudflare tokens** that were pasted into chat.

### Decisions for you

- **The phone number in the site's structured data.** `+91 93441 10272` is in
  the JSON-LD on every page, deliberately, for the payment aggregator's website
  check. Search engines can show JSON-LD phone numbers in results. It was left
  as is; removing it is a one-line change if that trade is wrong.
- **ZeptoMail for reminders (₹150 for 10,000).** Free Brevo works if new starts
  stay around 50 a day; above that, reminders start being skipped.
- **Unsubmitted sheets that aren't shared.** The playbook rejects them on sight;
  a written note may be kinder for a first round.

### Later

- The Tech round needs its own brief before the 242 can be invited.
- The reopen email to all 2,207 — once, on reopen day.
- Supabase storage is at roughly 73% of the free 1 GB; the move to R2 is still
  open.
- Signups (`POST /api/waitlist`) are not rate-limited; a free Cloudflare
  rate-limiting rule would close that.
- Eight lint errors in the Round 1 pages predate tonight (two are React
  Compiler warnings about state set inside effects); they were left alone
  rather than changed blind.
