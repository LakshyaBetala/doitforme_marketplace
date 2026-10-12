# How the agency runs

**[lib/operations.ts](../lib/operations.ts) is the source of truth, not this
file.** `PIPELINE` there holds every step, its one owner, its clock, the exit
condition and the database fact that proves it happened, and
[tests/unit/operations.test.mjs](../tests/unit/operations.test.mjs) enforces the
ordering — that nothing is built before the scope is signed, that the PM's
review SLA cannot outlast the escrow timer, that the commission tranches sum to
1. This page is the readable version. If the two disagree, the code is right.

Each role sees its own slice of this inside the app, under **Me → What you
own**, so nobody has to be told the process verbally.

## The spine

| # | Step | Owner | Clock | Proven by |
|---|---|---|---|---|
| 1 | Find the company | Outreach | — | `outreach_leads` row |
| 2 | Open the conversation | Outreach | 1d from lead created | `outreach_touches` row |
| 3 | Follow up | Outreach | 3d from last touch | `next_action_at` |
| 4 | Book the call, admin on it | Outreach | 3d from positive reply | `stage = 'meeting'` |
| 5 | Scope it and quote | **Admin** | 2d from meeting | quote sent |
| 6 | Get it signed | **Admin** | client's clock | `scope_signed_at` |
| 7 | Take the first payment | **Admin** | client's clock | `first_payment_at` |
| 8 | Hand it to a PM | **Admin** | 1d from payment | `pm_id` |
| 9 | Break into tasks and hire | **PM** | 2d from assignment | `project_tasks` with `gig_id` |
| 10 | Build | **Builder** | the task's own `due_on` | `gigs.delivered_at` |
| 11 | Review the delivery | **PM** | **1d from `delivered_at`** | approve / request changes |
| 12 | Integrate and test | **PM** | 3d from last approval | `integrated_at` |
| 13 | Client signs off | Client | 5d silence = accepted | `accepted_at` |
| 14 | Hand over, offer care | **PM** | 3d from acceptance | `handed_over_at`, `care_answer` |

Clocks are **working** days. The builders are students with classes, so a
Friday handover with a two-day SLA is not due on Sunday.

## The decisions worth arguing about

**The admin is on every first client call.** Not a formality. Scope, price and
timeline are agreed on that call, and an outreach member paid per close has
every incentive to agree to a scope somebody else has to build. The person
carrying the delivery risk has to be in the room. The admin also owns the quote
that follows — not the person who sold it.

**Nothing is built before the scope is signed.** Under Indian copyright law the
author owns the work unless it is assigned in writing. Build first and the
client has paid lakhs for software whose copyright sits with a student who
signed nothing, and Almmatix cannot give the IP warranty any serious client asks
for. The signed scope is also what makes a change request billable instead of
an argument.

**The PM's review SLA is 1 day because escrow auto-releases in 24h.** Those two
numbers are deliberately identical. A review SLA longer than the release timer
means money leaves before anybody looked at the work.

**A builder's deadline is `project_tasks.due_on`, never `gigs.auto_release_at`.**
The latter is an escrow timer and has never said anything about when work was
due. A frontend slot and a backend slot are not the same length, so there is no
single build clock.

**Builders are warned at 60% elapsed, not on the due date.** A warning that
arrives on the deadline is an obituary. At 60% the PM can still add a second
pair of hands, which is the only remedy that works.

**Two projects per PM, and the cap is published.** The PM does client contact,
integration, QA and a second developer's coding. Outreach paid per close will
find more than that, so a lead past the cap is **queued with its commission
locked to whoever found it** — nobody is punished for being good at their job.

**Commission is 40% on first payment, 60% on acceptance.** One payment on
signature pays identically for a dream client and a nightmare one, giving the
finder no reason to care whether the lead was any good. Weighting the larger
half on acceptance pays them for work that was delivered, not merely sold.

**Hiring goes through the real gig flow.** Escrow, delivery and
request-changes all apply. Probation taught us an imitation of the flow teaches
nobody how the flow works. Builders are picked on the `SCORECARD` and on
current load, which the app's **Team** tab shows: two live briefs is a stretch,
three is a missed deadline.

## What DoItForMe's 10% buys

The fee comes out of the **recipient's** payout, so Almmatix pays the gross and
the builder receives the net — which is why every quote carries both and the
product only ever shows net. A student told one number who receives a smaller
one has been misled however correct the arithmetic was.

It buys the thing a GitHub portfolio cannot fake: a dated, client-funded,
third-party-verified record that the work was delivered and paid for. That
record is the platform's moat and the student's strongest credential.

## Escrow is why this is a business and not a group chat

It converts every promise above into a fact:

- A builder never starts unfunded — the gig holds the money first.
- Delivery is a dated artefact, not a message saying it is done.
- Release needs the payer's approval, or 24h of silence after delivery.
- Changes go through request-changes, which **cancels** the release timer
  rather than pausing it.
- Money only comes back through an **admin-reviewed dispute**. There is
  deliberately no self-serve refund anywhere in the product.

## Growing the roster

`inner_circle_roles` is a registry with `status ∈ open | planned | closed`, and
the app's join screen renders open roles as applications and planned ones as
"opening next". `TECH` and `OUTREACH` are open; `QA` and `CAMPUS` are already
planned. Adding photography, design or office work is **one row**, no deploy:

```sql
insert into public.inner_circle_roles (value, label, tagline, blurb, status, seats, sort)
values ('PHOTO', 'Photography', 'You shoot it', '...', 'planned', null, 50);
```

Open it by moving `status` to `open` when there is real work to give — a role
advertised with nothing behind it is the one that costs you credibility.
