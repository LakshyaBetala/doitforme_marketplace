"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { Send, ArrowLeft, Loader2, AlertCircle, Shield, User, Star, Menu, X, ShoppingBag, Briefcase, IndianRupee, Sparkles } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  type?: 'text' | 'offer';
  offer_amount?: number;
}

interface UserProfile {
  id: string;
  name: string;
  avatar_url?: string;
  rating?: number;
  rating_count?: number;
  jobs_completed?: number;
}

interface GigDetails {
  id: string;
  title: string;
  price: number;
  negotiated_price?: number;
  poster_id: string;
  assigned_worker_id?: string;
  status: string;
  listing_type: "HUSTLE" | "MARKET";
  market_type?: "SELL" | "RENT"; // Needed for limits
  images?: string[];
}

export default function ChatRoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = params?.roomId as string; // gig_id
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [gig, setGig] = useState<GigDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Poster Mode State
  const [isPoster, setIsPoster] = useState(false);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);
  const [applicantProfile, setApplicantProfile] = useState<UserProfile | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Message Limits
  const [msgCount, setMsgCount] = useState(0);
  const [msgLimit, setMsgLimit] = useState(0);

  // Offer State
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const channelRef = useRef<any>(null);

  // 1. Load Data
  useEffect(() => {
    if (!roomId) return;

    const initChat = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }
        setCurrentUser(user);

        // Fetch Gig
        const { data: gigData, error: gigError } = await supabase
          .from("gigs")
          .select("*")
          .eq("id", roomId)
          .single();

        if (gigError || !gigData) {
          setError("Project not found.");
          setLoading(false);
          return;
        }
        setGig(gigData);

        const posterMode = gigData.poster_id === user.id;
        setIsPoster(posterMode);

        // Fetch Messages
        const { data: msgs } = await supabase
          .from("messages")
          .select("*")
          .eq("gig_id", roomId)
          .order("created_at", { ascending: true });

        const allMessages = msgs || [];
        setMessages(allMessages);

        // Identify Context
        if (posterMode) {
          // POSTER: Load Applicants
          // 1. Explicit Applications
          const { data: apps } = await supabase
            .from("applications")
            .select(`
              worker_id,
              worker:users!worker_id(id, name, avatar_url, rating)
            `)
            .eq("gig_id", roomId);

          // 2. Implicit "Chatters" (people who messaged but maybe didn't apply yet - rare but possible)
          // For V3, let's stick to Applications + Assigned Worker

          let applicantList = apps?.map((a: any) => ({ ...a.worker, id: a.worker_id })) || [];

          // 3. Deduplicate
          const uniqueApps = Array.from(new Map(applicantList.map((item: any) => [item.id, item])).values());
          setApplicants(uniqueApps);

          // Select User
          const queryChat = searchParams.get('chat'); // ?chat=gigId_workerId
          const workerFromUrl = queryChat?.split('_')[1];

          let targetId = workerFromUrl || gigData.assigned_worker_id;

          // If no target, default to first applicant or most recent messager
          if (!targetId && uniqueApps.length > 0) {
            // Find most recent message sender that is NOT me
            const lastMsg = [...allMessages].reverse().find((m: any) => m.sender_id !== user.id);
            targetId = lastMsg?.sender_id || uniqueApps[0].id;
          }

          if (targetId) {
            setSelectedApplicantId(targetId);
            const validApp = uniqueApps.find((a: any) => a.id === targetId);
            if (validApp) setApplicantProfile(validApp);
            else {
              // Fetch if not in application list (edge case)
              const { data: looseUser } = await supabase.from('users').select('id, name, avatar_url, rating').eq('id', targetId).single();
              if (looseUser) setApplicantProfile(looseUser);
            }
          }
        } else {
          // APPLICANT: Target is Poster
          setApplicantProfile(null); // I am talking to poster, don't need "applicant profile"
          // Fetch poster details for header if needed, but we have gig.

          // Set Limit Logic
          let limit = 2; // Default
          if (gigData.listing_type === 'MARKET') {
            limit = gigData.market_type === 'RENT' ? 5 : 10;
          }
          setMsgLimit(limit);

          // Calculate my count (exclude Offers from limit!)
          const myMsgs = allMessages.filter((m: any) => m.sender_id === user.id && m.type !== 'offer');
          setMsgCount(myMsgs.length);
        }

        // Realtime
        const channel = supabase.channel(`chat:${roomId}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "messages", filter: `gig_id=eq.${roomId}` },
            (payload) => {
              const newMessage = payload.new as Message;
              setMessages((prev) => [...prev, newMessage]);

              if (!posterMode && newMessage.sender_id === user.id && newMessage.type !== 'offer') {
                setMsgCount(prev => prev + 1);
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

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [roomId, supabase, router, searchParams]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedApplicantId]);


  const sendMessage = async (txt?: string, type: 'text' | 'offer' = 'text', amount?: number) => {
    const textToSend = txt || input;
    // For offes, text might be empty
    if ((type === 'text' && !textToSend.trim()) || !currentUser) return;

    // Optimistic UI? No, wait for server to ensure limits.
    if (type === 'text') setInput("");
    if (type === 'offer') setIsOfferModalOpen(false);

    try {
      const payload: any = {
        gigId: roomId,
        senderId: currentUser.id,
        content: textToSend,
        type,
        offerAmount: amount,
        // If poster, define who I am talking to
        applicantId: isPoster ? selectedApplicantId : undefined
      };

      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.message || json.error || "Failed");
        return;
      }

    } catch (e) {
      alert("Network error.");
    }
  };

  const sendOffer = () => {
    const amt = Number(offerAmount);
    if (!amt || amt <= 0) return;
    sendMessage("", 'offer', amt);
  };

  const acceptOffer = async (msg: Message) => {
    if (!confirm(`Accept offer of ₹${msg.offer_amount}? This will lock the price for this applicant.`)) return;

    try {
      // Use new V4 endpoint that updates 'applications' table
      const res = await fetch("/api/gig/accept-offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gigId: gig?.id,
          workerId: msg.sender_id, // The applicant who made the offer
          price: msg.offer_amount
        }),
      });

      if (res.ok) {
        // Optimistically update UI if needed, but the system message will trigger refresh
        setGig(prev => prev ? ({ ...prev, negotiated_price: msg.offer_amount! }) : null); // Optional: store locally for UI
        alert("Offer accepted! Worker has been notified.");
      } else {
        const json = await res.json();
        alert(json.error || "Failed to accept offer");
      }
    } catch (e) {
      alert("Network error");
    }
  };

  const declineOffer = async (msg: Message) => {
    if (!confirm("Decline this offer?")) return;
    sendMessage(`I've declined the offer of ₹${msg.offer_amount}.`, 'text');
  };


  // --- DERIVED STATE ---
  // Filter messages for the active conversation
  const activeMessages = messages.filter(m => {
    if (!isPoster) return true; // Applicant sees all (filtered by RLS anyway usually, but strictly: me <-> poster)
    if (!selectedApplicantId) return false;
    return (m.sender_id === currentUser?.id && m.receiver_id === selectedApplicantId) ||
      (m.sender_id === selectedApplicantId && m.receiver_id === currentUser?.id);
  });

  // Magic Chips
  const magicChips = gig?.listing_type === 'MARKET'
    ? ["Available?", "Best Price?", "Where to meet?", "Can I see more pics?"]
    : ["I'm interested!", "My Portfolio", "Can do in 1 day", "Let's discuss!"];

  // --- RENDER ---
  if (loading) return <div className="h-screen bg-[#0B0B11] flex items-center justify-center"><Loader2 className="animate-spin text-brand-purple" /></div>;
  if (error || !gig) return <div className="h-screen bg-[#0B0B11] flex items-center justify-center text-white">{error}</div>;

  return (
    <div className="flex h-screen bg-[#0B0B11] text-white font-sans selection:bg-brand-purple overflow-hidden">

      {/* POSTER SIDEBAR (Desktop: Visible, Mobile: Drawer) */}
      {isPoster && (
        <>
          {/* Mobile Overlay */}
          {sidebarOpen && (
            <div className="fixed inset-0 z-40 bg-black/80 md:hidden" onClick={() => setSidebarOpen(false)} />
          )}

          <aside className={`fixed md:relative z-40 w-72 h-full bg-[#121217] border-r border-white/10 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
              <h2 className="font-bold text-sm tracking-wider uppercase text-white/60">Applicants</h2>
              <button onClick={() => setSidebarOpen(false)} className="md:hidden text-white/40"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto h-full pb-20">
              {applicants.length === 0 ? (
                <div className="p-8 text-center text-white/30 text-xs">No applicants yet.</div>
              ) : (
                applicants.map(app => {
                  // Find last MESSAGE from this applicant OR to this applicant to show in sidebar
                  const lastMsg = [...messages]
                    .reverse()
                    .find(m =>
                      (m.sender_id === app.id && m.receiver_id === currentUser.id) ||
                      (m.sender_id === currentUser.id && m.receiver_id === app.id)
                    );

                  return (
                    <button
                      key={app.id}
                      onClick={() => { setSelectedApplicantId(app.id); setSidebarOpen(false); }}
                      className={`w-full p-4 flex items-center gap-3 hover:bg-white/5 transition-colors border-b border-white/5 ${selectedApplicantId === app.id ? 'bg-brand-purple/10 border-l-2 border-l-brand-purple' : ''}`}
                    >
                      <div className="w-10 h-10 rounded-full bg-zinc-800 relative overflow-hidden shrink-0">
                        {app.avatar_url ? <Image src={app.avatar_url} alt={app.name} fill className="object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs">{app.name[0]}</div>}
                      </div>
                      <div className="text-left overflow-hidden flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <p className={`font-medium truncate text-sm ${selectedApplicantId === app.id ? 'text-white' : 'text-white/80'}`}>{app.name}</p>
                          {lastMsg && <span className="text-[9px] text-white/30 whitespace-nowrap ml-2">{new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                        </div>

                        {lastMsg ? (
                          <p className="text-xs text-white/40 truncate flex items-center gap-1">
                            {lastMsg.sender_id === currentUser.id && <span className="text-brand-purple">You:</span>}
                            {lastMsg.content}
                          </p>
                        ) : (
                          <p className="text-[10px] text-white/30 flex items-center gap-1"><Star size={10} className="text-yellow-500 fill-current" /> {app.rating} Rating</p>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>
        </>
      )}

      {/* MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col relative w-full h-full">

        {/* HEADER */}
        <header className="px-4 py-3 border-b border-white/10 bg-[#121217] flex items-center gap-4 shadow-lg z-20 shrink-0">
          <div className="flex items-center gap-3">
            {isPoster && <button onClick={() => setSidebarOpen(true)} className="md:hidden text-white/70"><Menu size={24} /></button>}
            <Link href={`/gig/${roomId}`} className="p-2 rounded-full bg-white/5 hover:bg-white/10">
              <ArrowLeft size={20} className="text-white/70" />
            </Link>

            {/* Dynamic Title */}
            <div>
              <h1 className="font-bold text-sm md:text-base leading-tight">
                {isPoster ? (applicantProfile?.name || "Select Applicant") : gig.title}
              </h1>
              <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                {isPoster ? <span className="text-brand-purple">Applicant</span> : <span>Posted by Owner</span>}
                <span className="w-1 h-1 rounded-full bg-zinc-600"></span>
                <span className="flex items-center gap-1"><Shield size={10} className="text-green-500" /> Trust Verified</span>
              </div>
            </div>
          </div>
        </header>

        {/* TRANSACTION CARD (Sticky) */}
        <div className="bg-[#1A1A24] border-b border-white/5 p-3 flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-lg bg-zinc-800 relative overflow-hidden shrink-0 border border-white/10">
            {gig.images?.[0]
              ? <Image src={supabase.storage.from("gig-images").getPublicUrl(gig.images[0]).data.publicUrl} alt="Gig" fill className="object-cover" />
              : (gig.listing_type === 'MARKET' ? <ShoppingBag className="p-2 w-full h-full text-white/30" /> : <Briefcase className="p-2 w-full h-full text-white/30" />)
            }
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-bold text-white/90 truncate">{gig.title}</h3>
            <p className="text-[10px] text-white/50 flex items-center font-mono">
              <IndianRupee size={10} /> {gig.price} • {gig.listing_type}
            </p>
          </div>
          {gig.status === 'open' ? (
            <span className="px-2 py-1 rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">
              Discussion
            </span>
          ) : (
            <span className="px-2 py-1 rounded bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">
              Locked
            </span>
          )}
        </div>

        {/* OFFER MODAL */}
        <AnimatePresence>
          {isOfferModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <div className="bg-[#1A1A24] border border-white/10 rounded-3xl p-6 w-full max-w-sm relative">
                <button
                  onClick={() => setIsOfferModalOpen(false)}
                  className="absolute top-4 right-4 text-white/40 hover:text-white"
                >
                  <X size={20} />
                </button>
                <h3 className="text-xl font-bold mb-1">Make an Offer</h3>
                <p className="text-white/50 text-xs mb-6">Propose a new price for this item.</p>

                <div className="space-y-4">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 text-lg">₹</span>
                    <input
                      type="number"
                      value={offerAmount}
                      onChange={(e) => setOfferAmount(e.target.value)}
                      placeholder={String(gig.price)}
                      className="w-full bg-[#0B0B11] border border-white/10 rounded-xl py-3 pl-8 pr-4 text-xl font-bold text-white focus:outline-none focus:border-brand-purple transition-colors"
                    />
                  </div>
                  <div className="flex gap-2 text-xs text-white/30 justify-center">
                    <span>Listing Price: ₹{gig.price}</span>
                  </div>

                  <button
                    onClick={sendOffer}
                    disabled={!offerAmount || Number(offerAmount) <= 0}
                    className="w-full py-3 bg-brand-purple text-white font-bold rounded-xl active:scale-95 transition-all shadow-lg shadow-brand-purple/20"
                  >
                    Send Offer
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MESSAGES */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 relative bg-[#0B0B11]">
          {/* Wallpaper */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

          {(isPoster && !selectedApplicantId) ? (
            <div className="flex h-full items-center justify-center text-white/30 text-sm flex-col gap-2">
              <User size={32} />
              Select an applicant to start chatting.
            </div>
          ) : activeMessages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-white/30 text-sm flex-col gap-2">
              <Sparkles size={32} />
              No messages yet. Say hi!
            </div>
          ) : (
            activeMessages.map((m) => {
              const isMe = m.sender_id === currentUser.id;
              const isOffer = m.type === 'offer';

              return (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"} relative z-10`}>
                  {isOffer ? (
                    // OFFER CARD UI
                    <div className={`max-w-[85%] md:max-w-[300px] w-full rounded-2xl overflow-hidden border ${isMe ? 'border-brand-purple/50 bg-brand-purple/5' : 'border-white/10 bg-[#1A1A24]'}`}>
                      <div className="p-4 bg-white/5 border-b border-white/5 flex justify-between items-center">
                        <span className="text-xs font-bold uppercase tracking-wider text-white/60">
                          {isMe ? "You sent an offer" : "Received Offer"}
                        </span>
                        <IndianRupee size={14} className="text-brand-purple" />
                      </div>
                      <div className="p-6 flex flex-col items-center gap-2">
                        <div className="text-3xl font-black text-white tracking-tighter">
                          ₹{m.offer_amount}
                        </div>
                        <p className="text-[10px] text-white/40">
                          {isMe ? "Waiting for response..." : "Proposed Price"}
                        </p>
                      </div>
                      {/* Actions for Receiver (Poster) */}
                      {!isMe && isPoster && gig.status === 'open' && (
                        <div className="p-2 grid grid-cols-2 gap-2 bg-black/20">
                          <button
                            onClick={() => declineOffer(m)}
                            className="py-2 rounded-lg bg-red-500/10 text-red-400 text-xs font-bold hover:bg-red-500/20"
                          >
                            Decline
                          </button>
                          <button
                            onClick={() => acceptOffer(m)}
                            className="py-2 rounded-lg bg-green-500/10 text-green-400 text-xs font-bold hover:bg-green-500/20"
                          >
                            Accept
                          </button>
                        </div>
                      )}
                      <div className="px-4 py-2 text-[9px] text-right opacity-30 font-mono">
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ) : (
                    // STANDARD MESSAGE UI
                    <div className={`max-w-[85%] md:max-w-[60%] px-4 py-2 rounded-2xl text-sm shadow-sm break-words ${isMe ? "bg-brand-purple text-white rounded-tr-none" : "bg-[#1A1A24] border border-white/5 text-white/90 rounded-tl-none"}`}>
                      {m.content}
                      <div className="text-[9px] mt-1 text-right opacity-50 font-mono">
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT AREA */}
        <div className="bg-[#121217] border-t border-white/10 shrink-0 pb-safe">

          {/* Visual Limit (Applicant Only) */}
          {!isPoster && gig.status === 'open' && (
            <div className="w-full bg-white/5 h-1 relative">
              <div
                className={`h-full transition-all duration-500 ${msgCount >= msgLimit ? 'bg-red-500' : 'bg-brand-purple'}`}
                style={{ width: `${Math.min((msgCount / msgLimit) * 100, 100)}%` }}
              />
              <div className="absolute -top-6 right-4 text-[10px] font-bold text-white/50 bg-[#121217] px-2 py-0.5 rounded border border-white/10">
                {msgCount}/{msgLimit} Messages Used
              </div>
            </div>
          )}

          {/* Magic Chips */}
          <div className="flex gap-2 overflow-x-auto px-4 py-3 no-scrollbar mask-gradient">
            {magicChips.map((chip, i) => (
              <button
                key={i}
                onClick={() => sendMessage(chip)}
                disabled={!isPoster && msgCount >= msgLimit}
                className="whitespace-nowrap px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/80 hover:text-white transition-colors disabled:opacity-50"
              >
                {chip}
              </button>
            ))}
          </div>

          <div className="px-4 pb-4 pt-1 max-w-4xl mx-auto relative flex gap-3 items-center">
            {/* OFFER BUTTON (Marketplace Only, Applicant Only) */}
            {!isPoster && gig.listing_type === 'MARKET' && gig.status === 'open' && (
              <button
                onClick={() => setIsOfferModalOpen(true)}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-full text-green-400 border border-white/5 transition-all"
                title="Make an Offer"
              >
                <IndianRupee size={20} />
              </button>
            )}

            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder={(!isPoster && msgCount >= msgLimit && gig.status === 'open') ? "Limit reached. Make an offer?" : "Type a message..."}
              disabled={(!isPoster && msgCount >= msgLimit && gig.status === 'open')}
              className="flex-1 bg-[#1A1A24] text-white px-5 py-3 rounded-full border border-white/10 focus:border-brand-purple outline-none transition-all placeholder:text-white/20 text-sm disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim()}
              className="p-3 bg-brand-purple hover:bg-[#7b1dd1] disabled:opacity-50 disabled:scale-95 rounded-full text-white transition-all shadow-lg flex items-center justify-center shrink-0"
            >
              <Send className="w-5 h-5 ml-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
