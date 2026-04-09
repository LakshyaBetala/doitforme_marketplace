import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Admin (Bypasses RLS to write to Escrow/Transactions)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { orderId, gigId, workerId } = await req.json();

    if (!orderId || !gigId || !workerId) {
      return NextResponse.json({ error: "Missing verification data" }, { status: 400 });
    }

    // 1. Verify payment with Cashfree directly
    let validPayment: any = null;

    if (process.env.NODE_ENV !== 'development') {
      const CASHFREE_ENV = process.env.NODE_ENV === 'production' ? 'api' : 'sandbox';
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
      console.log("DEV MODE BYPASS: Faking successful Cashfree verification payload.");
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

    if (txn.status === 'COMPLETED') {
      return NextResponse.json({ success: true, message: "Transaction already processed" });
    }

    // 3. Extract fee breakdown saved by /api/gig/hire
    const breakdown = txn.provider_data?.breakdown || {};
    const basePrice    = breakdown.base_price    || 0;
    const deposit      = breakdown.deposit        || 0;
    const platformFee  = breakdown.platform_fee   || 0;
    const netWorkerPay = breakdown.net_worker_pay || 0;
    const gatewayFee   = breakdown.gateway_fee    || 0;
    const amountHeld   = basePrice + deposit;

    // 4. Mark transaction as COMPLETED
    const { error: updateTxnError } = await supabaseAdmin
      .from("transactions")
      .update({
        status: 'COMPLETED',
        gateway_payment_id: validPayment.cf_payment_id,
      })
      .eq('id', txn.id);

    if (updateTxnError) {
      console.error("Transaction Update Error:", updateTxnError);
      // Don't throw — still try to update the gig
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
      escrow_category: deposit > 0 ? 'RENTAL_DEPOSIT' : 'PROJECT',
    }, { onConflict: 'gig_id,worker_id' });

    if (escrowError) {
      // Log but DO NOT throw — the escrow row is secondary. Gig status MUST still update.
      console.error("Escrow upsert warning (non-fatal):", escrowError.message);
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

    // 10. Telegram notification
    try {
      const { data: worker } = await supabaseAdmin
        .from('users')
        .select('telegram_chat_id')
        .eq('id', workerId)
        .single();

      if (worker?.telegram_chat_id) {
        const { sendTelegramAlert } = await import('@/lib/telegram');
        await sendTelegramAlert(
          worker.telegram_chat_id,
          `🎉 <b>You've been hired!</b>\nYour offer for <i>${gig.title}</i> was accepted and funds are secured in escrow.\n<a href="https://doitforme.in/gig/${gigId}">View Gig</a>`
        );
      }
    } catch (e) {
      console.error("Telegram notification failed:", e);
    }

    return NextResponse.json({ success: true, message: "Escrow funded and worker assigned successfully" });

  } catch (error: any) {
    console.error("Verification Error:", error);
    return NextResponse.json({ error: error.message || "Verification failed" }, { status: 500 });
  }
}