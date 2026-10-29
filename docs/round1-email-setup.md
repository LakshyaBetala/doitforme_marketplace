# Sending the Round 1 campaign from `support@doitforme.in`

End-to-end setup for the Inner Circle · Sales · Round 1 email blast. Takes ~20 min, all steps are free, and nothing here touches your personal Gmail's sending reputation.

## The architecture, in one sentence

```
support@doitforme.in           ↓ sends via ZeptoMail (free)
   ↑ branded sender
   ↑ domain SPF+DKIM verified at GoDaddy DNS

Replies from candidates  ──→  support@doitforme.in inbox (your GoDaddy mailbox)
```

No Gmail SMTP, no bulk send from your personal account, no DMARC rejection. Open rates and click rates arrive in the ZeptoMail dashboard automatically.

## Why not just send from the Gmail

Three hard blockers, any one of which kills it:

1. **Gmail's TOS**. `@gmail.com` personal accounts can't send bulk/promotional mail. A batch of 600 identical invites is textbook bulk. Account suspension is the standard outcome.
2. **Gmail's own DMARC**. Sending `From: ...@gmail.com` through any server that isn't Google's is rejected or spam-foldered by other inboxes — including other Gmail users. Not optional, not configurable.
3. **Workers can't do SMTP**. Our hosting (Cloudflare Workers) blocks outbound TCP to port 587/465. Gmail only exposes SMTP.

ZeptoMail sidesteps all three.

## Step 1 — ZeptoMail account (5 min)

1. Go to `https://www.zoho.com/zeptomail/`
2. Click **Sign up for free**. Use any email (your personal Gmail is fine for the account itself).
3. Verify the account via the email they send.
4. In the ZeptoMail dashboard, pick the free plan. You get **10,000 one-time credits** — no card, no expiry. The whole Round 1 campaign uses ~3,100 of them.

## Step 2 — Verify `doitforme.in` as a sending domain (10 min)

1. Left sidebar → **Mail Agents** → **Add a Mail Agent** → name it `doitforme-round1`.
2. Under the mail agent, go to **Setup** → **Domain Settings** → **Add Domain** → enter `doitforme.in`.
3. ZeptoMail shows you three DNS records to add:
   - **SPF (TXT)** — host: `@` (or blank), value starts with `v=spf1 include:zoho.in ~all` (or similar; copy exactly from their screen).
   - **DKIM (TXT)** — host like `zmail._domainkey`, value is a long `k=rsa; p=...` string. Copy it entire.
   - **Domain verification (TXT)** — host: `@`, value: `zoho-verification=zb########.zmverify.zoho.com`.
4. Open a new tab → `https://account.godaddy.com/` → **My Products** → `doitforme.in` → **DNS**.
5. In GoDaddy DNS:
   - **Add → TXT**. Paste the SPF record. Save.
   - **Add → TXT**. Paste the DKIM record (host = `zmail._domainkey`). Save.
   - **Add → TXT**. Paste the verification record. Save.
6. Back in ZeptoMail → **Verify**. First attempt may fail — DNS can take 2–10 min to propagate. Retry until all three go green.

> **Note on the SPF record**: if your domain already has an SPF record (one `v=spf1 ...` TXT), **do not add a second one** — DNS allows only one SPF per domain and two will break both. Merge instead: edit the existing one to include ZeptoMail's `include:zoho.in` fragment.

## Step 3 — Verify `support@doitforme.in` as a sender (2 min)

1. ZeptoMail sidebar → **Setup** → **Email Address** → **Add Address** → enter `support@doitforme.in`.
2. ZeptoMail sends a verification email to `support@doitforme.in`. Go to your GoDaddy webmail at `https://email.godaddy.com/` (or wherever you read `support@doitforme.in`) and click the verification link.
3. The address shows **Verified** in ZeptoMail.

## Step 4 — API token (1 min)

1. ZeptoMail sidebar → **Setup** → **Mail Agents** → `doitforme-round1` → **Setup Info**.
2. Click **Send Mail Token** → **Generate Token** → scope **Send Mail** only. Give it a name like `round1-campaign`.
3. **Copy the token immediately** — ZeptoMail only shows it once. It looks like `Zoho-enczapikey wSsVR...` (long base64-ish string). Save it somewhere safe for the next step.

## Step 5 — Wire it into the Worker (3 min)

```bash
# From the repo root. You'll be prompted to paste the token — paste the FULL
# string including the "Zoho-enczapikey " prefix, exactly as ZeptoMail showed it.
npx wrangler secret put ZEPTOMAIL_TOKEN

# These are already in wrangler.jsonc vars — just confirm they look right.
grep -A1 "FROM_EMAIL\|REPLY_TO" wrangler.jsonc
```

Expected output of the grep:
```
"FROM_EMAIL": "support@doitforme.in",
"FROM_NAME": "DoItForMe · Inner Circle",
"REPLY_TO": "support@doitforme.in",
```

**The auto-detect does NOT prefer ZeptoMail.** `AUTO_ORDER` in `lib/email.ts` is
`["brevo", "zeptomail", "resend", "ses"]`, and the Worker already has `BREVO_API_KEY`
set — so Brevo wins and a perfectly valid ZeptoMail token is simply never used.
This is the usual reason "we added the token and nothing changed".

Adding the token is therefore NOT the whole switch. Pin the provider too, in
`wrangler.jsonc` vars:

```jsonc
"EMAIL_PROVIDER": "zeptomail",
```

`activeEmailProvider()` honours that and falls back with a warning if the key is
missing, so it is safe to set before the token exists.

**If the token is rejected, check the datacentre before blaming the token.**
`lib/email.ts` posts to `https://api.zeptomail.in/v1.1/email` — the INDIA
endpoint. A ZeptoMail account created on `zoho.com` lives in the US datacentre
and rejects its own token at `.in`, which reads as an invalid key. Accounts made
on `zoho.in` are correct as-is; for a `.com` account change that URL to
`api.zeptomail.com`.

## Step 6 — The two Round 1 secrets (1 min)

Needed by the portal for the DOB-login flow. Generate random values:

```bash
# 32 random bytes each, printed as hex you can paste.
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npx wrangler secret put ROUND1_DOB_PEPPER
# paste the first value above

node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npx wrangler secret put ROUND1_SESSION_SECRET
# paste the second value above
```

## Step 7 — Apply D1 migrations (1 min)

```bash
# The candidate table
npx wrangler d1 execute doitforme-waitlist --remote \
  --file=supabase/d1/inner_circle_round1.sql

# The event-tracking table (portal clicks, page views for the admin funnel)
npx wrangler d1 execute doitforme-waitlist --remote \
  --file=supabase/d1/inner_circle_round1_events.sql
```

## Step 8 — Deploy (3 min)

```bash
# Main app Worker — carries the portal, admin tab, API routes
npx wrangler deploy

# Cron Worker — carries the reminder + expiry schedule
npx wrangler deploy --config workers/cron/wrangler.jsonc
```

## Step 9 — Send yourself one test (30 seconds)

Before firing at 607 people, send one to yourself:

```bash
# Pull the token out of your local .env.local for this one-off script, OR
# set it inline here. The script writes HTML previews to scratchpad/ and
# then calls sendEmail() just like the admin batch route does.
ZEPTOMAIL_TOKEN=$(cat ~/zeptomail-token.txt) \
FROM_EMAIL=support@doitforme.in \
REPLY_TO=support@doitforme.in \
node scripts/preview-round1-emails.mjs --send=gandhimouriyan1234@gmail.com
```

Within 1 min the invite lands in your inbox from `support@doitforme.in`. Click the link, enter a DOB on the portal, run through the task flow, and verify the dashboard shows the countdown.

## Step 10 — Live blast (one click)

1. Sign in to `https://www.doitforme.in/admin` as `doitforme.in@gmail.com` (or any admin from `lib/admins.ts`).
2. Click **IC · Sales R1** tab.
3. Click **Dry run (preview 90)** — shows "would invite 90" + sample emails.
4. Click **Send next batch (90)** — fires 90 real invites. Repeat ~7 times across the day/next few days until the queue is empty. (ZeptoMail free rate limit is well above our pace.)

The admin tab's **Conversion funnel** section fills in as candidates open the invite, read the brief, click Start, and submit. Everything is cohort-tagged, so starting a Round 2 later reuses the same table with a new `cohort` value.

## Troubleshooting

**"Domain verification pending" won't go green after 15 min.**
Open a terminal: `dig TXT doitforme.in` and `dig TXT zmail._domainkey.doitforme.in`. If the records aren't there, re-save them in GoDaddy. If they are, ZeptoMail will catch up eventually — their verification worker runs every ~5 min.

**Test email never arrives.**
Check the Worker log: `npx wrangler tail`. A `429` from ZeptoMail means the daily cap tripped; a `403` means the sender address isn't verified yet. The admin tab's "Send next batch" result line names the error too.

**"TOO_MANY_RECIPIENTS" from ZeptoMail.**
Their free plan sends one recipient per API call (fine for us — the batch route loops one at a time anyway). This error means the body somehow accumulated two addresses; look at `app/api/admin/inner-circle-round1/invite/route.ts`.

**Switching providers later.**
Install the key for Brevo (`BREVO_API_KEY`), Resend (`RESEND_API_KEY`), or Amazon SES (see below); set `EMAIL_PROVIDER` in `wrangler.jsonc` vars to force one. `lib/email.ts` auto-detects — no code change needed.

## Appendix — Amazon SES

Cheapest and most reliable at scale, but **slower to set up** than the other three because AWS puts fresh accounts in sandbox mode. Plan on 24–48 hours lead time before first live send.

### 1. Verify the sender domain in SES

1. Sign in to the AWS Console → **Simple Email Service** → **Verified identities** → **Create identity**.
2. Pick **Domain**, enter `doitforme.in`, enable **Easy DKIM** (RSA 2048). AWS gives you three CNAME records.
3. Paste all three CNAMEs into GoDaddy DNS exactly as shown (no trailing dots, no quotes). Also add an SPF TXT if you don't have one: `v=spf1 include:amazonses.com ~all`.
4. SES polls DNS every ~5 min. Status flips to **Verified** once propagation lands.

### 2. Request production access (removes sandbox)

Mandatory — in sandbox you can only send to pre-verified test addresses. The 1,322-candidate campaign will silently fail every send until you leave sandbox.

1. SES Console → **Account dashboard** → **Request production access**.
2. Pick **Transactional**, describe the use case (student selection campaign for Round 1 of DoItForMe Inner Circle, estimated 7,500 emails/month peak, bounce/complaint handling via SES default notifications to your SNS topic or email).
3. Submit. Approval takes 24–48 hours on average; sometimes 2 hours, occasionally 72.

### 3. Create an IAM user with SES send permission

1. AWS Console → **IAM** → **Users** → **Create user** → name: `doitforme-ses-sender`.
2. **Attach policies directly** → create a new policy with just `ses:SendEmail` and `ses:SendRawEmail` on `*`. Nothing else — this key will live in a Worker, not on your laptop.
3. After create, open the user → **Security credentials** → **Create access key** → **Application running outside AWS**.
4. Save both the Access Key ID and Secret Access Key immediately — the secret is only shown once.

### 4. Wire into the Worker

```bash
npx wrangler secret put AWS_SES_ACCESS_KEY_ID        # paste the access key ID
npx wrangler secret put AWS_SES_SECRET_ACCESS_KEY    # paste the secret
```

Add to `wrangler.jsonc` vars (non-secret):
```jsonc
"AWS_SES_REGION": "ap-south-1",
"EMAIL_PROVIDER": "ses",
```

`ap-south-1` is Mumbai — best inbox placement for Indian recipients. If you're sending primarily to a different region, switch (`us-east-1`, `eu-west-1`, etc.).

### 5. Test send

Once the domain is verified AND production access is approved:

```bash
# Admin tab → Dry run first, then Send next batch (90).
# The first batch is the real test. If AWS still has you in sandbox, every send
# comes back with 400 "Email address is not verified" — that's the one error
# message that tells you the sandbox step wasn't actually complete.
```

### SES vs the alternatives — pick based on timing

| | Setup time | Cost per 1k | Daily cap |
|---|---|---|---|
| **Brevo** | 15 min | ₹0 up to 9k/mo | 300/day |
| **ZeptoMail** | 20 min | ₹0 for first 10k, then paid | high |
| **Resend** | 10 min | ₹0 up to 3k/mo | 100/day |
| **Amazon SES** | 24–48h (sandbox lift) | ~₹8 ($0.10) | 50k/day fresh accounts |

If the campaign ships this week → Brevo or ZeptoMail. If it ships in >48h → SES is cheapest at scale.
