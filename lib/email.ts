// Single source of truth for transactional email via Resend.
// Free tier ceiling: 3000/month — every send is fire-and-forget and never
// fails the parent request. If RESEND_API_KEY is unset we log and no-op.

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const FROM = "doitforme <noreply@doitforme.in>";
const REPLY_TO = "doitforme.in@gmail.com";
const SITE = "https://doitforme.in";

type EmailKind =
  | "applied"
  | "new_applicant"
  | "application_accepted"
  | "application_rejected"
  | "hired_direct"
  | "work_delivered"
  | "auto_release_warning"
  | "payment_released"
  | "dispute_opened"
  | "company_approved"
  | "company_pro_activated"
  | "kyc_approved"
  | "kyc_rejected"
  | "new_gig_alert";

interface BaseArgs {
  to: string;
  recipientName?: string | null;
  gigTitle?: string | null;
  gigId?: string | null;
  amount?: number | null;
  proUntil?: string | null;
  extra?: Record<string, string | number | null | undefined>;
}

interface RenderResult {
  subject: string;
  preheader: string;
  bodyHtml: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function gigUrl(gigId?: string | null): string {
  return gigId ? `${SITE}/gig/${gigId}` : SITE;
}

// Per-category personalization for new-gig alerts. `short` drives the subject,
// `angle` is the one-line hook in the body that speaks to that field.
const CATEGORY_COPY: Record<string, { short: string; angle: string }> = {
  "Commerce & Finance": { short: "finance", angle: "real finance &amp; tax work that actually builds your CV — GST, compliance and live client exposure, not theory." },
  "Design & Creative": { short: "design", angle: "real client design work you can put straight into your portfolio." },
  "Academics & Gigs": { short: "academics", angle: "paid academic work — tutoring, projects and assignments in your subject." },
  "Tech & Engineering": { short: "tech", angle: "hands-on engineering work you can ship and show off." },
  "Writing & Content": { short: "writing", angle: "paid writing &amp; content work for real brands." },
  "Marketing & PR": { short: "marketing", angle: "real marketing, outreach and PR experience that counts." },
  "Science & Medical": { short: "science", angle: "research and science-focused gigs in your domain." },
  "Law & Humanities": { short: "law", angle: "law &amp; humanities work — research, drafting and more." },
  "Data & Research": { short: "data", angle: "data and research projects that pay." },
};
function categoryCopy(category?: string | null) {
  return (category && CATEGORY_COPY[category]) || { short: "", angle: "a fresh paid opportunity that fits you." };
}

function render(kind: EmailKind, args: BaseArgs): RenderResult {
  const name = escapeHtml(args.recipientName || "there");
  const title = escapeHtml(args.gigTitle || "your gig");
  const url = gigUrl(args.gigId);
  const rupees = args.amount != null ? `₹${args.amount}` : null;

  switch (kind) {
    case "applied":
      return {
        subject: `Application sent — ${args.gigTitle || "your gig"}`,
        preheader: "We've passed your pitch to the poster.",
        bodyHtml: `
          <p>Hi ${name},</p>
          <p>You have applied to <strong>${title}</strong>. Wait for the poster to take action, you can track your status here.</p>
          <p><a href="${url}" class="cta">Track Status</a></p>
          <p class="muted">Tip: keep all payment in escrow. Direct UPI = no protection.</p>
        `,
      };

    case "new_applicant":
      const applicantReviewUrl = `${SITE}/company/task/${args.gigId}`;
      return {
        subject: `New applicant on ${args.gigTitle || "your gig"}`,
        preheader: "Review the pitch and respond.",
        bodyHtml: `
          <p>Hi ${name},</p>
          <p>You have a new applicant on <strong>${title}</strong>.</p>
          <p><a href="${applicantReviewUrl}" class="cta">Review applicant</a></p>
        `,
      };

    case "application_accepted":
      return {
        subject: `You're hired — ${args.gigTitle || "gig accepted"}`,
        preheader: "The poster accepted your offer.",
        bodyHtml: `
          <p>Hi ${name},</p>
          <p>Your offer on <strong>${title}</strong> was accepted${rupees ? ` for <strong>${rupees}</strong>` : ""}. Funds are in escrow.</p>
          <p><a href="${url}" class="cta">Open the gig</a></p>
        `,
      };

    case "application_rejected":
      return {
        subject: `Update on ${args.gigTitle || "your application"}`,
        preheader: "Another applicant was chosen this time.",
        bodyHtml: `
          <p>Hi ${name},</p>
          <p>The poster of <strong>${title}</strong> picked someone else. Keep an eye on the feed — more gigs drop daily.</p>
          <p><a href="${SITE}/feed" class="cta">Browse new gigs</a></p>
        `,
      };

    case "hired_direct":
      return {
        subject: `You've been hired directly — ${args.gigTitle || "new gig"}`,
        preheader: "Payment is held in escrow.",
        bodyHtml: `
          <p>Hi ${name},</p>
          <p>You were hired directly for <strong>${title}</strong>${rupees ? ` (<strong>${rupees}</strong>)` : ""}. Funds are secured in escrow.</p>
          <p><a href="${url}" class="cta">Get started</a></p>
        `,
      };

    case "work_delivered":
      return {
        subject: `Work delivered — review ${args.gigTitle || "your gig"}`,
        preheader: "24-hour clock has started.",
        bodyHtml: `
          <p>Hi ${name},</p>
          <p>The worker marked <strong>${title}</strong> as delivered. Funds auto-release in <strong>24 hours</strong> unless you raise a dispute.</p>
          <p><a href="${url}" class="cta">Review & release</a></p>
        `,
      };

    case "auto_release_warning":
      return {
        subject: `Auto-release in 1 hour — ${args.gigTitle || "your gig"}`,
        preheader: "Last chance to dispute.",
        bodyHtml: `
          <p>Hi ${name},</p>
          <p>Escrow on <strong>${title}</strong> auto-releases to the worker in <strong>1 hour</strong>. If something is wrong, raise a dispute now.</p>
          <p><a href="${url}" class="cta">Review now</a></p>
        `,
      };

    case "payment_released":
      return {
        subject: `Payout queued — ${rupees || "your earnings"}`,
        preheader: "Funds released from escrow.",
        bodyHtml: `
          <p>Hi ${name},</p>
          <p>Escrow on <strong>${title}</strong> was released. ${rupees ? `Your net payout: <strong>${rupees}</strong>.` : ""} Payouts are processed manually within 24-48 hours.</p>
          <p><a href="${SITE}/payouts" class="cta">View payouts</a></p>
        `,
      };

    case "dispute_opened":
      return {
        subject: `Dispute opened on ${args.gigTitle || "your gig"}`,
        preheader: "An admin will review.",
        bodyHtml: `
          <p>Hi ${name},</p>
          <p>A dispute was raised on <strong>${title}</strong>. Funds are frozen until our team reviews — usually within 48 hours.</p>
          <p><a href="${url}" class="cta">Open dispute thread</a></p>
        `,
      };

    case "kyc_approved": {
      const institution = args.extra?.institution ? escapeHtml(String(args.extra.institution)) : null;
      return {
        subject: "You're a verified student on doitforme ✓",
        preheader: "Your student ID was approved.",
        bodyHtml: `
          <p>Hi ${name},</p>
          <p>Your student ID${institution ? ` from <strong>${institution}</strong>` : ""} has been <strong>verified</strong>. The verified badge is now live on your profile, and posters can see you're a real student.</p>
          <p><a href="${SITE}/feed" class="cta">Find your first gig</a></p>
        `,
      };
    }

    case "kyc_rejected": {
      const reason = args.extra?.reason ? escapeHtml(String(args.extra.reason)) : "We couldn't confirm this is a valid student ID.";
      return {
        subject: "Action needed — re-upload your student ID",
        preheader: "We couldn't verify your ID this time.",
        bodyHtml: `
          <p>Hi ${name},</p>
          <p>We couldn't verify the ID you uploaded. <strong>Reason:</strong> ${reason}</p>
          <p>Please upload a clear, well-lit photo of the front of your school, college, or university ID card — any institution works.</p>
          <p><a href="${SITE}/verify-id" class="cta">Re-upload ID</a></p>
        `,
      };
    }

    case "new_gig_alert": {
      const rawCategory = args.extra?.category ? String(args.extra.category) : null;
      const category = rawCategory ? escapeHtml(rawCategory) : null;
      const company = args.extra?.company ? escapeHtml(String(args.extra.company)) : null;
      const profileIncomplete = String(args.extra?.profileIncomplete || "") === "1";
      const { short, angle } = categoryCopy(rawCategory);
      const gt = args.gigTitle || "a new opportunity";

      // `match` = this recipient's relationship to the gig, set by the broadcast:
      //   interest → their declared interest IS this gig's category
      //   related  → they're into a related field we chose to include
      //   engaged  → otherwise active on the platform
      // Falls back from legacy `tier` so older callers still render sensibly.
      const match = String(
        args.extra?.match || (Number(args.extra?.tier || 3) === 1 ? "interest" : "engaged")
      );

      let reasonLine: string;
      let hook: string;
      let subject: string;
      if (match === "interest") {
        reasonLine = `Because you told us you're into <strong>${category || "this area"}</strong>, this one's a strong match.`;
        hook = angle;
        subject = short
          ? `New ${short} gig for you: ${gt}${rupees ? ` (${rupees})` : ""}`
          : `New paid gig for you: ${gt}${rupees ? ` (${rupees})` : ""}`;
      } else if (match === "related") {
        reasonLine = `It's not your usual field, but it's a paid gig you might be into — this one's open to students from any background.`;
        hook = "a chance to earn and pick up something new outside your usual area.";
        subject = `New paid gig you might like: ${gt}${rupees ? ` (${rupees})` : ""}`;
      } else {
        reasonLine = `A fresh paid opportunity from the doitforme board, picked for you.`;
        hook = angle;
        subject = `New paid gig: ${gt}${rupees ? ` — ${rupees}` : ""}`;
      }

      return {
        subject,
        preheader: `${company ? company + " just posted" : "A new gig just dropped"}${category ? ` in ${category}` : ""}. Be one of the first to apply.`,
        bodyHtml: `
          <p>Hi ${name},</p>
          <p>${reasonLine} It's ${hook}</p>
          <table role="presentation" width="100%" style="margin:8px 0 18px;border-collapse:separate;">
            <tr><td style="background:#f4f0fb;border:1px solid #e6dcfa;border-radius:12px;padding:16px 18px;">
              <div style="font-size:16px;font-weight:700;color:#111111;line-height:1.35;">${title}</div>
              ${rupees ? `<div style="font-size:15px;font-weight:700;color:#8825F5;margin-top:6px;">${rupees}</div>` : ""}
              ${category ? `<div style="font-size:12px;color:#666666;margin-top:4px;">${category}${company ? ` · ${company}` : ""}</div>` : ""}
            </td></tr>
          </table>
          <p><a href="${url}" class="cta">View &amp; apply</a></p>
          ${profileIncomplete
            ? `<p class="muted">Tip: posters pick workers with a complete profile first. <a href="${SITE}/profile">Finish your worker profile</a> (2 mins) to stand out.</p>`
            : `<p class="muted">All payments stay in escrow until the work is delivered — never share UPI directly.</p>`}
        `,
      };
    }

    case "company_approved":
      return {
        subject: "Your company is approved on doitforme",
        preheader: "You can now post gigs.",
        bodyHtml: `
          <p>Hi ${name},</p>
          <p>Welcome — your company account is verified. You can post your first gig now (free tier: 1 gig, up to 10 applicants).</p>
          <p><a href="${SITE}/company/post" class="cta">Post your first gig</a> &nbsp; <a href="${SITE}/pricing" class="muted-link">See Pro (₹299/mo)</a></p>
        `,
      };

    case "company_pro_activated": {
      const until = args.proUntil ? new Date(args.proUntil).toDateString() : "30 days from today";
      return {
        subject: "Pro activated — unlimited gigs unlocked",
        preheader: "Featured posts + unlimited applicants are live.",
        bodyHtml: `
          <p>Hi ${name},</p>
          <p>Pro is active until <strong>${escapeHtml(until)}</strong>. You get unlimited gigs, unlimited applicants, and a featured pin on every post.</p>
          <p><a href="${SITE}/company/dashboard" class="cta">Open dashboard</a></p>
        `,
      };
    }
  }
}

function wrap({ subject, preheader, bodyHtml }: RenderResult): string {
  const safePreheader = escapeHtml(preheader);
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subject)}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; padding:0; background:#f9f9fa; color:#111111; font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif; line-height:1.55; }
  .wrap { max-width:560px; margin:0 auto; padding:32px 24px; }
  .card { background:#ffffff; border:1px solid #eaeaea; border-radius:16px; padding:28px; }
  h1 { font-size:18px; letter-spacing:-0.01em; margin:0 0 18px; font-weight:600; color:#111111; }
  p { margin:0 0 14px; color:#333333; font-size:15px; }
  .muted { color:#888888; font-size:13px; }
  .muted-link { color:#888888; font-size:13px; text-decoration:underline; }
  .cta { display:inline-block; background:#8825F5; color:#ffffff !important; padding:11px 18px; border-radius:10px; text-decoration:none; font-weight:600; font-size:14px; margin-top:8px; }
  .foot { margin-top:22px; color:#888888; font-size:12px; text-align:center; }
  .preheader { display:none !important; visibility:hidden; opacity:0; height:0; width:0; overflow:hidden; }
  a { color:#8825F5; }

  @media (prefers-color-scheme: dark) {
    body { background:#0B0B11 !important; color:#fafafa !important; }
    .card { background:#13131A !important; border-color:rgba(255,255,255,0.08) !important; }
    h1 { color:#ffffff !important; }
    p { color:#fafafa !important; }
    .muted { color:rgba(255,255,255,0.62) !important; }
    .muted-link { color:rgba(255,255,255,0.62) !important; }
    a { color:#C9A9FF !important; }
    .cta { color:#ffffff !important; }
  }
</style></head>
<body>
<span class="preheader">${safePreheader}</span>
<div class="wrap">
  <div class="card">
    <h1>${escapeHtml(subject)}</h1>
    ${bodyHtml}
  </div>
  <p class="foot">doitforme.in · <a href="${SITE}/settings/notifications">Notification settings</a></p>
</div>
</body></html>`;
}

export async function sendEmail(kind: EmailKind, args: BaseArgs): Promise<{ ok: boolean; skipped?: string }> {
  if (!args.to) return { ok: false, skipped: "no recipient" };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY missing — would send ${kind} to ${args.to}`);
    return { ok: false, skipped: "RESEND_API_KEY missing" };
  }

  const rendered = render(kind, args);
  const html = wrap(rendered);

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [args.to],
        subject: rendered.subject,
        html,
        reply_to: REPLY_TO,
        headers: {
          "X-Entity-Ref-ID": `${kind}:${args.gigId || "none"}`,
        },
        tags: [{ name: "kind", value: kind }],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[email] ${kind} -> ${args.to} failed: ${res.status} ${text}`);
      return { ok: false, skipped: `resend ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error(`[email] ${kind} -> ${args.to} threw:`, e);
    return { ok: false, skipped: "exception" };
  }
}

export type { EmailKind, BaseArgs };
