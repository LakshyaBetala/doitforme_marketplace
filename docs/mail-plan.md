# Mail plan · Round 1 Sales, and everything after

How DoItForMe sends mail for the Inner Circle selection sprint without paying for
it, without landing in spam, and without spending the one email we promised
everyone else. Written 2026-10-29 against the live state: every number below
was read from production that night, not estimated.

For the Round 1 process itself read [`round1-sales-process.md`](./round1-sales-process.md);
for the system architecture, [`inner-circle-round1.md`](./inner-circle-round1.md).

---

## 1. The decision: three kinds of mail, three different rules

| | Who | How many | Through | Cost |
|---|---|---|---|---|
| **Round 1 invites** | Inner Circle opt-ins who chose *Bring the work in* or *Not sure yet* | **1,081** (188 + 893) | **Sender.net** campaign, mail-merged from the admin CSV | ₹0 |
| **The 24-hour portal mail** (reminders, received, expired, decisions) | Only candidates who clicked Start | ≤ 6 per starter | `lib/email.ts` → **Brevo** (or ZeptoMail, see §4) | ₹0, or ₹150 |
| **The reopen email** | Everyone on the waitlist | 2,207 | Sender.net, **only on the day the site reopens** | ₹0 |

Not in Round 1: the **242** who chose *Build the work*. They get the Tech round.
The invite route enforces this (`coalesce(inner_circle_role,'') <> 'TECH'`).

### Why not one provider for everything

- **Brevo's free tier is 300 emails per day, shared by every email the product
  sends** — KYC approvals, payment receipts, dispute notices and the Round 1
  reminders. Pushing 1,081 invites through it spends four days of that
  allowance, and a reminder that silently fails at "30 minutes left" is the
  worst mail this campaign can lose.
- **Sender.net's free tier is 2,500 subscribers and 15,000 emails a month with
  no daily cap.** It adds the one-click unsubscribe that Gmail and Yahoo now
  require of bulk mail. The invite letter has none, and the transactional API
  cannot add one.
- **Reminders cannot go through a campaign tool.** Each one is per-candidate,
  per-deadline and fired by the cron, so it has to stay on the transactional API.

### Why the 884 who never ticked the Inner Circle get nothing yet

The hold page they signed up on says, under the button: **"One email when we
reopen. Nothing else."** That sentence is the consent. A Round 1 pitch to them
spends their one email on something they did not ask for. Under India's DPDP
Act, consent is tied to the purpose it was given for. The Inner Circle box is a
different consent ("puts you in the next invite batch"), which is why the
1,081 can be invited and the 884 cannot.

---

## 2. Before the first send: blockers, in this order

Order matters. Run step 1 before step 2. With the secrets set but no tables,
every portal route gets past its own "unavailable" check and then fails on a
missing table, turning a clean 503 into a 500.

**1. Create the Round 1 tables in production D1** (live D1 has only `waitlist`):
```powershell
$env:CLOUDFLARE_API_TOKEN = Get-Content scratchpad\.cf-token
npx wrangler d1 execute doitforme-waitlist --remote --file=supabase/d1/inner_circle_round1.sql
npx wrangler d1 execute doitforme-waitlist --remote --file=supabase/d1/inner_circle_round1_events.sql
```

**2. Set the two portal secrets** (paste a fresh value when prompted):
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # run twice, one value each
npx wrangler secret put ROUND1_DOB_PEPPER
npx wrangler secret put ROUND1_SESSION_SECRET
```
> **Never rotate `ROUND1_DOB_PEPPER` once anyone has clicked Start, and keep a
> copy of it.** Every stored date-of-birth hash is computed with it; a new or
> lost pepper locks every started candidate out of both the return login and
> their invite link. Rotating the session secret is harmless — it just signs
> everyone out.

Check: `https://www.doitforme.in/api/inner-circle/round1/me` should change from
`503 Portal unavailable` to `401 Not signed in`.

**3. Fix the template sheet's header row.** The sheet candidates copy has 5
columns (`Company name, POC, Profile Link, Contact No., Mail Id`). The portal
dashboard tells them 10 columns, including the **one-line fit note**, which is
what the playbook says they are judged on. The invite page also tells them to
*"keep its column headers as they are."* A candidate who follows instructions
exactly therefore submits a sheet with no fit notes. Paste this as row 1:

```
Company name	Industry / what they do	Decision-maker name	Decision-maker role	LinkedIn URL	Email	Phone	Source	One-line fit note	City / HQ
```
(tab-separated, so it splits into 10 cells when pasted into A1)

**4. Repair the mail DNS** (dry run first, read the plan, then apply):
```powershell
node scripts/fix-mail-records.mjs
node scripts/fix-mail-records.mjs --apply
```
This takes `email.doitforme.in` off Cloudflare's proxy (it is still orange-cloud;
it resolves to Cloudflare IPs, which speak HTTP only), removes the 5 dead Google
MX records, and adds autodiscover.

**5. Set up Sender.net** — see §3.

**6. Rotate the three Cloudflare tokens that were pasted into chat**, then save
the new deploy token to `scratchpad/.cf-token`.

---

## 3. Sender.net: setup and the one thing not to do

1. Sign up (free; no card). **Settings → Domains → add `doitforme.in`.**
2. It gives you a **DKIM CNAME** (`sender._domainkey`) and possibly a
   bounce-domain CNAME. Add them in Cloudflare DNS as **DNS only (grey cloud)**,
   never proxied.
3. **Do not add Sender's SPF `include:` to the root SPF record.** SPF is at
   **9 of its 10 allowed DNS lookups**, counted recursively against live DNS
   (Google 1, Brevo 1, Titan 4, GoDaddy 3). One more nested include tips the
   domain into *permerror*, and then SPF fails for **all** mail, Brevo
   included. You don't need it: DMARC passes on an aligned DKIM signature
   alone, and that is exactly what step 2 sets up.
   - If Sender insists on a green SPF tick, first confirm nobody sends *as*
     `@doitforme.in` from Gmail, then free a slot with
     `node scripts/fix-dns.mjs --no-google --apply` (Google receives no mail
     here; GoDaddy's MX is priority 0).
4. Wait for **DKIM green** in Sender.
5. **Proof before sending:** send a test to a personal Gmail, open the message → ⋮
   → *Show original*. You want `SPF: PASS`, `DKIM: PASS (doitforme.in)`,
   `DMARC: PASS`. DMARC here is `p=quarantine`, so **an unaligned message goes
   straight to spam.** Do not send a single real invite until all three pass.

---

## 4. Sending Round 1, batch by batch

**The invite letter:** `npx tsx scripts/render-invite-for-merge.mjs` writes
`scratchpad/round1-invite-merge.html`, the exact production template rendered
with three placeholders: `[[NAME]]`, `[[INVITE_URL]]`, `[[SWITCH_TO_TECH_URL]]`.
Paste the HTML into Sender's code editor and replace each placeholder with
Sender's personalisation field for the matching CSV column.
Subject: *A letter from Mouriyan, about the Inner Circle and India.*

**The batching happens in Sender, not on the admin desk.** The desk has no
batch-size box: its buttons are fixed (*Dry run (preview 90)*, *Send 90*,
*Send 240*, *Generate all pending rows (no email)*), and *Download CSV ·
uninvited* exports every un-started row, not a slice. So generate everything
once and split it in the campaign tool, which is where segments belong anyway.

1. Admin desk → Inner Circle Round 1 → **Dry run (preview 90)**. This is only a
   sanity check that the query works and the addresses look right; the number it
   prints is 90, not your batch size.
2. **Generate all pending rows (no email)**. One click. It creates all 1,081
   candidate rows with their tokens and sends **nothing**. Idempotent: running it
   twice does not duplicate anyone.
3. **Download CSV · uninvited**. Columns: `email, name, phone, college, status,
   invite_url, switch_to_tech_url, invited_at_iso`.
4. **The first 188 rows are the Sales side.** The CSV has no role column, but
   the invite query orders *Bring the work in* before *Not sure yet* and the
   export orders by `invited_at ASC`, so the file comes out in sending order.
   Split it there: rows 1–188 are batch 1, the rest follow oldest-first.
5. Sender → Subscribers → Import each slice into its own group, named for the
   batch. Map `invite_url`, `switch_to_tech_url` and `name` to custom fields.
6. Send the campaign to one group at a time.
7. **Delete the CSV.** Each `invite_url` is a bearer link: whoever opens it first
   and types any date of birth takes the seat (see §6).

> Every row is created on day 0, so `campaign_closes_at` (invited_at + 7 days)
> is the same for everyone. A candidate mailed on day 5 still gets a full 24
> hours once they click Start, but they have less of the 7-day window to click
> it in. Keep the whole send inside the first two or three days.

**Pacing.** Invites don't touch Brevo, but every candidate who clicks Start
generates up to 6 portal emails over about 36 hours (4 reminders, which stop the
moment they submit, plus *received* or *expired*, and later a decision). On Brevo
free, keep new starts to roughly **50 a day**:

| Batch | Who | Size | When |
|---|---|---|---|
| 1 | Bring the work in | 188 | Day 0 — warmest, best reputation start |
| 2 | Not sure yet, oldest first | 200 | Day 1, after checking batch 1's numbers |
| 3–6 | Not sure yet | ~175/day | Days 2–5 |

Check before each batch: Sender's bounce rate **< 2%** and complaints **< 0.1%**,
and Brevo's daily count well under 300. If either looks wrong, **stop**. A
paused campaign recovers; a burned domain takes weeks.

**The ₹150 option.** If starts run above about 50/day, Brevo will start refusing
reminders, and the logs will say `DAILY SEND CAP REACHED`. ZeptoMail sells
**10,000 transactional emails for ₹150**, with credits valid for 6 months, no
daily cap and the best India deliverability. The code already supports it:
1. Sign up on **zoho.in**, not zoho.com. `lib/email.ts` posts to the India
   endpoint (`api.zeptomail.in`), and a zoho.com account's token is rejected
   there as if it were invalid. This is almost certainly why it "didn't work"
   before.
2. Verify the domain in ZeptoMail (DKIM plus bounce CNAME, grey cloud; again no
   root SPF include).
3. `npx wrangler secret put ZEPTOMAIL_TOKEN`, then add
   `"EMAIL_PROVIDER": "zeptomail"` to `vars` in `wrangler.jsonc` and redeploy.
   Without that line Brevo still wins, because auto-detect tries Brevo first.

---

## 5. The 24 hours, per candidate

| When | What happens | Mail |
|---|---|---|
| Invite opened | Letter → reads the brief → *I've read this* unlocks Start | — |
| Up to day 7 | Can start any time; invite link valid 7 days | — |
| **T** — clicks Start, enters DOB | 24h clock starts; DOB stored only as a SHA-256 hash | — |
| T + 12h | Reminder | "12 hours left" |
| T + 18h | Reminder | "6 hours left" |
| T + 21h | Reminder | "3 hours left" |
| T + 23½h | Reminder | "Last 30 minutes" |
| Submits (any time) | Reminders stop at once | "Received" |
| T + 24h, not submitted | Marked expired within 15 min; late submits refused (410) | "Window closed" |
| Within 7 days | Admin advances or rejects, with a written note | Decision |

Reminders and expiry run every 15 minutes from the cron Worker (`:05 :20 :35 :50`),
so a reminder can arrive up to 15 minutes after its mark. The deadline itself is
exact: the submit route checks the clock independently.

**Reminders link to the return login** (`/inner-circle/sales/round-1`, one
screen, email + DOB), not the invite page. A candidate who started on a laptop
and opens a reminder on their phone used to get the whole 6-screen letter and a
button labelled *Start my 24 hours* with their clock already running.

---

## 6. How it breaks, and what to do

| Failure | Impact | Mitigation |
|---|---|---|
| Invite forwarded **before** the candidate clicks Start | The stranger sets their own DOB and takes the seat; the real candidate is locked out | Delete the CSV after import. To reset one person you must also **change the token**, or the stranger's link still works: `npx wrangler d1 execute doitforme-waitlist --remote --command "UPDATE inner_circle_round1 SET status='invited', dob_hash=NULL, started_at=NULL, deadline_at=NULL, next_reminder_at=NULL, reminders_sent='[]', login_fail_count=0, login_fail_window_start=NULL, token=lower(hex(randomblob(24))) WHERE lower(email)=lower('person@x.com')"` then send them the new link: `https://doitforme.in/inner-circle/sales/round-1/<the new token>` |
| Someone types a candidate's email with wrong DOBs | 5 failures lock that email for 15 min | Their invite link still works (it does not go through the email lockout), and the lockout message now tells them so |
| Brevo hits 300/day | Reminders silently not sent | Pacing in §4, or switch to ZeptoMail |
| `ROUND1_DOB_PEPPER` rotated or lost mid-campaign | Everyone who has clicked Start is locked out of **both** doors: the return login and the invite link check the DOB against hashes made with the old pepper | Don't rotate it. **Keep a copy of the value somewhere safe** the day you set it; restoring it is the only fix |
| D1's 100k writes/day exhausted | Signups and Round 1 submissions fail until 00:00 UTC | The tracking endpoint now refuses anonymous writes and caps each candidate at 120/hour. Signups (`/api/waitlist`) are still unthrottled; a free Cloudflare rate-limiting rule on `POST /api/*` closes that |
| Candidate pastes the blank template, a Doc or a Form | Their round closes on nothing | The submit route now refuses non-Sheets links and the template's own ID, with a message saying exactly what to do |
| Sender DKIM not aligned | Every invite goes to spam (`p=quarantine`) | §3 step 5: prove all three PASS first |
| Sheet not shared with `doitforme.in@gmail.com` | Reviewer hits a permission wall; the playbook says reject | The dashboard says it in bold above the submit box. Consider a written note rather than a silent reject |

---

## 7. Rules we are working under

- **India, DPDP Act 2023** (Rules notified November 2025, most duties phase in
  over the following 18 months). Consent is specific to the purpose it was given
  for, withdrawing it must be as easy as giving it, and we only use what we
  said we would. Practically: the Inner Circle box covers the Round 1 invite
  and task mail; the waitlist alone covers one reopen email; and every
  campaign carries an unsubscribe link (Sender adds it).
- **Gmail and Yahoo bulk-sender rules (2024), and Outlook's (2025):** SPF, DKIM
  and DMARC aligned; one-click unsubscribe on marketing mail; spam complaints
  under 0.3%, aiming for under 0.1%. The DNS side is done (single SPF at 9/10,
  single DMARC, Brevo and Titan DKIM live). Sender's DKIM is the remaining
  piece.
- **Our own page.** "One email when we reopen. Nothing else." It is the
  strictest rule here and the one people will remember.

---

## 8. After Round 1

- **Tech round (the 242):** a separate cohort. The current table and portal are
  Sales-shaped (`cohort = 'sales-2026-10'`, the lead-list brief). It needs its own
  brief before any invite goes out.
- **The reopen email (all 2,207):** one Sender campaign on reopen day. Every
  Round 1 invitee is already a waitlist row, so importing all 2,207 adds only
  the ~1,126 not already on file — 2,207 total, inside the free tier's 2,500
  subscriber cap. No need to delete the Round 1 groups, but watch the cap if
  the waitlist keeps growing.
- **Supabase users active in September–October who are not on the waitlist:**
  they have accounts, so a service announcement is fair, but count them against
  the same 2,500 before importing.
