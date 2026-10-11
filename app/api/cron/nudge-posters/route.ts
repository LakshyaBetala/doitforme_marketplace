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

// Funded, assigned, nothing delivered. See STAGE 4.
const DELIVERY_OVERDUE_AFTER_DAYS = 3;
const DELIVERY_OVERDUE_REPEAT_DAYS = 4;
const DELIVERY_STUCK_ESCALATE_DAYS = 14;
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

  // EVERY STAGE IN HERE TELLS SOMEONE TO COME AND LOOK AT THE SITE.
  //
  // The cron routes stay reachable while the hold page is up, and for
  // auto-release that is the point: escrow must keep settling whatever the
  // front door says. This job is the opposite. It nudges, expires listings and
  // emails applicants, and every message it sends links to a page that is
  // currently answering 503. Sending "your application was closed, here is the
  // listing" to hundreds of students who then hit a hold page is worse than
  // sending nothing, and it burns the day's mail allowance doing it.
  //
  // It defers rather than skips: nothing here is time-critical, the ages only
  // grow, and the first run after the hold page lifts picks up the whole
  // backlog in age order.
  if (process.env.MAINTENANCE_MODE !== "off") {
    return NextResponse.json({
      success: true,
      skipped: "maintenance",
      note: "Hold page is up; every notification this job sends would link to a 503.",
    });
  }

  const now = Date.now();
  const nudgeCutoff = new Date(now - NUDGE_AFTER_HOURS * 3600e3).toISOString();
  const expireCutoff = new Date(now - EXPIRE_AFTER_DAYS * 86400e3).toISOString();

  const result = { nudged: 0, expired: 0, applicantsClosed: 0, errors: [] as string[] };

  try {
    // DRIVEN FROM THE APPLICATIONS, NOT FROM A SLICE OF GIGS.
    //
    // This used to ask for `gigs?status=eq.open&limit=200` with no ORDER BY, and
    // the comment said "the volumes here are small (tens of gigs)". They are
    // not: there are 983 open gigs and 463 of them hold a pending application.
    // An unordered LIMIT returns whatever the plan produces, and for a table
    // that is not changing underneath it that is the SAME 200 rows every run —
    // so the remainder was not merely delayed, it was unreachable on every run
    // forever. Measured on the live database:
    //
    //   463 gigs hold a pending application
    //   147 of them fell inside the 200 the cron could see
    //   316 never reached, stranding 849 applications
    //
    // Which makes the file's own opening claim false. It was written because
    // "silence — not rejection — is what was killing the applicant side", and it
    // was reaching under a third of the gigs causing that silence. ~53 of its
    // 200 slots were also spent on gigs with no applications at all.
    //
    // Driving from `applications` fixes both: the stale thing is the
    // application, so order by ITS age, oldest first. Nothing can be starved,
    // because anything not handled this run is still the oldest next run.
    const { data: staleApps, error: staleErr } = await supabase
      .from("applications")
      .select("gig_id")
      .in("status", ["pending", "applied"])
      .order("created_at", { ascending: true })
      .limit(600); // under PostgREST's 1,000-row ceiling, which silently truncates

    if (staleErr) return NextResponse.json({ error: staleErr.message }, { status: 500 });

    const candidateIds = [...new Set((staleApps || []).map((a) => a.gig_id))].slice(0, 200);

    const { data: gigs, error: gigErr } = candidateIds.length
      ? await supabase
          .from("gigs")
          .select("id, title, poster_id, listing_type, poster_nudged_at, applications(id, worker_id, status, created_at)")
          .eq("status", "open")
          .in("id", candidateIds)
      : { data: [], error: null };

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

    // ---- STAGE 3: the money is about to move on a timer ----
    //
    // Delivery emails the poster exactly once. After that the 24h clock runs in
    // silence and auto-release pays the worker — the poster's money moves on a
    // deadline they may never have been reminded of, and the first they hear of
    // it is the completion notice. That is how a "why was I charged" support
    // ticket becomes a chargeback.
    //
    // This cron is daily, and the review window is 24h, so every delivered gig
    // gets caught inside it. The notification row is the debounce.
    let releaseWarnings = 0;
    const { data: awaitingReview } = await supabase
      .from("gigs")
      .select("id, title, poster_id, auto_release_at")
      .in("status", ["delivered", "DELIVERED", "SUBMITTED"])
      .in("payment_status", ["HELD", "ESCROW_FUNDED"])
      .is("dispute_reason", null)
      .gt("auto_release_at", new Date().toISOString())
      .limit(BATCH);

    for (const gig of awaitingReview || []) {
      const { data: alreadyWarned } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", gig.poster_id)
        .eq("type", "auto_release_warning")
        .eq("link", `/gig/${gig.id}`)
        .maybeSingle();

      if (alreadyWarned) continue;

      const hoursLeft = Math.max(
        0,
        (new Date(gig.auto_release_at).getTime() - Date.now()) / 3_600_000
      );
      const window =
        hoursLeft <= 1 ? "within the hour" : `in about ${Math.round(hoursLeft)} hours`;

      await notify(
        gig.poster_id,
        {
          telegram: `<b>Your payment releases ${window}</b>\n<i>${gig.title}</i> was delivered and is waiting on you. Approve it, request changes, or raise a dispute.\n<a href="${SITE}/gig/${gig.id}">Review the work</a>`,
          email: {
            kind: "auto_release_warning",
            args: { gigTitle: gig.title, gigId: gig.id, extra: { hoursLeft } },
          },
        },
        {
          type: "auto_release_warning",
          content: `"${gig.title}" was delivered. The payment releases ${window} unless you respond.`,
          link: `/gig/${gig.id}`,
        }
      );
      releaseWarnings++;
    }

    // ---- STAGE 4: funded, assigned, and nothing has been delivered ----
    //
    // There is no timeout anywhere for this state, which is the one where money
    // is actually trapped. auto-release only scans status='DELIVERED', so a gig
    // that was paid for and never submitted sits at status='assigned' with
    // payment_status='ESCROW_FUNDED' forever, and the only exit is a dispute
    // that only the poster can open.
    //
    // STAGE 2 above looks like it covers this and does not: it skips a gig the
    // moment one message exists after the money landed, so it only ever reaches
    // the pair who never started. Measured live, 100% of funded-undelivered
    // gigs had such a message, so it was disabled for every one of them. The
    // case that mattered was ₹500 held for 35 days between a real company and a
    // real student who had exchanged 20 messages and then stopped.
    //
    // So this stage keys off AGE ALONE and ignores messages entirely. Talking is
    // not delivering.
    const overdueCutoff = new Date(now - DELIVERY_OVERDUE_AFTER_DAYS * 86400e3).toISOString();
    const repeatCutoff = new Date(now - DELIVERY_OVERDUE_REPEAT_DAYS * 86400e3).toISOString();
    const { data: overdue } = await supabase
      .from("gigs")
      .select("id, title, poster_id, assigned_worker_id, escrow_locked_at, escrow_stale_nudged_at")
      .eq("status", "assigned")
      .in("payment_status", ["HELD", "ESCROW_FUNDED"])
      .is("delivered_at", null)
      .not("assigned_worker_id", "is", null)
      .lt("escrow_locked_at", overdueCutoff)
      .or(`escrow_stale_nudged_at.is.null,escrow_stale_nudged_at.lt.${repeatCutoff}`)
      .limit(BATCH);

    let overdueNudges = 0;
    let escalated = 0;
    for (const gig of overdue || []) {
      const days = Math.floor((now - new Date(gig.escrow_locked_at).getTime()) / 86400e3);
      const link = `${SITE}/gig/${gig.id}`;

      await notify(
        gig.assigned_worker_id!,
        {
          telegram: `<b>Your work is ${days} days overdue</b>\nThe money for <i>${gig.title}</i> is held in escrow and cannot reach you until you submit.\n<a href="${link}">Submit your work</a>`,
          email: {
            kind: "delivery_overdue",
            args: { gigTitle: gig.title, gigId: gig.id, extra: { days, forWorker: "1" } },
          },
        },
        {
          type: "delivery_overdue",
          content: `"${gig.title}" was funded ${days} days ago and nothing has been submitted. The payment cannot reach you until you deliver.`,
          link: `/gig/${gig.id}`,
        }
      );

      await notify(
        gig.poster_id,
        {
          telegram: `<b>Nothing delivered after ${days} days</b>\nYour payment for <i>${gig.title}</i> is still held. You can chase it, or raise a dispute and we will review it.\n<a href="${link}">Open the gig</a>`,
          email: {
            kind: "delivery_overdue",
            args: { gigTitle: gig.title, gigId: gig.id, extra: { days } },
          },
        },
        {
          type: "delivery_overdue",
          content: `Nothing has been delivered on "${gig.title}" after ${days} days. Your money is still held — you can raise a dispute from the gig page.`,
          link: `/gig/${gig.id}`,
        }
      );

      // Past two weeks, nudging the same two people again is not going to work.
      // Tell an admin, because at that point someone has to decide, and until
      // now nothing in the system treated trapped money as abnormal.
      if (days >= DELIVERY_STUCK_ESCALATE_DAYS) {
        // Always logged, so it is visible in `wrangler tail` whether or not a
        // human channel is reachable. The first version of this read a
        // TELEGRAM_ADMIN_CHAT_ID that is set nowhere in this project, guarded by
        // `if (adminChat)` — which is precisely the silent no-op this stage
        // exists to replace.
        console.error(
          `[stuck-escrow] gig=${gig.id} days=${days} title="${gig.title}" — funded, assigned, undelivered; auto-release cannot fire`
        );
        // Admins get it through the same per-user Telegram link every other
        // alert in the product uses, so it needs no new configuration.
        try {
          const { ADMIN_EMAILS } = await import("@/lib/admins");
          const { data: admins } = await supabase
            .from("users")
            .select("telegram_chat_id")
            .in("email", ADMIN_EMAILS as unknown as string[])
            .not("telegram_chat_id", "is", null);
          if (admins?.length) {
            const { sendTelegramAlert } = await import("@/lib/telegram");
            for (const a of admins) {
              await sendTelegramAlert(
                a.telegram_chat_id!,
                `<b>Escrow stuck ${days} days</b>\n<i>${gig.title}</i> is funded, assigned and undelivered. Auto-release cannot fire on it, so it needs a decision.\n<a href="${link}">Open the gig</a>`
              );
            }
          }
        } catch (e) {
          console.error("nudge-posters: admin escalation failed:", e);
        }
        escalated++;
      }

      await supabase
        .from("gigs")
        .update({ escrow_stale_nudged_at: new Date().toISOString() })
        .eq("id", gig.id);
      overdueNudges++;
    }

    return NextResponse.json({
      success: true,
      ...result,
      pokedPairs,
      releaseWarnings,
      overdueNudges,
      escalated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("nudge-posters error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
