"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { Send, ArrowLeft, Loader2, AlertCircle, Shield, User, Star } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
}

interface UserProfile {
  id: string;
  name: string;
  avatar_url?: string;
  rating?: number;
  rating_count?: number;
  jobs_completed?: number;
}

export default function ChatRoomPage() {
  const params = useParams();
  const roomId = params?.roomId as string; // Maps to gig_id
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gigTitle, setGigTitle] = useState("");

  // New State for "Applicant ID" (needed if I am the poster)
  const [applicantId, setApplicantId] = useState<string | null>(null);

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const channelRef = useRef<any>(null);

  // 1. Load Data
  useEffect(() => {
    if (!roomId) return;

    const initChat = async () => {
      try {
        // A. Get Current User
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }
        setCurrentUser(user);

        // B. Load Gig Details
        const { data: gig, error: gigError } = await supabase
          .from("gigs")
          .select("title, poster_id, assigned_worker_id, status")
          .eq("id", roomId)
          .single();

        if (gigError || !gig) {
          setError("Project not found.");
          setLoading(false);
          return;
        }

        const isPoster = gig.poster_id === user.id;
        const isWorker = gig.assigned_worker_id === user.id;

        // FIX: Ensure chat is only open if I am involved
        if (!isPoster && !isWorker) {
          // Wait, if I am an applicant I am technically not "worker" yet.
          // But I should have an application?
          // Security check: Check if I have an application
          const { data: application } = await supabase
            .from("applications")
            .select("id")
            .eq("gig_id", roomId)
            .eq("worker_id", user.id)
            .maybeSingle();

          if (!application) {
            setError("Unauthorized: You are not part of this project.");
            setLoading(false);
            return;
          }
        }

        setGigTitle(gig.title);

        // C. Load Existing Messages
        const { data: msgs, error: msgError } = await supabase
          .from("messages")
          .select("*")
          .eq("gig_id", roomId)
          .order("created_at", { ascending: true });

        if (msgError) throw msgError;
        setMessages(msgs || []);

        // D. IDENTIFY OTHER USER
        let targetUserId: string | null = null;

        if (isPoster) {
          // If I am poster, who am I talking to?
          // 1. Assigned Worker?
          if (gig.assigned_worker_id) {
            targetUserId = gig.assigned_worker_id;
          }
          // 2. Or the person who sent messages that aren't me?
          else if (msgs && msgs.length > 0) {
            const otherMsg = msgs.find(m => m.sender_id !== user.id);
            if (otherMsg) targetUserId = otherMsg.sender_id;
          }
        } else {
          // If I am NOT poster, I must be talking to the Poster
          targetUserId = gig.poster_id;
        }

        // If we found the other user, fetch their profile
        if (targetUserId) {
          setApplicantId(targetUserId); // For API calls
          const { data: profile } = await supabase
            .from("users")
            .select("id, name, avatar_url, rating") // Add other fields if needed
            .eq("id", targetUserId)
            .single();

          if (profile) {
            setOtherUser(profile);
          }
        }


        // E. Setup Realtime Subscription
        const channel = supabase.channel(`chat:${roomId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "messages",
              filter: `gig_id=eq.${roomId}`,
            },
            (payload) => {
              const newMessage = payload.new as Message;
              setMessages((prev) => [...prev, newMessage]);

              // If we didn't know the other user yet (Poster receiving first msg), identify them now
              if (isPoster && !targetUserId && newMessage.sender_id !== user.id) {
                fetchOtherUserProfile(newMessage.sender_id);
              }
            }
          )
          .subscribe();

        channelRef.current = channel;
        setLoading(false);

      } catch (err: any) {
        console.error("Chat Init Error:", err);
        setError("Failed to load chat.");
        setLoading(false);
      }
    };

    initChat();

    // Helper to fetch profile late (Realtime)
    const fetchOtherUserProfile = async (uid: string) => {
      setApplicantId(uid);
      const { data: profile } = await supabase
        .from("users")
        .select("id, name, avatar_url, rating")
        .eq("id", uid)
        .single();
      if (profile) setOtherUser(profile);
    };

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [roomId, supabase, router]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 2. Send Message Handler
  const sendMessage = async () => {
    if (!input.trim() || !currentUser) return;
    const content = input.trim();
    setInput("");

    try {
      // Determine Payload
      const payload: any = {
        gigId: roomId,
        senderId: currentUser.id,
        content: content
      };

      // If I am the poster, the API demands 'applicantId' to know who I'm replying to
      // We use the identified 'applicantId' (otherUser.id)
      if (applicantId && currentUser.id !== applicantId) {
        // Logic: if applicantId is set and it's NOT me, pass it.
        // Actually, API logic: if isPoster, requires applicantId.
        payload.applicantId = applicantId;
      }

      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Robust JSON Handling
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        console.error("JSON Parse Error. Raw response:", text);
        alert("Server Error: Unable to send message.");
        return;
      }

      if (json.blocked) {
        alert("Message blocked: Sharing contact info is unsafe.");
        return;
      }

      if (!json.success) {
        alert(json.error || "Failed to send message");
      }
    } catch (err) {
      console.error("Send Error:", err);
      alert("Network error sending message.");
    }
  };

  // --- RENDER STATES ---

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0B0B11] text-white">
        <Loader2 className="w-8 h-8 animate-spin text-[#8825F5]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-[#0B0B11] text-white gap-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <p className="text-lg">{error}</p>
        <Link href="/dashboard" className="px-6 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#0B0B11] text-white font-sans selection:bg-[#8825F5] selection:text-white relative overflow-hidden">

      {/* HEADER */}
      <header className="px-4 py-3 md:px-6 md:py-4 border-b border-white/10 bg-[#121217] flex items-center gap-4 shadow-lg z-10">
        <Link href={`/gig/${roomId}`} className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white/70" />
        </Link>

        {/* User Info Block */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#8825F5] to-blue-500 p-[2px]">
            <div className="w-full h-full rounded-full bg-[#121217] flex items-center justify-center overflow-hidden">
              {otherUser?.avatar_url ? (
                <Image src={otherUser.avatar_url} alt="User" width={40} height={40} className="object-cover" />
              ) : (
                <User className="w-5 h-5 text-white/50" />
              )}
            </div>
          </div>
          <div>
            <h1 className="font-bold text-sm md:text-base leading-tight">
              {otherUser?.name || "Unknown User"}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              {otherUser?.rating ? (
                <div className="flex items-center gap-1 text-[10px] md:text-xs text-yellow-500 font-bold bg-yellow-500/10 px-1.5 py-0.5 rounded">
                  <Star className="w-3 h-3 fill-current" /> {otherUser.rating.toFixed(1)}
                </div>
              ) : (
                <span className="text-[10px] text-yellow-500 font-bold bg-yellow-500/10 px-1.5 py-0.5 rounded">New</span>
              )}
              <span className="text-[10px] text-zinc-500 max-w-[120px] md:max-w-[200px] truncate">• {gigTitle}</span>
            </div>
          </div>
        </div>

        <div className="ml-auto">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
            <Shield className="w-3 h-3 text-green-500" />
            <span className="text-[10px] text-green-500 font-medium hidden md:inline">Encrypted</span>
          </div>
        </div>
      </header>

      {/* MESSAGES AREA */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 z-10 relative bg-[#0B0B11]">
        {/* Wallpaper Pattern (Dots) */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

        {messages.map((m) => {
          const isMe = m.sender_id === currentUser.id;
          return (
            <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"} relative z-10`}>
              <div
                className={`max-w-[85%] md:max-w-[60%] px-4 py-2 rounded-2xl text-sm shadow-sm break-words ${isMe
                    ? "bg-[#8825F5] text-white rounded-tr-none"
                    : "bg-[#1A1A24] border border-white/5 text-white/90 rounded-tl-none"
                  }`}
              >
                {m.content}
                <div className={`text-[10px] mt-1 text-right font-mono opacity-60`}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT AREA */}
      <div className="p-3 md:p-4 bg-[#121217] border-t border-white/10 z-10">
        <div className="max-w-4xl mx-auto relative flex gap-3 items-center">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 bg-[#1A1A24] text-white px-5 py-3 rounded-full border border-white/10 focus:border-[#8825F5] outline-none transition-all placeholder:text-white/20 text-sm"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="p-3 bg-[#8825F5] hover:bg-[#7b1dd1] disabled:opacity-50 disabled:scale-95 rounded-full text-white transition-all shadow-lg shadow-[#8825F5]/20 flex items-center justify-center"
          >
            <Send className="w-5 h-5 ml-0.5" />
          </button>
        </div>
      </div>

    </div>
  );
}