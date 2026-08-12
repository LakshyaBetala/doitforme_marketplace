import { NextResponse } from "next/server";
import { cashfreeHost } from "@/lib/cashfreeEnv";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Initialize Supabase Admin (Bypasses RLS to write to Escrow/Transactions)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // SECURITY (OWASP A01, broken access control):
    // This route previously took gigId and workerId straight from the request
    // body with no authentication at all. Because the settlement below writes
    // escrow and assigns the worker using those values, anyone who had made a
    // single real payment could replay their own order_id against a DIFFERENT
    // gig id and assign themselves as the funded worker on it.
    //
    // Now: the caller must be signed in, the order must belong to them, and the
    // gig/worker are read from the server-side transaction record. Nothing that
    // decides where money goes comes from the client any more.
    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: "Missing order id" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
    );
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Verify payment with Cashfree directly
    let validPayment: any = null;

    // The bypass below must require BOTH a non-production build and an explicit
    // opt-in flag. Keying it on NODE_ENV alone meant a single misconfigured
    // environment variable would make every payment succeed for free, with no
    // call to Cashfree at all. Fails safe: absent the flag, we always verify.
    const allowFakePayments =
      process.env.NODE_ENV === 'development' && process.env.ALLOW_FAKE_PAYMENTS === 'true';

    if (!allowFakePayments) {
      const CASHFREE_ENV = cashfreeHost();
      const response = await fetch(`https://${CASHFREE_ENV}.cashfree.com/pg/orders/${orderId}/payments`, {
        method: "GET",
        headers: {
          "x-client-id": process.env.CASHFREE_APP_ID!,
          "x-client-secret": process.env.CASHFREE_SECRET_KEY!,
          "x-api-version": "2023-08-01"
        }
      });

      const data = await response.json();

      validPayment = Array.isArray(data)
        ? data.find((p: any) => p.payment_status === "SUCCESS")
        : null;

      if (!validPayment) {
        console.error("Cashfree Payment Verification Failed:", data);
        return NextResponse.json({ error: "Payment pending or failed" }, { status: 400 });
      }
    } else {

      validPayment = {
        payment_status: "SUCCESS",
        payment_amount: 0,
        cf_payment_id: "fake_cf_payment_123"
      };
    }

    // 2. Idempotency — fetch the pending transaction created by /api/gig/hire
    const { data: txn } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("gateway_order_id", orderId)
      .single();

    if (!txn) {
      return NextResponse.json({ error: "Order record not found" }, { status: 404 });
    }

    // The order must belong to the caller. Without this, a signed-in user could
    // still settle somebody else's order.
    if (txn.user_id !== user.id) {
      console.error(`[verify-payment] user ${user.id} tried to settle order ${orderId} owned by ${txn.user_id}`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (txn.status === 'COMPLETED') {
      return NextResponse.json({ success: true, message: "Transaction already processed" });
    }

    // Authoritative identifiers — from our own record, never the request body.
    const gigId: string = txn.gig_id;
    const workerId: string | undefined = txn.provider_data?.breakdown?.recipient_id;
    if (!gigId || !workerId) {
      console.error(`[verify-payment] order ${orderId} missing gig/recipient on the txn record`);
      return NextResponse.json({ error: "Order record incomplete" }, { status: 409 });
    }

    // 2.5 Amount check — FAILS CLOSED.
    // Previously guarded by `cfAmount > 0`, so a missing or zero payment_amount
    // from Cashfree skipped verification entirely and funded escrow anyway.
    // A partial or zero payment must never mark a gig funded.
    if (!allowFakePayments) {
      const cfAmount = Number(validPayment?.payment_amount);
      const dbAmount = Number(txn.amount || 0);
      if (!Number.isFinite(cfAmount) || cfAmount <= 0 || Math.abs(cfAmount - dbAmount) > 1) {
        console.error(`[verify-payment] amount mismatch order=${orderId} cf=${validPayment?.payment_amount} db=${dbAmount}`);
        return NextResponse.json({ error: "Payment amount mismatch" }, { status: 400 });
      }
    }

    // 3. Extract fee breakdown saved by /api/gig/hire
    const breakdown = txn.provider_data?.breakdown || {};
    const basePrice    = breakdown.base_price    || 0;
    const deposit      = breakdown.deposit        || 0;
    const platformFee  = breakdown.platform_fee   || 0;
    const netWorkerPay = breakdown.net_worker_pay || 0;
    const gatewayFee   = breakdown.gateway_fee    || 0;
    const amountHeld   = basePrice + deposit;

    // 4. Claim the transaction ATOMICALLY.
    // The status check above is a read; the webhook can arrive between that read
    // and this write and both would settle. Filtering on status <> 'COMPLETED'
    // and requiring a returned row makes exactly one caller win the race.
    const { data: claimed, error: updateTxnError } = await supabaseAdmin
      .from("transactions")
      .update({
        status: 'COMPLETED',
        gateway_payment_id: validPayment.cf_payment_id,
      })
      .eq('id', txn.id)
      .neq('status', 'COMPLETED')
      .select('id');

    if (updateTxnError) {
      console.error("Transaction Update Error:", updateTxnError);
      return NextResponse.json({ error: "Could not record payment" }, { status: 500 });
    }
    if (!claimed || claimed.length === 0) {
      // Someone else (almost certainly the webhook) already settled this order.
      return NextResponse.json({ success: true, message: "Transaction already processed" });
    }

    // 5. Fetch gig title + poster_id for escrow and notifications
    const { data: gig } = await supabaseAdmin.from('gigs').select('title, poster_id, status, max_workers').eq('id', gigId).single();
    if (!gig) return NextResponse.json({ error: "Gig not found" }, { status: 404 });

    // If gig is already assigned (duplicate webhook / double-click), return success
    if (gig.status === 'assigned') {
      return NextResponse.json({ success: true, message: "Transaction already processed" });
    }

    // 6. Generate handshake code
    const handshakeCode = Math.floor(1000 + Math.random() * 9000).toString();

    // 7. Upsert escrow record — only use columns that exist in the schema
    const { error: escrowError } = await supabaseAdmin.from("escrow").upsert({
      gig_id: gigId,
      poster_id: gig.poster_id,
      worker_id: workerId,
      original_amount: basePrice,
      platform_fee: platformFee,
      gateway_fee: gatewayFee,
      amount_held: amountHeld,
      status: "HELD",
      // release_date is NOT NULL in schema, set 14 days out
      release_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      handshake_code: handshakeCode,
      escrow_category: deposit > 0 ? 'RENTAL_DEPOSIT' : 'GIG',
    }, { onConflict: 'gig_id,worker_id' });

    if (escrowError) {
      // NOT non-fatal. The escrow row IS the record that money is being held and
      // who it is owed to. Marking the gig ESCROW_FUNDED without it means the
      // payer has been charged, the worker is assigned, and nothing tracks the
      // liability — release and refund both key off this row. Stop here and
      // leave the gig unfunded so it can be retried, rather than silently
      // creating money we cannot account for.
      console.error(`CRITICAL: escrow upsert failed for gig ${gigId} order ${orderId}:`, escrowError.message);

      // Release the idempotency claim we took above, otherwise this order is
      // wedged forever: the retry (and the Cashfree webhook) would both see
      // status=COMPLETED and skip, leaving a paid order permanently unsettled.
      await supabaseAdmin
        .from("transactions")
        .update({ status: "PENDING" })
        .eq("id", txn.id);

      return NextResponse.json(
        { error: "Payment received but could not be recorded. Our team has been notified — do not pay again." },
        { status: 500 }
      );
    }

    // 8. Update applications FIRST to count them properly
    await supabaseAdmin
      .from("applications")
      .update({ status: "accepted" })
      .eq("gig_id", gigId)
      .eq("worker_id", workerId);

    // 9. Now count accepted applications and calculate total escrow
    const { count: acceptedCountResponse } = await supabaseAdmin
      .from("applications")
      .select("*", { count: 'exact', head: true })
      .eq("gig_id", gigId)
      .eq("status", "accepted");
      
    const acceptedCount = acceptedCountResponse || 1;
    const maxWorkers = gig.max_workers || 1;
    const isFull = acceptedCount >= maxWorkers;

    const { data: allEscrows } = await supabaseAdmin.from('escrow').select('amount_held, platform_fee, gateway_fee, original_amount').eq('gig_id', gigId);
    
    let totalAmountHeld = 0, totalPlatformFee = 0, totalGatewayFee = 0, totalOriginalAmount = 0;
    if (allEscrows) {
      allEscrows.forEach(e => {
         totalAmountHeld += Number(e.amount_held || 0);
         totalPlatformFee += Number(e.platform_fee || 0);
         totalGatewayFee += Number(e.gateway_fee || 0);
         totalOriginalAmount += Number(e.original_amount || 0);
      });
    }

    // 10. Update gig status with aggregated totals
    const gigUpdatePayload: any = {
      assigned_worker_id: workerId, // keeps backward compatibility for single-worker UI
      payment_status: "ESCROW_FUNDED",
      escrow_status: "HELD",
      escrow_amount: totalAmountHeld,
      escrow_locked_at: new Date().toISOString(),
      platform_fee: totalPlatformFee,
      net_worker_pay: totalOriginalAmount - totalPlatformFee,
      gateway_fee: totalGatewayFee,
    };

    if (isFull) {
      gigUpdatePayload.status = "assigned";
      
      // Reject remaining pending applications
      await supabaseAdmin
        .from("applications")
        .update({ status: "rejected" })
        .eq("gig_id", gigId)
        .eq("status", "applied");
    }

    const { error: gigUpdateError } = await supabaseAdmin.from("gigs").update(gigUpdatePayload).eq("id", gigId);

    if (gigUpdateError) {
      console.error("CRITICAL: Gig status update failed:", gigUpdateError.message);
      return NextResponse.json({ error: "Gig status update failed: " + gigUpdateError.message }, { status: 500 });
    }

    console.log(`✅ Gig ${gigId} successfully processed for worker ${workerId}. Full? ${isFull}`);

    // 10. Telegram + email notification to worker
    try {
      const { data: worker } = await supabaseAdmin
        .from('users')
        .select('telegram_chat_id, email, name')
        .eq('id', workerId)
        .single();

      if (worker?.telegram_chat_id) {
        const { sendTelegramAlert } = await import('@/lib/telegram');
        await sendTelegramAlert(
          worker.telegram_chat_id,
          `🎉 <b>You've been hired!</b>\nYour offer for <i>${gig.title}</i> was accepted and funds are secured in escrow.\n<a href="https://doitforme.in/gig/${gigId}">View Gig</a>`
        );
      }
      if (worker?.email) {
        const { sendEmail } = await import('@/lib/email');
        await sendEmail('application_accepted', {
          to: worker.email,
          recipientName: worker.name,
          gigTitle: gig.title,
          gigId,
          amount: basePrice,
        });
      }
    } catch (e) {
      console.error("Notification (verify-payment) failed:", e);
    }

    return NextResponse.json({ success: true, message: "Escrow funded and worker assigned successfully" });

  } catch (error: any) {
    console.error("Verification Error:", error);
    return NextResponse.json({ error: error.message || "Verification failed" }, { status: 500 });
  }
}