"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Link from "next/link";
import { 
  ArrowLeft, 
  Send, 
  Loader2, 
  ShieldCheck,
  Check,
  AlertTriangle,
  Lock
} from "lucide-react";

export default function GigChatPage() {
  const supabase = supabaseBrowser();
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const scrollRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [user, setUser] = useState<any>(null);
  const [gig, setGig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push("/login");
      setUser(user);

      const { data: gigData } = await supabase.from("gigs").select("*").eq("id", id).single();
      if (!gigData) return;
      setGig(gigData);

      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("gig_id", id)
        .order("created_at", { ascending: true });
      
      if (msgs) setMessages(msgs);
      setLoading(false);

      const channel = supabase
        .channel(`chat:${id}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `gig_id=eq.${id}`
        }, (payload) => {
          if (payload.new.sender_id !== user.id) {
            setMessages((prev) => [...prev, payload.new]);
          }
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    };

    if (id) init();
  }, [id, supabase, router]);

  // --- 🔒 SMART FILTER LOGIC ---
  const containsRestrictedInfo = (text: string) => {
    // 1. EXCEPTION: Remove "Reg Nos" (RA followed by digits) BEFORE checking for phone numbers
    // This allows "RA2311003012059" to pass, but blocks "9876543210"
    const textWithoutRegNos = text.replace(/RA\s*\d+/gi, ""); 

    const lower = textWithoutRegNos.toLowerCase();
    const normalized = lower.replace(/[^a-z0-9]/g, ""); // Remove all symbols/spaces

    // 2. Block Standard Keywords (Socials, Contacts)
    const blockList = [
      "whatsapp", "insta", "instagram", "telegram", "snapchat", "gmailcom", "yahoocom", 
      "phone", "contactme", "callme", "textme", "dmme", "pingme"
    ];
    if (blockList.some(word => normalized.includes(word))) return true;

    // 3. Strict Phone Number Check
    // We check the 'textWithoutRegNos' so actual Reg Numbers don't count as phone numbers
    const digitsOnly = textWithoutRegNos.replace(/\D/g, ""); 
    if (digitsOnly.length >= 10) return true;

    // 4. Email Regex
    if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text)) return true;

    // 5. BLOCK SOCIAL HANDLES (e.g., "id : laksh", "ig-user", "snap: name")
    // Catches "id : name", "ig - name", etc.
    if (/(id|ig|insta|snap|tg)\s*[:\-\.]\s*@?[a-z0-9_\.]+/i.test(lower)) return true;

    return false;
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;
    setWarning(null);

    const text = newMessage;

    // Run Filter
    if (containsRestrictedInfo(text)) {
      setWarning("⚠️ STRICT POLICY: Sharing Phone/Socials is blocked. Registration Numbers (RA...) are allowed.");
      return; 
    }

    setNewMessage(""); 

    // Optimistic UI
    const tempId = Math.random().toString();
    const optimisticMsg = {
      id: tempId,
      gig_id: id,
      sender_id: user.id,
      content: text,
      created_at: new Date().toISOString(),
      pending: true 
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    const { error } = await supabase.from("messages").insert({
      gig_id: id,
      sender_id: user.id,
      content: text
    });

    if (error) {
        console.error("Send error:", error);
        alert("Failed to send message");
        setMessages((prev) => prev.filter(m => m.id !== tempId));
        setNewMessage(text);
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-[#0B0B11] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-brand-purple animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#0B0B11] text-white selection:bg-brand-purple">
      
      {/* Header */}
      <div className="p-4 border-b border-white/10 bg-[#121217] flex items-center gap-4 shadow-md z-10">
        <Link href={`/dashboard`} className="p-2 hover:bg-white/10 rounded-full transition text-white/50 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-bold text-lg flex items-center gap-2">
            {gig?.title}
          </h1>
          <div className="flex items-center gap-1.5 text-xs text-green-400">
            <Lock className="w-3 h-3" /> Secure Escrow Chat
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[url('/grid-pattern.svg')] bg-repeat opacity-90">
        <div className="text-center py-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-full text-yellow-500 text-xs font-bold mb-4">
            <ShieldCheck className="w-3 h-3" /> Anti-Fraud Protection Active
          </div>
          <p className="text-white/30 text-xs max-w-xs mx-auto">
            Social handles & Phone numbers are blocked. <br/>
            <span className="text-white/50">Chats are Secured and Monitored.</span>
          </p>
        </div>

        {messages.map((msg) => {
          const isMe = msg.sender_id === user?.id;
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              <div className={`max-w-[75%] md:max-w-[60%] p-4 rounded-2xl shadow-lg relative group ${
                isMe 
                  ? "bg-brand-purple text-white rounded-tr-none" 
                  : "bg-[#1A1A24] border border-white/10 rounded-tl-none"
              }`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                <div className="flex items-center justify-end gap-1 mt-1.5">
                  <p className={`text-[10px] font-medium opacity-50 ${isMe ? "text-white" : "text-white/40"}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </p>
                  {isMe && !msg.pending && <Check className="w-3 h-3 text-white/50" />}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} />
      </div>

      {/* Warning Popup */}
      {warning && (
        <div className="mx-4 mb-2 p-3 bg-red-500/10 border border-red-500/50 rounded-xl flex items-start gap-3 animate-in slide-in-from-bottom-5">
           <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
           <p className="text-sm text-red-400 font-medium leading-tight">{warning}</p>
        </div>
      )}

      {/* Input */}
      <div className="p-4 bg-[#121217] border-t border-white/10">
        <form onSubmit={sendMessage} className="flex gap-3 max-w-4xl mx-auto">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => {
                setNewMessage(e.target.value);
                if(warning) setWarning(null);
            }}
            placeholder="Type message..."
            className={`flex-1 bg-[#0B0B11] border rounded-2xl px-5 py-4 focus:outline-none transition-all shadow-inner text-sm placeholder:text-white/20 ${
                warning ? "border-red-500/50 focus:border-red-500" : "border-white/10 focus:border-brand-purple"
            }`}
          />
          <button 
            type="submit"
            disabled={!newMessage.trim()}
            className="p-4 bg-brand-purple rounded-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 shadow-[0_0_20px_rgba(136,37,245,0.3)]"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>

    </div>
  );
}