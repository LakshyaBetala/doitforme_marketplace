import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabaseServer";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function isUnsafeMessage(text: string) {
  const phoneRegex = /(\+?\d[\d -]{7,}\d)/g;
  const personalKeywords = /(whatsapp|watsapp|call\s?me|phone|mobile|reach\s?me|num(ber)?)/gi;
  const socialRegex = /(@\w{3,}|instagram|insta|ig|snap(chat)?|telegram|t\.me|tg)/gi;

  return (
    phoneRegex.test(text) ||
    personalKeywords.test(text) ||
    socialRegex.test(text)
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { roomId, message } = body;

    if (!roomId || !message) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // get current user from session
    const authSupabase = await supabaseServer();
    const { data: userData } = await authSupabase.auth.getUser();
    const user = userData?.user ?? null;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const senderId = user.id;

    // verify participant of room
    const { data: roomData, error: roomErr } = await supabase
      .from("chat_rooms")
      .select("*")
      .eq("id", roomId)
      .single();
    if (roomErr || !roomData) return NextResponse.json({ error: "Chat room not found" }, { status: 404 });

    if (user.id !== roomData.poster_id && user.id !== roomData.worker_id) {
      return NextResponse.json({ error: "You are not part of this chat." }, { status: 403 });
    }

    if (isUnsafeMessage(message)) {
      // log blocked message
      await supabase.from("chat_blocked_logs").insert({
        room_id: roomId,
        sender_id: senderId,
        original_message: message,
        reason: "Contact information detected",
      });

      return NextResponse.json({ success: false, blocked: true, message: "Message blocked for safety." });
    }

    // insert safe message using service role
    const { data, error } = await supabase.from("chat_messages").insert({
      room_id: roomId,
      sender_id: senderId,
      message,
    }).select().single();

    if (error) throw error;

    return NextResponse.json({ success: true, message: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to send" }, { status: 500 });
  }
}
