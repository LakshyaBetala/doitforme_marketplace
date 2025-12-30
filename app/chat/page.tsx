"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function ChatListPage() {
  const supabase = supabaseBrowser();
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const u = userData?.user ?? null;
        if (!u) return setLoading(false);

        const { data } = await supabase
          .from("chat_rooms")
          .select("*")
          .or(`poster_id.eq.${u.id},worker_id.eq.${u.id}`)
          .order("updated_at", { ascending: false });

        setRooms(data ?? []);
      } catch (e) {
        setRooms([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  if (loading) return <div className="p-6">Loading chats…</div>;

  if (rooms.length === 0)
    return <div className="p-6">No chats yet. Start by messaging a poster.</div>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="page-title mb-4">Chats</h1>

      <div className="space-y-3">
        {rooms.map((r) => (
          <Link key={r.id} href={`/chat/${r.id}`} className="card block">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">Chat: {r.id}</div>
                <div className="text-sm text-gray-500">Last: {r.last_message ?? '—'}</div>
              </div>
              <div className="text-sm text-gray-400">Open</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
