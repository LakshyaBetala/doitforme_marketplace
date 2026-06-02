import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPush } from "@/lib/push";

// Internal: called by the Postgres `notifications` trigger (via pg_net) on every
// new notification row. Guarded by a shared secret — never reachable from the
// browser. Fans the notification out to all of the user's push subscriptions.
const TITLES: Record<string, string> = {
  gig: "New gig on DoItForMe",
  message: "New message",
  application: "Application update",
  payout: "Payment update",
  escrow: "Payment update",
  dispute: "Dispute update",
};

function titleFor(type: string | null): string {
  return (type && TITLES[type]) || "DoItForMe";
}

export async function POST(req: Request) {
  if (req.headers.get("x-push-secret") !== process.env.PUSH_DISPATCH_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { user_id, type, content, link } = await req.json();
    if (!user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 });

    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: subs } = await service
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", user_id);
    if (!subs || subs.length === 0) return NextResponse.json({ ok: true, sent: 0 });

    const payload = {
      title: titleFor(type),
      body: content || "You have a new update on DoItForMe.",
      url: link || "/dashboard",
      tag: type || undefined,
    };

    let sent = 0;
    const gone: string[] = [];
    for (const s of subs) {
      const r = await sendPush(s, payload);
      if (r.ok) sent++;
      else if (r.gone) gone.push(s.endpoint);
    }
    if (gone.length) await service.from("push_subscriptions").delete().in("endpoint", gone);

    return NextResponse.json({ ok: true, sent });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
