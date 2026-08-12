import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

// Peer recommendations — "I'd work with them again."
//
// Deliberately NOT open to anyone: a recommendation only counts if the two
// people actually interacted on the platform. Without that check the number is
// farmable in minutes by a group of friends, and a trust signal nobody trusts is
// worse than none at all.
//
// Qualifying interaction = a gig that actually reached 'completed' between the
// two people, in either direction. Applications and chat messages deliberately
// do NOT qualify: vouching for someone you merely spoke to means nothing.

const service = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function currentUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/** GET ?userId=... -> count + whether the caller has already recommended them. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  const db = service();
  const me = await currentUser();

  const [{ count }, mine] = await Promise.all([
    db.from("recommendations").select("*", { count: "exact", head: true }).eq("recommended_id", userId),
    me
      ? db.from("recommendations").select("id").eq("recommended_id", userId).eq("recommender_id", me.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const { data: recent } = await db
    .from("recommendations")
    .select("id, note, created_at, recommender:users!recommender_id(name, username, avatar_url)")
    .eq("recommended_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);

  return NextResponse.json({
    count: count || 0,
    hasRecommended: Boolean((mine as { data: unknown })?.data),
    recent: recent || [],
  });
}

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const { userId, note } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });
  if (userId === me.id) {
    return NextResponse.json({ error: "You can't recommend yourself." }, { status: 400 });
  }

  const db = service();

  // Proof of FINISHED work between these two, in either direction.
  //
  // Previously this accepted an application or even a chat message, which meant
  // you could vouch for someone you had merely spoken to. A recommendation is
  // only worth anything if it means "they did the job" — so it requires a gig
  // that actually reached completion between the pair.
  const { data: sharedWork } = await db
    .from("gigs")
    .select("id")
    .eq("status", "completed")
    .or(
      `and(poster_id.eq.${me.id},assigned_worker_id.eq.${userId}),` +
      `and(poster_id.eq.${userId},assigned_worker_id.eq.${me.id})`
    )
    .limit(1);

  if (!sharedWork?.length) {
    return NextResponse.json(
      { error: "You can recommend someone once you've completed a job together." },
      { status: 403 }
    );
  }

  const cleanNote = typeof note === "string" && note.trim() ? note.trim().slice(0, 280) : null;

  const { error } = await db.from("recommendations").insert({
    recommender_id: me.id,
    recommended_id: userId,
    note: cleanNote,
  });

  if (error) {
    // 23505 = the one-per-pair unique constraint.
    if (error.code === "23505") {
      return NextResponse.json({ error: "You've already recommended them." }, { status: 409 });
    }
    console.error("recommend insert failed:", error);
    return NextResponse.json({ error: "Could not save that right now." }, { status: 500 });
  }

  // Tell them — a recommendation is a reason to come back to the site.
  try {
    const { data: target } = await db
      .from("users")
      .select("telegram_chat_id, username")
      .eq("id", userId)
      .single();
    const { data: fromUser } = await db.from("users").select("name").eq("id", me.id).single();

    await db.from("notifications").insert({
      user_id: userId,
      type: "recommendation",
      content: `${fromUser?.name || "Someone"} recommended you.`,
      link: target?.username ? `/u/${target.username}` : "/profile",
    });

    if (target?.telegram_chat_id) {
      const { sendTelegramAlert } = await import("@/lib/telegram");
      await sendTelegramAlert(
        target.telegram_chat_id,
        `<b>You've been recommended</b>\n${fromUser?.name || "Someone"} vouched for your work on doitforme.`
      );
    }
  } catch (e) {
    console.error("recommend notify failed", e);
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  const { error } = await service()
    .from("recommendations")
    .delete()
    .eq("recommender_id", me.id)
    .eq("recommended_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
