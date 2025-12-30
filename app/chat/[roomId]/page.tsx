"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function ChatRoomPage() {
  const params = useParams();
  const roomId = params?.roomId as string | undefined;
  const router = useRouter();

  const supabase = supabaseBrowser();

  const [user, setUser] = useState<any | null>(null);
  const [room, setRoom] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!roomId) {
      setError("Chat room not found");
      setLoading(false);
      return;
    }

    const loadChat = async () => {
      try {
        // Current user
        const { data: userData } = await supabase.auth.getUser();
        const u = userData?.user ?? null;
        setUser(u);
        if (!u) return router.push("/login");

        // Chat room info
        const { data: roomData, error: roomError } = await supabase
          .from("chat_rooms")
          .select("*")
          .eq("id", roomId)
          .single();

        if (roomError || !roomData) {
          setError("Chat room not found");
          return;
        }
        setRoom(roomData);

        // Authorization check
        const isParticipant =
          u.id === roomData.poster_id || u.id === roomData.worker_id;
        if (!isParticipant) {
          setError("You are not part of this chat.");
          return;
        }

        // Load messages
        const { data: msgsData, error: msgsError } = await supabase
          .from("chat_messages")
          .select("*")
          .eq("room_id", roomId)
          .order("created_at", { ascending: true });

        if (msgsError) throw msgsError;

        setMessages(msgsData ?? []);

        // Realtime updates
        const channel = supabase
          .channel(`room-${roomId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "chat_messages",
              filter: `room_id=eq.${roomId}`,
            },
            (payload) => {
              const newMsg = payload?.new ?? payload;
              setMessages((prev) => [...prev, newMsg]);
            }
          )
          .subscribe();

        channelRef.current = channel;
      } catch (err: any) {
        setError(err?.message || "Failed to load chat");
      } finally {
        setLoading(false);
      }
    };

    loadChat();

    return () => {
      try {
        channelRef.current?.unsubscribe();
      } catch (_) {}
    };
  }, [roomId, supabase, router]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !user) return;
    const text = input.trim();
    setInput("");

    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, message: text, senderId: user.id }),
      });

      const json = await res.json();

      if (json.blocked) {
        setError("Message blocked for safety (no contact info allowed).");
        return;
      }

      if (!json.success) {
        setError(json.error || "Failed to send message");
        return;
      }

      // Successful send — realtime subscription will deliver the new message
    } catch (err: any) {
      setError(err?.message || "Failed to send message");
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading…
      </div>
    );

  if (error)
    return <div className="text-center text-red-600 mt-20">{error}</div>;

  const getInitial = (id: string) => id?.charAt(0)?.toUpperCase() || "?";

  return (
    <div className="flex flex-col min-h-screen">
      <div className="max-w-3xl w-full mx-auto flex-1 flex flex-col border-l border-r bg-white">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Chat</h2>
          <p className="text-xs text-gray-500">Room ID: {roomId}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m) => {
            const isMe = m.sender_id === user.id;
            return (
              <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className="flex items-end gap-2 max-w-[80%]">
                  {!isMe && (
                    <div className="w-7 h-7 rounded-full bg-gray-300 text-sm flex items-center justify-center">
                      {getInitial(m.sender_id)}
                    </div>
                  )}

                  <div
                    className={`px-4 py-2 rounded-lg ${
                      isMe
                        ? "bg-purple-600 text-white"
                        : "bg-gray-100 text-gray-900"
                    }`}
                  >
                    <div className="text-sm whitespace-pre-wrap">{m.message}</div>
                    <div
                      className={`text-[10px] mt-1 ${
                        isMe ? "text-purple-200" : "text-gray-500"
                      } text-right`}
                    >
                      {new Date(m.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t sticky bottom-0 bg-white">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 p-3 border rounded"
              placeholder="Type a message…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="bg-purple-600 text-white px-4 rounded disabled:bg-purple-400"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
