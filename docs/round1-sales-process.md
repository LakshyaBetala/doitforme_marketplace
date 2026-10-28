# Round 1 · Sales · the process

The business and operator view of the Round 1 selection sprint. For the
technical architecture read [`inner-circle-round1.md`](./inner-circle-round1.md);
for the deploy sequence read [`round1-email-setup.md`](./round1-email-setup.md).

## 1. What this is for

**Outcome we're hiring for:** a small bench of students who can source and
qualify B2B leads for a real AI/IT consultancy brief, well enough that we can
put them in front of a paying client inside two weeks.

The Inner Circle waitlist is 1,322 people. Round 1 Sales is the first cut.

**Why Sales first, before Tech:**
- The hold page let people tick two Inner Circle intents — Tech and Sales.
  Tech is the braggy pick; Sales is the one that moves money. Starting with
  Sales filters for people who understood the trade.
- The admin side of the business is a one-person operation right now. Sales
  work is reviewable in minutes per submission (a sheet of 30 rows). Tech
  briefs take hours per submission. One cohort at a time keeps the review
  honest.
- A validated Sales bench feeds the Tech bench — the first paid Tech brief
  needs a client, and clients come through the Sales bench.

## 2. The three rounds, at a glance

| | What candidate does | What we do | Duration |
|---|---|---|---|
| **Round 1** | Source 30 qualified B2B leads for the AI/IT consultancy brief, delivered as a Google Sheet | Review the sheet. Advance or reject with a written note. | 24 hours |
| **Round 2** | A **real-world task** — briefed only to Round 1 winners. Live situation, not a case study. | Review the output, same loop. | 24 hours |
| **Round 3** | A **30-minute conversation** with Mouriyan — the shape of what comes next inside the Inner Circle. | Decide. | ~30 min |

Three rounds compress what the usual "paid-trial contract review interview"
loop would spread over three weeks, without lowering the bar.

## 3. Round 1 brief, in full

**The task candidates see:**

> Find 30 Indian companies that could use an AI/IT consultancy.
>
> 1. Clone the template Google Sheet we share (link in the brief). Keep its
>    column headers as they are — we read every submission in the same shape.
> 2. Find 30 Indian companies that could use an AI/IT consultancy. LinkedIn
>    is the obvious primary source; use whatever tool gets you real
>    decision-makers.
> 3. Pull the decision-maker's name, role, email and phone where you can.
>    Apollo, ContactOut, Lusha, Hunter — pick your tool.
> 4. One line per row on **why this company is a fit**. That column is where
>    you actually stand out.
> 5. Share the sheet with `doitforme.in@gmail.com` (editor or viewer), then
>    paste the sheet URL in the submission box.

**Template sheet (operator reference):**
`https://docs.google.com/spreadsheets/d/1ILhCN7x1m1ZTQU4vwY7yFK4kOiPeI36jEyD85pyYfrs/edit?usp=sharing`

**What good looks like:**
- Companies are **real, not aspirational**: trading, hiring, posting in the
  last 90 days. "Reliance" is not a prospect; a 60-person logistics firm in
  Pune that just posted a software-engineer role is.
- Decision-makers are **individuals**: a name, a role, an email that resolves.
  "sales@company.com" is a disqualified row — that's a mailbox, not a person.
- The "why this is a fit" column is **specific**: it names what the company
  does and what the consultancy would plausibly solve. "Needs AI" fails.
  "Rolling out WMS v2 to 12 warehouses, currently integrated with Tally — a
  consultancy with Odoo-to-SAP experience fits" passes.
- The sheet is **shared** before submission. A submitted link that returns a
  permission wall is rejected on sight.

**What disqualifies a submission:**
- Fewer than 30 complete rows (we are generous on complete; we are not
  generous on count)
- Any row with a mailbox-style email, a `+91 XXXXX XXXXX` placeholder, or an
  "N/A" in a required field
- Visibly scraped from one of the public B2B lists that circulate on
  LinkedIn — the names and roles will be months out of date and will
  intersect with every other submission we see
- Three or more rows copy-pasted from a single company's team page without
  the "why" column actually being written

## 4. The 24-hour clock

The timer starts when the candidate clicks **Start** on the entry page, not
when the invite is sent. This is deliberate — most candidates open the
invite on a phone and come back to a laptop later. The clock-starts-on-start
rule means someone who waits 48 hours before beginning still gets 24 hours
to do the work, not 0.

**Reminder cadence after Start:**

| At | What fires | Why |
|---|---|---|
| **12 hours left** | Reminder email | First nudge, well before the panic window |
| **6 hours left** | Reminder email | Last chance to actually do the work tonight |
| **3 hours left** | Reminder email | Panic nudge |
| **30 minutes left** | Final reminder | Submit something, even if it's imperfect |
| **At expiry (24h)** | Status flips to `expired`, email sent | Clock ran out |

If a candidate submits before the clock runs out, no more reminders fire.
Everything is driven by `reminders_sent` as a bitfield on the row, so a
cron rerun never double-sends.

**No extensions, as a rule.** The 24-hour window is the test; moving it
undermines the entire selection signal. Exceptions have been made exactly
once (a documented family emergency) and required an email reply that said
so explicitly. Default answer is "the next cohort is in three weeks."

## 5. Candidate experience, end-to-end

The flow is designed so a candidate never needs to create an account, never
needs a password, and can always get back to their work-in-progress.

1. **Email arrives** in their inbox — a hand-written-feeling letter from
   Mouriyan with the giant animated SALES. word. One personalized link.
2. **Click the link** → lands on the entry page.
   `doitforme.in/inner-circle/sales/round-1/<token>`. Scroll through the
   SALES explainer, the pipeline, the brief. At the bottom: enter DOB,
   click Start.
3. **Dashboard** → the 24h countdown is live. Shows the brief again, the
   template sheet link, a submission box.
4. **Lose the tab?** Visit `doitforme.in/login/inner-circle-sales`. Email
   + DOB signs them back in. Timer carries on from where it was.
5. **Submit** → paste the sheet URL, click Submit. Status flips to
   `submitted`. "Got it" screen. We review within 48 hours.
6. **Decision email** → either "You're through to Round 2" or "Not this
   round, here's why." Both come with a written note Mouriyan wrote
   personally; the admin UI makes the note mandatory for exactly this
   reason.

**Switch to Tech option** — on the entry page and in a reminder email.
Candidates who ticked both Inner Circle intents can bail out of the Sales
sprint and hold their spot for the Tech cohort. One click, no DOB prompt,
no judgment. Keeps the Sales cohort honest (people who are actually here
for Sales) and keeps the Tech waitlist warm.

## 6. Operator playbook (Mouriyan)

### Before the campaign opens

1. **Confirm the brief is current.** The AI/IT consultancy named in the
   brief and the template Google Sheet are the two moving parts. If the
   consultancy has changed, update both.
2. **Confirm admin access works.** `doitforme.in/admin` → sign in →
   **IC · Sales R1** tab renders. If it doesn't, the first batch send
   will 403.
3. **Decide send mode.** Automated via `lib/email.ts` (needs a configured
   email provider) OR manual mail-merge via Gmail (download the CSV).
   For the first production campaign, manual Gmail send gives you
   per-recipient visibility and avoids provider warm-up issues.

### Opening day (T+0)

**If sending via Gmail (recommended for first run):**
1. In the admin tab, click **Generate all pending rows (no email)**. Creates
   the D1 row + per-candidate token for every uninvited waitlist entry.
   Doesn't send anything.
2. Click **Download CSV · uninvited**. Opens the file in Downloads.
3. Open the CSV in Google Sheets. Columns include `email`, `name`,
   `invite_url`, `switch_to_tech_url`.
4. Use Gmail's **mail-merge** (built-in in Google Workspace) OR the Yet
   Another Mail Merge add-on. Template body: the invite letter copy, with
   `{{invite_url}}` as the one personalized link.
5. Send in batches of ~100 to stay inside Gmail's hourly send cap. Mail
   merge auto-paces.

**If sending via ZeptoMail / Brevo (automated):**
1. **Dry run (preview 90)** — shows who would be sent to, no email fires.
2. **Send next batch (90)** — fires the real send, batched 90 at a time to
   stay inside Brevo's free-tier 300/day cap.
3. Repeat across days until the queue is empty.

### Each day of the campaign

Open `doitforme.in/admin` → **IC · Sales R1** tab. Three things to look at:

| | What it tells you |
|---|---|
| **Status counts** | `invited` dropping + `started` rising = the invite is landing. `started` rising but `submitted` flat = the brief is too hard or the deadline is too tight. |
| **Conversion funnel** | invited → opened → started → submitted → advanced. Each stage shows % drop from the previous. The two drops to watch: *opened → started* (if < 30%, the entry page isn't converting) and *started → submitted* (if < 50%, the brief is too hard). |
| **Submissions queue** | Rows at `submitted` with no decision yet. Each has an "Open submission" link that opens the candidate's Google Sheet in a new tab. |

**Reviewing a submission:**
1. Click **Open submission** → opens the Google Sheet.
2. Scan the 30 rows against the "what good looks like" criteria above.
3. Back in the admin tab, type a **decision note** — 1–3 sentences, specific.
   This becomes the body of the email they receive.
4. Click **Advance** or **Reject**. The decision note is mandatory and
   non-editable after it's sent, so write it like you mean it.

**Decision notes — tone:**
- **Advance:** name one specific thing that worked. "The 'why' column on
  rows 14–22 is exactly the specificity we're hiring for. Round 2 brief
  arrives Monday."
- **Reject:** one specific thing that didn't, no hedging. "Nine of 30 rows
  listed a company's generic sales@ mailbox as the contact. The point of
  the task was decision-maker outreach — that's the signal we were reading
  for." Reject letters are **better** when they're specific; vague
  rejections are what people screenshot.

### Expiry handling

A row that hits 24 hours without a submission flips to `expired` and gets
an email. That email is the only one in the campaign the admin can't
customize — it's auto-sent by the cron. The admin tab shows expired rows
in their own count; no action needed unless they email back asking for a
second chance (default answer: next cohort).

## 7. Judgment criteria, condensed

A submission is **Advance** if:
- 30 complete rows, every column filled
- Decision-makers are individuals with real emails that resolve
- The "why" column shows the candidate understood what an AI/IT consultancy
  actually sells
- The sheet opens on first click (shared correctly)

A submission is **Reject** if two or more of these are true:
- < 30 complete rows (hard rule — reject on count alone if < 25)
- Mailbox-style emails on 20%+ of rows
- "Why" column is generic ("needs AI", "could use automation") on 20%+ of rows
- Sheet needs a permission request to open
- Companies are visibly from a public B2B list (same 10 names everyone
  submits — Zomato, Swiggy, Flipkart, etc.)

A submission is **Hold for discussion** (not a code status — a mental
category) if:
- The count is right, the specificity is right, but the companies are
  wildly off-brief (e.g., all 30 are D2C consumer brands, none B2B). This
  is a judgment call; usually becomes Reject with a note explaining the
  misread, occasionally becomes Advance with a note calling it out.

## 8. Signals to watch at the campaign level

| Signal | Means | Action |
|---|---|---|
| Opened → Started < 30% | Entry page not converting | Review the brief copy. Something is scaring them off at the Start button. |
| Started → Submitted < 50% | Brief too hard, or 24h too tight | Note for next cohort. Do not extend this one. |
| Submitted → Advanced < 20% | Bar is too high OR brief is unclear | Re-read 10 random rejected submissions. If 5+ feel like misunderstandings of the task, the brief needs rewriting for next cohort. |
| Switch-to-Tech > 15% | Candidates self-selecting out of Sales | Good signal; means the cohort filter is working. Carry those names forward to the Tech cohort list. |

## 9. After Round 1 closes

- Mark the cohort closed in the admin tab (status filter → review all
  `invited` rows and either expire them or carry forward to a next cohort).
- Advance list becomes the Round 2 brief recipients. Round 2 brief is sent
  manually — no automated flow for it yet, because the brief changes per
  campaign and the volume is small (~20–40 people).
- Round 1 analytics (funnel conversion, time-to-start, time-to-submit)
  inform the Round 2 brief design.

---

## Appendix: the three doc files

| File | Purpose |
|---|---|
| [`inner-circle-round1.md`](./inner-circle-round1.md) | Technical architecture: schema, routes, auth, cron, security model |
| [`round1-email-setup.md`](./round1-email-setup.md) | Deploy playbook: secrets, D1 migrations, wrangler deploy order |
| **`round1-sales-process.md`** (this file) | Business + operator playbook: brief, timeline, judgment, run-the-campaign |
