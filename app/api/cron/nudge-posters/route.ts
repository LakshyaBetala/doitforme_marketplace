import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Application black-hole fix.
//
// Measured 2026-08-12: 267 applications, 4 accepted (1.5%), and 143 of 168
// applicants (85%) had never received a single message. 145 applications sat
// with 8 posters who never replied to anything. Silence — not rejection — is
// what was killing the applicant side of the marketplace.
//
// Two stages, both driven by the age of the OLDEST unanswered application on a
// gig (not the gig's own age — a gig posted in May that got its first applicant
// yesterday is not abandoned):
//
//   NUDGE   at 24h — tell the poster people are waiting, and that the listing
//                    closes if they keep ignoring it. Debounced via
//                    gigs.poster_nudged_at so each gig nudges once.
//   EXPIRE  at 7d  — close the listing (status='expired'), mark the pending
//                    applications 'closed', and tell every applicant. Closure
//                    beats an open loop.
//
// Runs daily from vercel.json. Same x-cron-secret gate as auto-release.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const NUDGE_AFTER_HOURS = 24;
const EXPIRE_AFTER_DAYS = 7;
const BATCH = 50;

const SITE = "https://doitforme.in";

/** Fire-and-forget fan-out — a dead Telegram/Resend call must never abort the run. */
async function notify(
  userId: string,
  channels: { telegram?: string; email?: { kind: string; args: Record<string, unknown> } },
  inApp: { type: string; content: string; link: string }
) {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("telegram_chat_id, email, name")
      .eq("id", userId)
      .single();

    await supabase.from("notifications").insert({
      user_id: userId,
      type: inApp.type,
      content: inApp.content,
      link: inApp.link,
    });

    if (user?.telegram_chat_id && channels.telegram) {
      const { sendTelegramAlert } = await import("@/lib/telegram");
      await sendTelegramAlert(user.telegram_chat_id, channels.telegram);
    }

    if (user?.email && channels.email) {
      const { sendEmail } = await import("@/lib/email");
      await sendEmail(channels.email.kind as never, {
        to: user.email,
        recipientName: user.name,
        ...channels.email.args,
      } as never);
    }
  } catch (e) {
    console.error(`nudge-posters: notify(${userId}) failed:`, e);
  }
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");
  if (!secret || !provided || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized cron invocation" }, { status: 401 });
  }

  const now = Date.now();
  const nudgeCutoff = new Date(now - NUDGE_AFTER_HOURS * 3600e3).toISOString();
  const expireCutoff = new Date(now - EXPIRE_AFTER_DAYS * 86400e3).toISOString();

  const result = { nudged: 0, expired: 0, applicantsClosed: 0, errors: [] as string[] };

  try {
    // Open gigs that have at least one still-pending application. One query,
    // then group in memory — the volumes here are small (tens of gigs).
    const { data: gigs, error: gigErr } = await supabase
      .from("gigs")
      .select("id, title, poster_id, listing_type, poster_nudged_at, applications(id, worker_id, status, created_at)")
      .eq("status", "open")
      .limit(200);

    if (gigErr) return NextResponse.json({ error: gigErr.message }, { status: 500 });

    for (const gig of gigs || []) {
      const pending = (gig.applications || []).filter(
        (a: { status: string }) => a.status === "pending" || a.status === "applied"
      );
      if (pending.length === 0) continue;

      // A gig with an accepted application isn't abandoned, whatever else is pending.
      const hasAccepted = (gig.applications || []).some(
        (a: { status: string }) => a.status === "accepted"
      );
      if (hasAccepted) continue;

      const oldest = pending.reduce(
        (min: string, a: { created_at: string }) => (a.created_at < min ? a.created_at : min),
        pending[0].created_at as string
      );

      // COMPANY_TASK is never auto-expired — only nudged. Company listings are
      // internships/roles that legitimately stay open for weeks, and companies
      // are the scarce demand side of this marketplace. Auto-killing a paying
      // poster's listing to tidy up the feed is a bad trade.
      const expirable = gig.listing_type !== "COMPANY_TASK";

      // --- STAGE 2: expire ---
      if (expirable && oldest < expireCutoff) {
        if (result.expired >= BATCH) continue;

        const { error: expErr } = await supabase
          .from("gigs")
          .update({ status: "expired", expired_at: new Date().toISOString() })
          .eq("id", gig.id)
          .eq("status", "open"); // guard: don't stomp a gig that just got taken

        if (expErr) {
          result.errors.push(`expire ${gig.id}: ${expErr.message}`);
          continue;
        }
        result.expired++;

        await supabase
          .from("applications")
          .update({ status: "closed" })
          .eq("gig_id", gig.id)
          .in("status", ["pending", "applied"]);

        for (const app of pending) {
          result.applicantsClosed++;
          await notify(
            app.worker_id,
            {
              telegram: `<b>Listing closed</b>\nThe poster of <i>${gig.title}</i> never responded, so we closed it. You're not waiting on anything.\n<a href="${SITE}/feed">See active gigs</a>`,
              email: { kind: "application_closed", args: { gigTitle: gig.title, gigId: gig.id } },
            },
            {
              type: "application_closed",
              content: `"${gig.title}" was closed — the poster never responded.`,
              link: "/feed",
            }
          );
        }
        continue;
      }

      // --- STAGE 1: nudge ---
      if (oldest < nudgeCutoff && !gig.poster_nudged_at) {
        if (result.nudged >= BATCH) continue;

        const daysLeft = Math.max(
          1,
          Math.ceil((new Date(oldest).getTime() + EXPIRE_AFTER_DAYS * 86400e3 - now) / 86400e3)
        );

        const { error: nudgeErr } = await supabase
          .from("gigs")
          .update({ poster_nudged_at: new Date().toISOString() })
          .eq("id", gig.id);

        if (nudgeErr) {
          result.errors.push(`nudge ${gig.id}: ${nudgeErr.message}`);
          continue;
        }
        result.nudged++;

        // Only threaten closure on listings that actually get auto-closed.
        const closureLine = expirable
          ? `Pick someone, message them, or decline — silence closes the listing in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`
          : `Pick someone, message them, or decline — leaving people waiting is what makes them stop applying.`;

        await notify(
          gig.poster_id,
          {
            telegram: `<b>${pending.length} ${pending.length === 1 ? "person is" : "people are"} waiting on you</b>\n<i>${gig.title}</i> has unanswered applications.\n${closureLine}\n<a href="${SITE}/gig/${gig.id}">Review applicants</a>`,
            email: {
              kind: "poster_nudge",
              args: {
                gigTitle: gig.title,
                gigId: gig.id,
                extra: { pendingCount: pending.length, daysLeft: expirable ? daysLeft : 0 },
              },
            },
          },
          {
            type: "poster_nudge",
            content: `${pending.length} ${pending.length === 1 ? "person is" : "people are"} waiting on "${gig.title}". Pick someone before it closes.`,
            link: `/gig/${gig.id}`,
          }
        );
      }
    }

    // --- STAGE 3: post-hire silence ---
    //
    // The moment after hiring is where deals die quietly. Both sides get one
    // notification when the hire happens, and if either misses it the work
    // simply never starts — nobody is waiting on a screen, and neither knows
    // whether the other has seen anything.
    //
    // Folded into this cron rather than a fourth job because Vercel Hobby allows
    // one run per day per job and three are already scheduled.
    const silenceCutoff = new Date(now - 24 * 3600e3).toISOString();
    const { data: active } = await supabase
      .from("gigs")
      .select("id, title, poster_id, assigned_worker_id, escrow_locked_at, payment_status")
      .eq("status", "assigned")
      .in("payment_status", ["HELD", "ESCROW_FUNDED"])
      .not("assigned_worker_id", "is", null)
      .lt("escrow_locked_at", silenceCutoff)
      .limit(BATCH);

    let pokedPairs = 0;
    for (const gig of active || []) {
      // Has anyone said anything since the money landed?
      const { count: recentMsgs } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("gig_id", gig.id)
        .gt("created_at", gig.escrow_locked_at);

      if ((recentMsgs || 0) > 0) continue;

      pokedPairs++;
      const link = `${SITE}/chat/${gig.id}`;

      await notify(
        gig.assigned_worker_id!,
        {
          telegram: `<b>You've been hired and the money is already held</b>\n<i>${gig.title}</i> is waiting on you. Message the poster to get started.\n<a href="${link}">Open the chat</a>`,
          email: { kind: "hire_followup", args: { gigTitle: gig.title, gigId: gig.id } },
        },
        {
          type: "hire_followup",
          content: `You're hired for "${gig.title}" and the payment is secured. Say hello to get started.`,
          link: `/chat/${gig.id}`,
        }
      );

      await notify(
        gig.poster_id,
        {
          telegram: `<b>Your hire hasn't started yet</b>\nNobody has messaged on <i>${gig.title}</i> since you paid. A quick hello usually gets it moving.\n<a href="${link}">Open the chat</a>`,
          email: { kind: "hire_followup", args: { gigTitle: gig.title, gigId: gig.id } },
        },
        {
          type: "hire_followup",
          content: `No messages yet on "${gig.title}". Send a note so the work can start.`,
          link: `/chat/${gig.id}`,
        }
      );
    }

    return NextResponse.json({ success: true, ...result, pokedPairs });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("nudge-posters error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
