// Create a gateway order for the ₹299/month Company Pro plan.
// On payment success (handled by /api/webhooks/razorpay, or /api/company/pro/verify
// as the browser-callback fallback),
// companies.pro_until is set to now() + 30 days.

import { NextResponse } from "next/server";
import { createRazorpayOrder, razorpayConfigured } from "@/lib/razorpay";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const PRO_PRICE = 299;

export async function POST(_req: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Please log in." }, { status: 401 });
    }

    const { data: userRow } = await supabase
      .from("users")
      .select("name, email, phone, role")
      .eq("id", user.id)
      .single();

    if (!userRow || userRow.role !== "COMPANY") {
      return NextResponse.json({ error: "Only company accounts can subscribe to Pro." }, { status: 403 });
    }

    const orderId = `PRO_${Date.now()}_${user.id.split("-")[0]}`;
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // RAZORPAY branch. PRO_PRICE is a server constant — the client never sends
    // an amount here either.
    if (!razorpayConfigured()) {
      console.error("[pro/create-order] Razorpay credentials missing");
      return NextResponse.json({ error: "Payments are temporarily unavailable." }, { status: 503 });
    }

    const rzpOrder = await createRazorpayOrder({
      amountRupees: PRO_PRICE,
      receipt: orderId,
      notes: { user_id: user.id, type: "COMPANY_PRO" },
    });

    const { error: rzpErr } = await supabaseAdmin.from("transactions").insert({
      user_id: user.id,
      amount: PRO_PRICE,
      type: "COMPANY_PRO",
      status: "PENDING",
      gateway: "RAZORPAY",
      gateway_order_id: rzpOrder.id,
      provider_data: { plan: "PRO_MONTHLY", months: 1, receipt: orderId },
    });
    if (rzpErr) throw rzpErr;

    return NextResponse.json({
      success: true,
      provider: "RAZORPAY",
      order_id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
      gig_title: "DoItForMe Company Pro — 1 month",
      prefill: {
        name: userRow.name || "",
        email: userRow.email || "",
        contact: String(userRow.phone || "").replace(/\D/g, "").slice(-10),
      },
    });
  } catch (e: any) {
    console.error("Pro create-order error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
