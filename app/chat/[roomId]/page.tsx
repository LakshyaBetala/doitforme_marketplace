"use client";

import { toast } from "sonner";
import { compressImage, compressImages, COMPRESS_PRESETS } from "@/lib/imageCompress";

import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Avatar from "@/components/ui/Avatar";
import { Send, ArrowLeft, Loader2, Shield, User, Star, Menu, X, ShoppingBag, Briefcase, IndianRupee, Sparkles, Paperclip, Clock, CheckCircle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useModeration } from "@/app/hooks/useModeration";
import { friendlyError, friendlyHttpError } from "@/lib/errors";
import { displayIndianPhone } from "@/lib/phone";
import { platformFeeFor, audienceForGig, PLATFORM_FEES } from "@/lib/fees";
import { blurOnWheel } from "@/lib/inputs";

interface Message {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  message_type?: 'text' | 'offer' | 'image';
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

interface CurrentUserProfile {
  id: string;
  jobs_completed: number;
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
  market_type?: "SELL" | "RENT";
  images?: string[];
  // Loaded by the `select("*")` above; needed to tell a student gig (5%) from
  // company work (10%) when previewing the worker's take-home.
  company_id?: string | null;
}

function ChatRoomContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = params?.roomId as string;
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<CurrentUserProfile | null>(null);
  const [gig, setGig] = useState<GigDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Client Mode State
  const [isPoster, setIsPoster] = useState(false);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);
  const [applicantProfile, setApplicantProfile] = useState<UserProfile | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Realtime connection state. Surfaced to the user because a chat that has
  // silently stopped receiving looks identical to a quiet one.
  const [liveStatus, setLiveStatus] = useState<"live" | "reconnecting">("live");

  // Offer State
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");

  // Accept Modal State
  const [isAcceptModalOpen, setIsAcceptModalOpen] = useState(false);
  const [offerToAccept, setOfferToAccept] = useState<Message | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);

  // AI Hook
  const { analyze, loadModel } = useModeration();

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const channelRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  /**
   * Re-read the thread and merge in anything missed.
   *
   * Realtime is a delivery optimisation, never the source of truth: events sent
   * while the socket was down are gone forever, so every reconnect has to be
   * followed by a catch-up read. Merging by id keeps optimistic sends intact.
   */
  const resyncRef = useRef<() => Promise<void>>(async () => {});
  resyncRef.current = async () => {
    if (!roomId) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("gig_id", roomId)
      .order("created_at", { ascending: true });
    if (!data) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const merged = [...prev, ...data.filter((m: Message) => !seen.has(m.id))];
      return merged.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    });
  };

  // Backgrounding a tab suspends the websocket on mobile. Coming back to the
  // foreground, or regaining connectivity, must trigger a catch-up read — the
  // socket may report itself healthy while having missed everything.
  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState === "visible") void resyncRef.current();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("online", onWake);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("online", onWake);
    };
  }, []);

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

        // ⚡ Fetch user profile, gig, and messages in parallel
        const [myProfileRes, gigRes, msgsRes] = await Promise.all([
          supabase.from('users').select('jobs_completed').eq('id', user.id).single(),
          supabase.from("gigs").select("*, users:poster_id(id, name, phone)").eq("id", roomId).single(),
          supabase.from("messages").select("*").eq("gig_id", roomId).order("created_at", { ascending: true }),
        ]);

        if (myProfileRes.data) {
          setCurrentUserProfile({ id: user.id, jobs_completed: myProfileRes.data.jobs_completed || 0 });
        }

        const { data: gigData, error: gigError } = gigRes;
        if (gigError || !gigData) {
          setError("Gig not found.");
          setLoading(false);
          return;
        }
        setGig(gigData);

        const posterMode = gigData.poster_id === user.id;
        setIsPoster(posterMode);

        const allMessages = msgsRes.data || [];
        setMessages(allMessages);

        // Identify Context
        if (posterMode) {
          // POSTER: Load Applicants
          const { data: apps } = await supabase
            .from("applications")
            .select(`
              worker_id,
              status,
              worker:users!worker_id(id, name, avatar_url, rating, phone)
            `)
            .eq("gig_id", roomId);

          let applicantList = apps?.map((a: any) => ({ 
             ...a.worker, 
             id: a.worker_id, 
             appStatus: a.status 
          })) || [];

          // Ensure Assigned Worker is in the list (Critical for P2P/Instant Buy)
          if (gigData.assigned_worker_id) {
            const assignedInList = applicantList.find((a: any) => a.id === gigData.assigned_worker_id);
            if (!assignedInList) {
              const { data: assignedWorker } = await supabase.from('users').select('id, name, avatar_url, rating, phone').eq('id', gigData.assigned_worker_id).single();
              if (assignedWorker) applicantList.push(assignedWorker);
            }
          }

          const uniqueApps = Array.from(new Map(applicantList.map((item: any) => [item.id, item])).values());
          setApplicants(uniqueApps);

          const queryChat = searchParams.get('chat');
          const workerFromUrl = queryChat?.split('_')[1];

          let targetId = workerFromUrl || gigData.assigned_worker_id;

          if (!targetId && uniqueApps.length > 0) {
            const lastMsg = [...allMessages].reverse().find((m: any) => m.sender_id !== user.id);
            targetId = lastMsg?.sender_id || (uniqueApps[0] as any).id;
          }

          if (targetId) {
            setSelectedApplicantId(targetId as string);
            const validApp = uniqueApps.find((a: any) => a.id === targetId);
            if (validApp) setApplicantProfile(validApp as UserProfile);
            else {
              const { data: looseUser } = await supabase.from('users').select('id, name, avatar_url, rating, phone').eq('id', targetId).single();
              if (looseUser) setApplicantProfile(looseUser as UserProfile);
            }
          }
        } else {
          // APPLICANT
          setApplicantProfile(null);

          const allMagicChips = [
            "Available?", "Best Price?", "Where to meet?", "Can I see more pics?",
            "I'm interested!", "My Portfolio", "Can do in 1 day", "Let's discuss!"
          ];

          const myMsgs = allMessages.filter((m: any) =>
            m.sender_id === user.id &&
            m.message_type !== 'offer' &&
            !allMagicChips.includes(m.content)
          );
        }

        // Realtime subscription.
        //
        // The socket WILL drop: switching wifi to mobile data, locking the
        // phone, or backgrounding the tab all kill it. Previously .subscribe()
        // was called with no status handler, so after a drop messages simply
        // stopped arriving — silently, with the chat still looking live. On
        // mobile that is the normal case, not an edge case.
        const channel = supabase.channel(`chat:${roomId}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "messages", filter: `gig_id=eq.${roomId}` },
            (payload: any) => {
              const newMessage = payload.new as Message;
              // Dedup: the sender already appended this optimistically.
              setMessages((prev) => prev.some((x) => x.id === newMessage.id) ? prev : [...prev, newMessage]);
            }
          )
          .subscribe((status: string) => {
            if (status === "SUBSCRIBED") {
              setLiveStatus("live");
              // Catch up on anything sent while we were disconnected.
              void resyncRef.current();
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
              setLiveStatus("reconnecting");
            }
          });

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

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedApplicantId]);

  // (The client-side "messages used" counter was removed — the cap is enforced
  // server-side in /api/chat/send and is deliberately not surfaced. See the note
  // where the progress bar used to render.)

  const sendMessage = async (txt?: string, type: 'text' | 'offer' | 'image' = 'text', amount?: number) => {
    if (isSending) return;
    const textToSend = txt || input;
    if ((type === 'text' && !textToSend.trim()) || !currentUser) return;

    setIsSending(true);

    if (type === 'text') {
      const aiResult = await analyze(textToSend, 'CHAT');
      if (!aiResult.isSafe) {
        toast.error(`⚠️ Safety Alert: ${aiResult.reason || "Content flagged by AI."}`);
        setIsSending(false);
        return;
      }
    }

    if (type === 'offer') setIsOfferModalOpen(false);

    try {
      const payload: any = {
        gigId: roomId,
        senderId: currentUser.id,
        content: textToSend,
        type,
        offerAmount: amount,
        applicantId: isPoster ? selectedApplicantId : undefined
      };

      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        // Message-limit / moderation come back as friendly 403/400 text — keep those;
        // otherwise classify by status.
        toast.error(json.message || friendlyHttpError(res.status, json.error));
        return;
      }

      // Show the sent message immediately rather than waiting for the realtime
      // echo (which may lag); the realtime handler dedupes by id.
      if (json.message?.id) {
        setMessages((prev) => prev.some((x) => x.id === json.message.id) ? prev : [...prev, json.message]);
      }

      if (type === 'text' && !txt) setInput("");

    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setIsSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) return toast.error("File size must be less than 5MB");
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return toast.error("Only JPG, PNG, WEBP allowed");

    setIsUploading(true);
    try {
      const upload = await compressImage(file, COMPRESS_PRESETS.attachment);
      const fileExt = upload.name.split('.').pop();
      const fileName = `${roomId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(fileName, upload);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(fileName);

      await sendMessage(publicUrl, 'image');

    } catch (err: any) {
      toast.error(friendlyError(err));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const sendOffer = () => {
    const amt = Number(offerAmount);
    if (!amt || amt <= 0) return;
    sendMessage("", 'offer', amt);
  };

  const acceptOffer = (msg: Message) => {
    setOfferToAccept(msg);
    setIsAcceptModalOpen(true);
  };

  const confirmAcceptOffer = async () => {
    if (!offerToAccept) return;
    setIsAccepting(true);

    try {
      const res = await fetch("/api/gig/accept-offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gigId: gig?.id,
          workerId: offerToAccept.sender_id,
          price: offerToAccept.offer_amount
        }),
      });

      if (res.ok) {
        setGig(prev => prev ? ({ ...prev, negotiated_price: offerToAccept.offer_amount! }) : null);
        setIsAcceptModalOpen(false);
        setOfferToAccept(null);
        toast.success("Offer accepted! Hustler has been notified.");
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error(friendlyHttpError(res.status, json?.error));
      }
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setIsAccepting(false);
    }
  };

  const declineOffer = async (msg: Message) => {
    if (!confirm("Decline this offer?")) return;
    sendMessage(`I've declined the offer of ₹${msg.offer_amount}.`, 'text');
  };

  // --- DERIVED STATE ---
  const activeMessages = messages.filter(m => {
    if (isPoster) {
      if (!selectedApplicantId) return false;
      return (m.sender_id === currentUser?.id && m.receiver_id === selectedApplicantId) ||
        (m.sender_id === selectedApplicantId && m.receiver_id === currentUser?.id);
    }
    // Applicant: only the thread between me and the poster. (Admins can read every
    // message via RLS's is_admin() bypass, so without this an admin-applicant would
    // see other applicants' threads mixed in.)
    const posterId = gig?.poster_id;
    return (m.sender_id === currentUser?.id && m.receiver_id === posterId) ||
      (m.sender_id === posterId && m.receiver_id === currentUser?.id);
  });

  const magicChips = ["I'm interested!", "My Portfolio", "Can do in 1 day", "Let's discuss!"];

  // --- RENDER ---
  if (loading) return <div className="h-[100dvh] [.workspace_&]:h-full bg-[var(--background)] flex items-center justify-center"><Loader2 className="animate-spin text-[var(--accent-ink)]" /></div>;
  if (error || !gig) return <div className="h-[100dvh] [.workspace_&]:h-full bg-[var(--background)] flex items-center justify-center text-[var(--fg)]">{error}</div>;

  return (
    <div className="flex h-[100dvh] [.workspace_&]:h-full bg-[var(--background)] text-[var(--fg)] font-sans overflow-hidden">

      {/* POSTER SIDEBAR (Desktop: Visible, Mobile: Drawer) */}
      {isPoster && (
        <>
          {/* Mobile Overlay */}
          {sidebarOpen && (
            <div className="fixed inset-0 z-40 bg-black/80 md:hidden" onClick={() => setSidebarOpen(false)} />
          )}

          <aside className={`fixed md:relative z-40 w-72 h-full bg-[var(--surface)] border-r border-[var(--line)] transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
            <div className="p-4 border-b border-[var(--line)] flex justify-between items-center">
              <h2 className="font-bold text-sm text-[var(--fg-muted)]">Applicants</h2>
              <button onClick={() => setSidebarOpen(false)} className="md:hidden text-[var(--fg-muted)]"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto h-full pb-20">
              {applicants.length === 0 ? (
                <div className="p-8 text-center text-[var(--fg-muted)] text-xs">No applicants yet.</div>
              ) : (
                applicants.map(app => {
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
                      className={`w-full p-4 flex items-center gap-3 hover:bg-[var(--chip-strong)] transition-colors border-b border-[var(--line)] ${selectedApplicantId === app.id ? 'bg-[#C9A9FF]/10 border-l-2 border-l-[#C9A9FF]' : ''}`}
                    >
                      <div className="w-10 h-10 rounded-full bg-zinc-800 relative overflow-hidden shrink-0">
                        <Avatar src={app.avatar_url} fallback={app.name || "U"} className="w-full h-full rounded-none" textClassName="text-xs font-bold" />
                      </div>
                      <div className="text-left overflow-hidden flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-0.5 mt-1">
                          <p className={`font-medium truncate text-sm flex items-center gap-2 ${selectedApplicantId === app.id ? 'text-[var(--fg)]' : 'text-[var(--fg-muted)]'}`}>
                            {app.name}
                          </p>
                          {lastMsg && <span className="text-[9px] text-[var(--fg-muted)] whitespace-nowrap ml-2">{new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                        </div>

                        {lastMsg ? (
                          <p className="text-xs text-[var(--fg-muted)] truncate flex items-center gap-1">
                            {lastMsg.sender_id === currentUser.id && <span className="text-[var(--accent-ink)]">You:</span>}
                            {lastMsg.content}
                          </p>
                        ) : (
                          <p className="text-[10px] text-[var(--fg-muted)] flex items-center gap-1"><Star size={10} className="text-[var(--warn)] fill-current" /> {(!app.rating || app.rating_count === 0) ? "NA" : Number(app.rating).toFixed(1)} Rating</p>
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
        <header className="px-4 py-3 border-b border-[var(--line)] bg-[var(--surface)] flex items-center gap-4 z-20 shrink-0">
          <div className="flex items-center gap-3">
            {isPoster && <button onClick={() => setSidebarOpen(true)} className="md:hidden text-[var(--fg-muted)]"><Menu size={24} /></button>}
            <button onClick={() => router.back()} className="p-2 rounded-full bg-[var(--chip-strong)] hover:bg-[var(--chip-strong)] transition-colors">
              <ArrowLeft size={20} className="text-[var(--fg-muted)]" />
            </button>

            <div>
              <h1 className="font-bold text-sm md:text-base leading-tight">
                {isPoster ? (applicantProfile?.name || "Select Applicant") : gig.title}
              </h1>
              <div className="flex items-center gap-2 text-[10px] text-[var(--fg-muted)]">
                {isPoster ? <span className="text-[var(--accent-ink)]">Hustler</span> : <span>Posted by Client</span>}
                <span className="w-1 h-1 rounded-full bg-zinc-600"></span>
                <span className="flex items-center gap-1"><Shield size={10} className="text-[var(--ok)]" /> Trust Verified</span>
              </div>
            </div>
          </div>
        </header>
 
        {/* PHONE REVEAL BANNER */}
        {['assigned', 'AWAITING_FUNDS', 'SUBMITTED', 'completed'].includes(gig.status) && (
           <div className="bg-[var(--accent-soft)] border-b border-[var(--accent-line)] p-3 flex flex-col items-center justify-center gap-1 text-center relative z-10 px-4">
             <p className="text-xs font-bold text-[var(--fg-muted)] flex items-center gap-2">
               <Shield size={12} className="text-[var(--accent-ink)]"/> Connection Established
             </p>
             <p className="text-sm">
                You can now contact <span className="font-bold">{isPoster ? applicantProfile?.name : (gig as any).users?.name}</span> directly via WhatsApp/Phone: 
                <span className="font-black text-[var(--accent-ink)] ml-2 bg-[var(--surface)] px-3 py-1 rounded-lg border border-[var(--accent-line)]">
                  {(() => {
                    const p = isPoster ? (applicantProfile as any)?.phone : (gig as any).users?.phone;
                    return p ? displayIndianPhone(p) : 'No phone provided';
                  })()}
                </span>
             </p>
           </div>
        )}

        {/* TRANSACTION CARD (Sticky) */}
        <div className="bg-[var(--surface)] border-b border-[var(--line)] p-3 flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-lg bg-zinc-800 relative overflow-hidden shrink-0 border border-[var(--line)]">
            {(() => {
              // images[] can also hold non-image attachments (e.g. a COMPANY_TASK
              // requirements PDF) — only render an actual image, else the icon.
              const firstImage = gig?.images?.find((img) => /\.(jpe?g|png|webp|gif|avif)$/i.test(img));
              return firstImage
                ? <Image src={supabase.storage.from("gig-images").getPublicUrl(firstImage).data.publicUrl} alt="Gig" fill className="object-cover" />
                : <Briefcase className="p-2 w-full h-full text-[var(--fg-muted)]" />;
            })()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-bold text-[var(--fg-muted)] truncate">{gig.title}</h3>
            <p className="text-[10px] text-[var(--fg-muted)] flex items-center font-mono">
              <IndianRupee size={10} /> {gig.price} • {gig.listing_type}
            </p>
          </div>
          {gig.status === 'open' ? (
            <span className="px-2 py-1 rounded bg-[var(--warn-soft)] border border-[var(--warn-line)] text-[var(--warn)] text-[10px] font-bold whitespace-nowrap">
              Discussion
            </span>
          ) : (
            <span className="px-2 py-1 rounded bg-[var(--ok-soft)] border border-[var(--ok-line)] text-[var(--ok)] text-[10px] font-bold whitespace-nowrap">
              Locked
            </span>
          )}
        </div>

        {/* OFFER MODAL — no backdrop-blur (GPU expensive on mobile) */}
        <AnimatePresence>
          {isOfferModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            >
              <div className="bg-[var(--surface)] border border-[var(--line)] rounded-3xl p-6 w-full max-w-sm relative">
                <button
                  onClick={() => setIsOfferModalOpen(false)}
                  className="absolute top-4 right-4 text-[var(--fg-muted)] hover:text-[var(--fg)]"
                >
                  <X size={20} />
                </button>
                <h3 className="text-xl font-bold mb-1">Make an Offer</h3>
                <p className="text-[var(--fg-muted)] text-xs mb-6">Propose a new price for this item.</p>

                <div className="space-y-4">
                  <input
                    type="number" onWheel={blurOnWheel}
                    value={offerAmount}
                    onChange={(e) => setOfferAmount(e.target.value)}
                    placeholder="Enter amount (₹)"
                    className="w-full bg-[var(--surface)] text-[var(--fg)] p-4 rounded-xl border border-[var(--line-strong)] focus:border-[var(--accent)] outline-none text-lg font-bold"
                  />
                  {!isPoster && gig.listing_type === 'HUSTLE' && (() => {
                    // The rate quoted here has to be the rate actually charged.
                    // This block used to hardcode 3% and show 97% take-home,
                    // overstating the worker's payout on every offer they made —
                    // so it now derives everything from lib/fees.ts.
                    const offer = Math.max(0, Math.round(Number(offerAmount || 0)));
                    const audience = audienceForGig(gig);
                    const fee = platformFeeFor(offer, audience);
                    const ratePct = Math.round(PLATFORM_FEES[audience] * 100);
                    return (
                      <div className="bg-[var(--chip-strong)] rounded-lg p-3 text-xs space-y-1 my-4">
                        <div className="flex justify-between text-[var(--fg-muted)]">
                          <span>Gig Budget:</span>
                          <span>₹{offer}</span>
                        </div>
                        <div className="flex justify-between text-[var(--fg-muted)]">
                          <span>Platform fee ({ratePct}%):</span>
                          <span className="text-[var(--bad)]">- ₹{fee}</span>
                        </div>
                        <div className="border-t border-[var(--line)] pt-2 flex justify-between font-bold text-[var(--ok)]">
                          <span>Your Take-home:</span>
                          <span>₹{Math.max(0, offer - fee)}</span>
                        </div>
                      </div>
                    );
                  })()}

                  <button
                    onClick={sendOffer}
                    disabled={!offerAmount || Number(offerAmount) <= 0}
                    className="w-full py-3 bg-[var(--accent)] text-[var(--on-accent)] font-bold rounded-xl active:scale-95 transition touch-manipulation"
                  >
                    Send Offer
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ACCEPT OFFER MODAL — no backdrop-blur */}
        <AnimatePresence>
          {isAcceptModalOpen && offerToAccept && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            >
              <div className="bg-[var(--surface)] border border-[var(--line)] rounded-3xl p-6 w-full max-w-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--accent-line)] to-[var(--accent)]"></div>

                <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                  <CheckCircle className="text-[var(--ok)]" size={24} /> Accept Offer?
                </h3>

                <div className="py-6 flex flex-col items-center">
                  <div className="text-4xl font-black text-[var(--fg)] tracking-tighter mb-1">
                    ₹{offerToAccept.offer_amount}
                  </div>
                  <p className="text-xs text-[var(--fg-muted)] font-bold">New Agreed Price</p>
                </div>

                  <div className="bg-[var(--chip-strong)] rounded-xl p-4 mb-6 text-xs text-[var(--fg-muted)] leading-relaxed border border-[var(--line)]">
                    <p>
                      You are accepting this budget. The hustler will receive this amount minus platform fees.
                    </p>
                  </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setIsAcceptModalOpen(false)}
                    className="py-3 bg-[var(--chip-strong)] hover:bg-[var(--chip-strong)] rounded-xl text-[var(--fg)] font-bold text-sm transition-colors touch-manipulation"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmAcceptOffer}
                    disabled={isAccepting}
                    className="py-3 bg-[var(--ok-solid)] hover:bg-[var(--ok-solid)] rounded-xl text-[var(--fg)] font-bold text-sm transition-colors shadow-green-500/20 disabled:opacity-50 flex items-center justify-center gap-2 touch-manipulation"
                  >
                    {isAccepting ? <Loader2 className="animate-spin" size={16} /> : "Confirm Acceptance"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MESSAGES — CSS fade-in instead of Framer Motion per message (much lighter on mobile) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 relative bg-[var(--background)]">
          {/* Subtle dot grid wallpaper */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, var(--fg) 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

          {(isPoster && !selectedApplicantId) ? (
            <div className="flex h-full items-center justify-center text-[var(--fg-muted)] text-sm flex-col gap-2">
              <User size={32} />
              Select an applicant to start chatting.
            </div>
          ) : activeMessages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-[var(--fg-muted)] text-sm flex-col gap-2">
              <Sparkles size={32} />
              No messages yet. Say hi!
            </div>
          ) : (
            activeMessages.map((m) => {
              const isMe = m.sender_id === currentUser.id;
              const isOffer = m.message_type === 'offer';
              const isImage = m.message_type === 'image';

              return (
                <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"} relative z-10 animate-in fade-in duration-150`}>
                  {isOffer ? (
                    <div className={`max-w-[85%] md:max-w-[300px] w-full rounded-2xl overflow-hidden border ${isMe ? 'border-[var(--accent-line)] bg-[var(--accent-soft)]' : 'border-[var(--line)] bg-[var(--surface)]'}`}>
                      <div className="p-4 bg-[var(--chip-strong)] border-b border-[var(--line)] flex justify-between items-center">
                        <span className="text-xs font-bold text-[var(--fg-muted)]">
                          {isMe ? "You sent an offer" : "Received Offer"}
                        </span>
                        <IndianRupee size={14} className="text-[var(--accent-ink)]" />
                      </div>
                      <div className="p-6 flex flex-col items-center gap-2">
                        <div className="text-3xl font-black text-[var(--fg)] tracking-tighter">
                          ₹{m.offer_amount}
                        </div>
                        <p className="text-[10px] text-[var(--fg-muted)]">
                          {isMe ? "Waiting for response..." : "Proposed Price"}
                        </p>
                      </div>
                      {!isMe && isPoster && gig.status === 'open' && (
                        <div className="p-2 grid grid-cols-2 gap-2 bg-black/20">
                          <button
                            onClick={() => declineOffer(m)}
                            className="py-2 rounded-lg bg-[var(--bad-soft)] text-[var(--bad)] text-xs font-bold hover:bg-[var(--bad-soft)] touch-manipulation"
                          >
                            Decline
                          </button>
                          <button
                            onClick={() => acceptOffer(m)}
                            className="py-2 rounded-lg bg-[var(--ok-soft)] text-[var(--ok)] text-xs font-bold hover:bg-[var(--ok-soft)] touch-manipulation"
                          >
                            Accept
                          </button>
                        </div>
                      )}
                      {gig.negotiated_price === m.offer_amount && (
                        <div className="px-4 py-2 bg-[var(--ok-soft)] text-[var(--ok)] text-[10px] font-bold text-center flex items-center justify-center gap-1">
                          <CheckCircle size={12} /> Offer Accepted
                        </div>
                      )}
                      <div className="px-4 pb-1 flex items-center justify-center gap-1 text-[10px] text-red-400/80 font-bold ">
                        <Clock size={10} /> Offer expires in 24h
                      </div>
                      <div className="px-4 py-2 text-[9px] text-right opacity-30 font-mono">
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ) : isImage ? (
                    <div className={`max-w-[85%] md:max-w-[300px] rounded-2xl overflow-hidden border cursor-zoom-in ${isMe ? 'border-[var(--accent-line)]' : 'border-[var(--line)]'}`} onClick={() => setSelectedImage(m.content)}>
                      <div className="relative aspect-video bg-black/50">
                        <Image
                          src={m.content}
                          alt="Attachment"
                          fill
                          className="object-cover"
                          onClick={() => window.open(m.content, '_blank')}
                        />
                      </div>
                      <div className="px-2 py-1 bg-[var(--surface)] text-[9px] text-right text-[var(--fg-muted)] font-mono">
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ) : (
                    <div className={`max-w-[85%] md:max-w-[60%] px-4 py-2 rounded-2xl text-sm shadow-sm break-words ${isMe ? "bg-[var(--accent)] text-[var(--on-accent)] rounded-tr-none" : "bg-[var(--surface)] border border-[var(--line)] text-[var(--fg)] rounded-tl-none"}`}>
                      {m.content}
                      <div className="text-[9px] mt-1 text-right opacity-50 font-mono">
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT AREA */}
        <div className="bg-[var(--surface)] border-t border-[var(--line)] shrink-0 pb-safe">

          {/* Chat Closed Banner */}
          {gig.status === 'completed' && (
            <div className="px-4 py-3 flex items-center justify-center gap-3 text-sm bg-[var(--accent-soft)] border-b border-[var(--accent-line)]">
              <div className="relative w-8 h-8 shrink-0">
                <Image src="/moneysloth.png" alt="" fill className="object-contain" sizes="32px" />
              </div>
              <span className="text-[var(--fg-muted)] font-medium">Deal done. Money&apos;s on its way, and the sloth salutes you.</span>
            </div>
          )}
          {gig.status === 'cancelled' && (
            <div className="px-4 py-3 flex items-center justify-center gap-2 text-sm text-[var(--fg-muted)] bg-[var(--chip)] border-b border-[var(--line)]">
              <CheckCircle className="w-4 h-4 text-[var(--fg-faint)] shrink-0" />
              <span>This gig was cancelled. Chat is closed.</span>
            </div>
          )}

          {/* Connection state. A chat whose socket has dropped looks exactly
              like a chat where nobody is talking, so the difference has to be
              visible — otherwise people assume they were ignored. */}
          {liveStatus === "reconnecting" && (
            <div
              role="status"
              aria-live="polite"
              className="px-4 py-2 flex items-center justify-center gap-2 text-xs text-amber-300/90 bg-[var(--warn-soft)] border-b border-[var(--warn-line)]"
            >
              <Loader2 size={12} className="animate-spin shrink-0" />
              Reconnecting — new messages will appear once you&apos;re back online.
            </div>
          )}

          {/* The pre-agreement message cap is deliberately NOT shown.
              A visible "3/5 Messages Used" counter turns a guard rail into a
              countdown: people spend their remaining messages racing to swap
              phone numbers, which is the exact behaviour the cap exists to
              prevent. The cap is enforced server-side in /api/chat/send and
              surfaces only if someone actually reaches it, as a nudge toward
              making an offer rather than a scolding. */}

          {/* Magic Chips */}
          <div className="flex gap-2 overflow-x-auto px-4 py-3 no-scrollbar">
            {magicChips.map((chip, i) => (
              <button
                key={i}
                onClick={() => sendMessage(chip)}
                disabled={isSending}
                className="whitespace-nowrap px-3 py-1.5 rounded-full bg-[var(--chip-strong)] hover:bg-[var(--chip-strong)] border border-[var(--line)] text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors disabled:opacity-50 touch-manipulation"
              >
                {chip}
              </button>
            ))}
          </div>

          <div className="px-4 pb-4 pt-1 max-w-4xl mx-auto relative flex gap-3 items-center">

            {/* Removed Offer Button for Market */}

            {/* File upload */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || ['completed', 'cancelled'].includes(gig.status)}
              className="p-3 bg-[var(--chip-strong)] hover:bg-[var(--chip-strong)] rounded-full text-[var(--fg-muted)] border border-[var(--line)] transition shrink-0 disabled:opacity-50 touch-manipulation"
              title="Attach Image"
            >
              {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
            </button>

            {/* TEXT INPUT */}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              onFocus={loadModel}
              placeholder={isUploading ? "Uploading image..." : "Type a message..."}
              disabled={isUploading || ['completed', 'cancelled'].includes(gig.status)}
              className="flex-1 bg-[var(--surface)] border border-[var(--line)] rounded-full px-6 py-3.5 text-sm text-[var(--fg)] placeholder-white/30 focus:outline-none focus:border-[var(--accent-line)] focus:ring-1 focus:ring-[var(--accent-line)] transition disabled:opacity-50"
            />

            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isSending || isUploading || ['completed', 'cancelled'].includes(gig.status)}
              className="w-12 h-12 rounded-full bg-[var(--accent)] hover:bg-[var(--accent-soft)] text-[var(--on-accent)] flex items-center justify-center transition disabled:opacity-50 disabled:hover:bg-[var(--accent)] shrink-0 shadow-[0_0_20px_rgba(136,37,245,0.3)] touch-manipulation"
            >
              <Send size={18} className="ml-1" />
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {selectedImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setSelectedImage(null)}>
          <button className="absolute top-6 right-6 p-4 bg-[var(--chip-strong)] rounded-full text-[var(--fg)] hover:bg-[var(--chip-strong)] transition"><X className="w-8 h-8" /></button>
          <div className="relative w-full max-w-6xl h-full max-h-[85vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()} >
            <Image src={selectedImage || ""} alt="Fullscreen Attachment" fill className="object-contain" quality={100} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChatRoomPage() {
  return (
    <Suspense fallback={
      <div className="h-[100dvh] [.workspace_&]:h-full bg-[var(--background)] flex items-center justify-center">
        <Loader2 className="animate-spin text-[var(--accent-ink)]" />
      </div>
    }>
      <ChatRoomContent />
    </Suspense>
  );
}
