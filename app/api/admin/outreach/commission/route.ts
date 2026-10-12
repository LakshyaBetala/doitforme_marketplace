import { NextResponse } from "next/server";
import { requireAdmin, isGuardError } from "@/lib/adminGuard";
import { splitFor } from "@/lib/agency";

/**
 * Raising an outreach member's commission on a closed deal.
 *
 * WHY AN ADMIN DOES THIS AND NOT THE MEMBER. A commission is a statement that
 * money is owed. Letting the person owed it write the row is not a pipeline, it
 * is an invoice generator — which is why outreach_commissions is admin-write in
 * RLS and this route is the only way in.
 *
 * WHY TWO ROWS AND NOT ONE. 40% once the client's first payment clears, 60%
 * once they accept the finished work. A single payment on signature pays
 * identically for a dream client and a nightmare one, so the finder has no
 * reason to care whether the lead was any good. Splitting it is the cheapest
 * quality filter available, and it is also what stops a commission being owed
 * on a deal that collapses after the contract is signed.
 *
 * THE LINK HAS TO BE EXPLICIT. The end client never transacts on this platform
 * — Almmatix sells to them off-platform and only pays students here — so every
 * gig's company_id is Almmatix and nothing in the data can infer which lead
 * produced which project. `gig_id` on each tranche is that missing edge, and
 * without it /inner-circle/earnings has nothing to compute from.
 */

/** 40 / 60. Rounded to the rupee, with the final tranche absorbing the remainder. */
const FIRST_SHARE = 0.4;

export async function POST(req: Request) {
  try {
    // Identity before body: see lib/adminGuard.ts.
    const guard = await requireAdmin();
    if (isGuardError(guard)) return guard.error;
    const { service, email, userId } = guard;

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
    }

    const action = String(body.action ?? "raise");

    /* ---------------------------------------------------------------- */
    /* Attach the gig that actually pays a tranche                      */
    /* ---------------------------------------------------------------- */
    if (action === "link") {
      const commissionId = String(body.commissionId ?? "");
      const gigId = String(body.gigId ?? "");
      if (!commissionId || !gigId) {
        return NextResponse.json(
          { error: "commissionId and gigId are both required to link a payment." },
          { status: 400 },
        );
      }

      // Verify the gig exists before pointing a commission at it. A dangling
      // reference here reads in the member's earnings page as "Raised" when
      // nothing was raised, which is worse than showing nothing.
      const { data: gig, error: gigErr } = await service
        .from("gigs")
        .select("id, price, assigned_worker_id")
        .eq("id", gigId)
        .maybeSingle();
      if (gigErr) return NextResponse.json({ error: gigErr.message }, { status: 500 });
      if (!gig) return NextResponse.json({ error: "No gig with that id." }, { status: 404 });

      const { data: commission, error: cErr } = await service
        .from("outreach_commissions")
        .select("id, earner_id, amount")
        .eq("id", commissionId)
        .maybeSingle();
      if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
      if (!commission) {
        return NextResponse.json({ error: "No commission with that id." }, { status: 404 });
      }

      // Refuse an obvious mismatch rather than recording a payment to the wrong
      // person. The amount is allowed to differ — a negotiated deal happens —
      // but the recipient is not.
      if (gig.assigned_worker_id && gig.assigned_worker_id !== commission.earner_id) {
        return NextResponse.json(
          {
            error:
              "That gig is assigned to someone other than the person owed this commission. Check the gig before linking it.",
          },
          { status: 409 },
        );
      }

      const { error: upErr } = await service
        .from("outreach_commissions")
        .update({ gig_id: gigId })
        .eq("id", commissionId);
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

      return NextResponse.json({ success: true, commissionId, gigId });
    }

    /* ---------------------------------------------------------------- */
    /* Raise both tranches for a won lead                               */
    /* ---------------------------------------------------------------- */
    if (action !== "raise") {
      return NextResponse.json(
        { error: "action must be 'raise' or 'link'." },
        { status: 400 },
      );
    }

    const leadId = String(body.leadId ?? "");
    if (!leadId) {
      return NextResponse.json({ error: "leadId is required." }, { status: 400 });
    }

    const { data: lead, error: leadErr } = await service
      .from("outreach_leads")
      .select("id, company_name, owner_id, stage, won_value, service_key")
      .eq("id", leadId)
      .maybeSingle();
    if (leadErr) return NextResponse.json({ error: leadErr.message }, { status: 500 });
    if (!lead) return NextResponse.json({ error: "No lead with that id." }, { status: 404 });

    if (lead.stage !== "won") {
      return NextResponse.json(
        { error: `That lead is at '${lead.stage}'. Mark it won, with the value it closed at, first.` },
        { status: 409 },
      );
    }
    // The DB CHECK already guarantees this for rows written after the migration;
    // the explicit test gives the admin a sentence instead of a 23514.
    const dealValue = Number(lead.won_value ?? 0);
    if (!Number.isFinite(dealValue) || dealValue <= 0) {
      return NextResponse.json(
        { error: "That lead has no closed value. Set won_value before raising a commission." },
        { status: 409 },
      );
    }
    // An unowned lead has nobody to pay. This is the common case for leads
    // seeded from the waitlist, so the message says what to do about it.
    const earnerId = String(body.earnerId ?? lead.owner_id ?? "");
    if (!earnerId) {
      return NextResponse.json(
        { error: "Nobody owns that lead, so there is nobody to pay. Assign an owner or pass earnerId." },
        { status: 409 },
      );
    }

    // The share comes from the deal's own tier. It is 10% at every tier today,
    // on purpose — an outreach member must never have a reason to steer a client
    // toward the service that pays them best rather than the one they need — but
    // reading it from splitFor() means a future tier change cannot leave this
    // route quietly paying the old rate.
    const total = Math.round(dealValue * splitFor(dealValue).commission);
    const first = Math.round(total * FIRST_SHARE);
    // The final tranche takes the remainder so the two always sum to `total`
    // exactly. Rounding both independently loses or invents a rupee.
    const final = total - first;

    if (first <= 0 || final <= 0) {
      return NextResponse.json(
        { error: "That deal value is too small to split into two tranches." },
        { status: 400 },
      );
    }

    // ignoreDuplicates, so raising twice is a no-op rather than a second
    // payment: the unique index on (lead_id, tranche) is what makes this safe.
    const { error: insErr } = await service.from("outreach_commissions").upsert(
      [
        {
          lead_id: lead.id,
          earner_id: earnerId,
          tranche: "first",
          amount: first,
          note: String(body.note ?? "") || null,
          created_by: userId,
        },
        {
          lead_id: lead.id,
          earner_id: earnerId,
          tranche: "final",
          amount: final,
          note: String(body.note ?? "") || null,
          created_by: userId,
        },
      ],
      { onConflict: "lead_id,tranche", ignoreDuplicates: true },
    );

    if (insErr) {
      console.error("[admin/outreach/commission] insert failed:", insErr.message);
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    console.log(
      `[admin/outreach/commission] ${email} raised ${total} on ${lead.company_name} (${first}+${final})`,
    );

    return NextResponse.json({
      success: true,
      company: lead.company_name,
      dealValue,
      total,
      tranches: { first, final },
    });
  } catch (err) {
    console.error("[admin/outreach/commission] unexpected:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
