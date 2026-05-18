// Create a Cashfree order for the ₹299/month Company Pro plan.
// On payment success (handled by /api/webhooks/cashfree or fallback /api/company/pro/verify),
// companies.pro_until is set to now() + 30 days.

import { NextResponse } from "next/server";
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

    const { error: txnError } = await supabaseAdmin.from("transactions").insert({
      user_id: user.id,
      amount: PRO_PRICE,
      type: "COMPANY_PRO",
      status: "PENDING",
      gateway: "CASHFREE",
      gateway_order_id: orderId,
      provider_data: { plan: "PRO_MONTHLY", months: 1 },
    });

    if (txnError) throw txnError;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://doitforme.in";
    const returnUrl = `${appUrl}/company/dashboard?pro=verify&order_id={order_id}`;
    const validPhone = String(userRow.phone || "").replace(/\D/g, "").slice(-10) || "9999999999";

    const payload = {
      order_amount: PRO_PRICE,
      order_currency: "INR",
      order_id: orderId,
      customer_details: {
        customer_id: user.id,
        customer_name: (userRow.name || "Company").substring(0, 30),
        customer_email: userRow.email || user.email || "no-email@example.com",
        customer_phone: validPhone,
      },
      order_meta: {
        return_url: returnUrl,
        notify_url: `${appUrl}/api/webhooks/cashfree`,
      },
      order_tags: {
        type: "COMPANY_PRO",
        user_id: user.id,
      },
      order_note: "doitforme Pro — 1 month",
    };

    const env = process.env.NODE_ENV === "production" ? "api" : "sandbox";
    const cashfreeUrl = `https://${env}.cashfree.com/pg/orders`;

    let paymentSessionId = "fake_session_pro";
    if (process.env.NODE_ENV !== "development") {
      const res = await fetch(cashfreeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-version": "2023-08-01",
          "x-client-id": process.env.CASHFREE_APP_ID!,
          "x-client-secret": process.env.CASHFREE_SECRET_KEY!,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("Cashfree pro create-order failed:", data);
        return NextResponse.json({ error: data.message || "Gateway error" }, { status: 502 });
      }
      paymentSessionId = data.payment_session_id;
    }

    return NextResponse.json({
      success: true,
      paymentSessionId,
      orderId,
      amount: PRO_PRICE,
    });
  } catch (e: any) {
    console.error("Pro create-order error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
