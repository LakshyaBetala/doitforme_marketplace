// Fallback verifier for Company Pro purchase (return-URL path).
// Webhooks at /api/webhooks/cashfree are the primary trigger; this is invoked
// from the dashboard when the user is bounced back with ?pro=verify&order_id=...

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { orderId } = await req.json();
    if (!orderId) return NextResponse.json({ error: "Missing orderId" }, { status: 400 });

    const { data: txn } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("gateway_order_id", orderId)
      .single();

    if (!txn) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (txn.type !== "COMPANY_PRO") {
      return NextResponse.json({ error: "Not a Pro purchase" }, { status: 400 });
    }

    if (txn.status === "COMPLETED") {
      return NextResponse.json({ success: true, message: "Already activated" });
    }

    // Verify with Cashfree
    let validPayment: any = null;
    if (process.env.NODE_ENV !== "development") {
      const env = process.env.NODE_ENV === "production" ? "api" : "sandbox";
      const res = await fetch(`https://${env}.cashfree.com/pg/orders/${orderId}/payments`, {
        headers: {
          "x-client-id": process.env.CASHFREE_APP_ID!,
          "x-client-secret": process.env.CASHFREE_SECRET_KEY!,
          "x-api-version": "2023-08-01",
        },
      });
      const data = await res.json();
      validPayment = Array.isArray(data) ? data.find((p: any) => p.payment_status === "SUCCESS") : null;
      if (!validPayment) {
        return NextResponse.json({ error: "Payment not completed" }, { status: 400 });
      }
      const cf = Number(validPayment.payment_amount || 0);
      const db = Number(txn.amount || 0);
      if (cf > 0 && Math.abs(cf - db) > 1) {
        return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
      }
    } else {
      validPayment = { cf_payment_id: "dev_fake", payment_amount: txn.amount };
    }

    // Activate Pro: extend pro_until by 30 days from max(now, current pro_until)
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("pro_until")
      .eq("user_id", txn.user_id)
      .single();

    const now = new Date();
    const base = company?.pro_until && new Date(company.pro_until) > now
      ? new Date(company.pro_until)
      : now;
    const newProUntil = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);

    await supabaseAdmin
      .from("companies")
      .update({ pro_until: newProUntil.toISOString() })
      .eq("user_id", txn.user_id);

    await supabaseAdmin
      .from("transactions")
      .update({
        status: "COMPLETED",
        gateway_payment_id: validPayment.cf_payment_id,
      })
      .eq("id", txn.id);

    // Notify
    try {
      const { data: u } = await supabaseAdmin
        .from("users")
        .select("email, name, telegram_chat_id")
        .eq("id", txn.user_id)
        .single();
      if (u?.email) {
        const { sendEmail } = await import("@/lib/email");
        await sendEmail("company_pro_activated", {
          to: u.email,
          recipientName: u.name,
          proUntil: newProUntil.toISOString(),
        });
      }
      if (u?.telegram_chat_id) {
        const { sendTelegramAlert } = await import("@/lib/telegram");
        await sendTelegramAlert(
          u.telegram_chat_id,
          `🚀 <b>Pro activated!</b>\nUnlimited gigs, unlimited applicants, featured posting until ${newProUntil.toDateString()}.\n<a href="https://doitforme.in/company/dashboard">Open dashboard</a>`
        );
      }
    } catch (e) {
      console.error("Pro activation notification failed:", e);
    }

    return NextResponse.json({ success: true, proUntil: newProUntil.toISOString() });
  } catch (e: any) {
    console.error("Pro verify error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
