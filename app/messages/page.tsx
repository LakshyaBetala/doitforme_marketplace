"use client";

import { toast } from "sonner";
import { compressImage, compressImages, COMPRESS_PRESETS } from "@/lib/imageCompress";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Image from "next/image";
import Link from "next/link";
import { Send, ArrowLeft, MoreVertical, Phone, Video, Search, Star, AlertTriangle, User, Loader2, IndianRupee, Paperclip, X, CheckCircle2, FileText, Download, RotateCcw, MapPin } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import StatusBadge, { statusToTone } from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import { friendlyError, friendlyHttpError } from "@/lib/errors";
import { MessageSquare } from "lucide-react";

export default function ChatPage() {
    return (
        <Suspense fallback={
            <div className="flex h-[100dvh] bg-[#0B0B11] text-white items-center justify-center">
                <Loader2 className="animate-spin text-white/60" />
            </div>
        }>
            <MessagesContent />
        </Suspense>
    );
}

function MessagesContent() {
    const supabase = supabaseBrowser();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [user, setUser] = useState<any>(null);
    const magicChips = [
        "Available?", "Best Price?", "Where to meet?", "Can I see more pics?",
        "I'm interested!", "My Portfolio", "Can do in 1 day", "Let's discuss!"
    ];
    const [conversations, setConversations] = useState<any[]>([]);
    const [activeChat, setActiveChat] = useState<string | null>(null);

    // Active Conversation Data (Derived or Fetched)
    const [activeConversation, setActiveConversation] = useState<any>(null);

    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Attachment State
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // Active Conversation gig status
    const [activeGigStatus, setActiveGigStatus] = useState<string | null>(null);

    // Send cooldown to prevent double-sending
    const [isSending, setIsSending] = useState(false);

    // Offer State
    const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
    const [offerAmount, setOfferAmount] = useState("");

    // Accept Offer State
    const [isAcceptModalOpen, setIsAcceptModalOpen] = useState(false);
    const [offerToAccept, setOfferToAccept] = useState<any>(null);
    const [isAccepting, setIsAccepting] = useState(false);

    // RTsub cleanup ref
    const channelRef = useRef<any>(null);

    // Dispute state (for poster in messages)
    const [showDisputeModal, setShowDisputeModal] = useState(false);
    const [disputeReason, setDisputeReason] = useState("");
    const [isDisputing, setIsDisputing] = useState(false);
    const [showChangesModal, setShowChangesModal] = useState(false);
    const [changesFeedback, setChangesFeedback] = useState("");
    const [isRequestingChanges, setIsRequestingChanges] = useState(false);

    // Location Alert State
    const [hasSentLocationAlert, setHasSentLocationAlert] = useState(false);

    // Telegram connection check
    const [hasTelegramLinked, setHasTelegramLinked] = useState<boolean | null>(null);
    const [showTelegramBanner, setShowTelegramBanner] = useState(true);

    // Audio synthesizer
    const playRingtone = () => {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();

            for (let i = 0; i < 4; i++) {
                const time = ctx.currentTime + i * 1.5;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, time);
                osc.frequency.exponentialRampToValueAtTime(600, time + 0.1);
                
                gain.gain.setValueAtTime(0, time);
                gain.gain.linearRampToValueAtTime(0.5, time + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.01, time + 1);
                
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.start(time);
                osc.stop(time + 1);
            }
        } catch (e) {
            console.warn("AudioContext error", e);
        }
    };

    // 1. Initialize User & Real-time Conversation List
    useEffect(() => {
        let channel: any;
        supabase.auth.getUser().then(({ data }: any) => {
            if (data.user) {
                const userId = data.user.id;
                setUser(data.user);
                fetchInitialData(userId);

                // Check Telegram Status
                supabase.from('users').select('telegram_chat_id').eq('id', userId).single().then(({data: profile}: any) => {
                    if(profile) setHasTelegramLinked(!!profile.telegram_chat_id);
                });

                // Handle deep linking from URL
                const chatParam = searchParams.get('chat');
                if (chatParam) {
                    setActiveChat(chatParam);
                }

                // Listen for any new messages involving me to update conversation list
                channel = supabase
                    .channel('global_messages_sync')
                    .on('postgres_changes', {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'messages',
                        filter: `receiver_id=eq.${userId}`
                    }, () => {
                        fetchInitialData(userId); // Refresh list when new message arrives
                    })
                    .on('postgres_changes', {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'messages',
                        filter: `sender_id=eq.${userId}`
                    }, () => {
                        fetchInitialData(userId); // Refresh list when I send a message elsewhere
                    })
                    .subscribe((status: string) => {
                        // A stale inbox is worse than a stale thread — the unread
                        // badge is how people decide whether to open the app.
                        if (status === 'SUBSCRIBED') fetchInitialData(userId);
                    });
            }
        });
        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, [searchParams]);

    // Backgrounding or losing connectivity suspends the websocket on mobile.
    // Returning to the foreground must trigger a catch-up read: the socket can
    // report itself healthy having missed everything while suspended.
    useEffect(() => {
        const onWake = () => {
            if (document.visibilityState === 'visible') void resyncThreadRef.current();
        };
        document.addEventListener('visibilitychange', onWake);
        window.addEventListener('online', onWake);
        return () => {
            document.removeEventListener('visibilitychange', onWake);
            window.removeEventListener('online', onWake);
        };
    }, []);

    // 2. Fetch Conversations & Users
    const fetchInitialData = async (userId: string) => {
        try {
            setLoading(true);

            // A. Fetch all messages involving me
            const { data: msgs, error: msgError } = await supabase
                .from('messages')
                .select(`
                  *,
                  gig:gigs!gig_id(title, listing_type, market_type, poster_id, assigned_worker_id, status, price, is_physical)
                `)
                .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
                .order('created_at', { ascending: false });

            if (msgError) throw msgError;

            if (!msgs || msgs.length === 0) {
                setConversations([]);
                setLoading(false);
                return;
            }

            // B. Identify Unique "Other Users" to fetch
            const userIds = new Set<string>();
            const conversationMap = new Map<string, any>();

            msgs.forEach((msg: any) => {
                let otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;

                // Fallback: If otherId is missing (e.g. old message), try to deduce from Gig
                if (!otherId && msg.gig) {
                    if (userId === msg.gig.poster_id) {
                        // I am Poster -> Other is Worker (if assigned)
                        otherId = msg.gig.assigned_worker_id;
                    } else {
                        // I am not Poster -> Other is Poster
                        otherId = msg.gig.poster_id;
                    }
                }

                if (!otherId) return; // Still unknown? Skip.

                userIds.add(otherId);

                // Group by Gig + OtherUser (Unique Conversation Key)
                const key = `${msg.gig_id}_${otherId}`;

                if (!conversationMap.has(key)) {
                    conversationMap.set(key, {
                        conversationKey: key,
                        gig_id: msg.gig_id,
                        otherUserId: otherId,
                        lastMessage: msg,
                        gig: msg.gig
                    });
                }
            });

            // C. Fetch User Profiles (Safely)
            if (userIds.size > 0) {
                const { data: users, error: userError } = await supabase
                    .from('users')
                    .select('id, name, avatar_url, rating, rating_count, jobs_completed')
                    .in('id', Array.from(userIds));

                if (userError) console.error("User fetch error:", userError);

                const userMap = new Map((users || []).map((u: any) => [u.id, u]));

                // D. Attach Profiles to Conversations
                const derivedConversations = Array.from(conversationMap.values()).map(conv => {
                    const profile = userMap.get(conv.otherUserId);
                    return {
                        ...conv,
                        otherUser: profile || {
                            id: conv.otherUserId,
                            name: "User",
                            rating: 0
                        } // Fallback
                    };
                });

                setConversations(derivedConversations);
            } else {
                setConversations([]);
            }

        } catch (err) {
            console.error("Load Error:", err);
        } finally {
            setLoading(false);
        }
    };

    // Realtime connection state — mirrors the chat room so both surfaces behave
    // identically. A silently dead socket is indistinguishable from a quiet chat.
    const [liveStatus, setLiveStatus] = useState<'live' | 'reconnecting'>('live');

    /**
     * Catch-up read for the open thread. Realtime is a delivery optimisation,
     * never the source of truth: anything published while the socket was down is
     * unrecoverable from the socket itself. Merged by id so optimistic sends and
     * realtime echoes cannot duplicate.
     */
    const resyncThreadRef = useRef<() => Promise<void>>(async () => {});

    // Limit State
    const [messageCount, setMessageCount] = useState(0);
    const [messageLimit, setMessageLimit] = useState<number | null>(null);
    const [isLimitReached, setIsLimitReached] = useState(false);

    // 3. Handle Active Chat Selection & Message Loading
    useEffect(() => {
        if (!activeChat || !user) return;

        const [gigId, otherUserId] = activeChat.split('_');

        // Wire the catch-up read for THIS thread. Rebuilt whenever the open
        // conversation changes so a reconnect always refetches the right one.
        resyncThreadRef.current = async () => {
            const { data } = await supabase
                .from('messages')
                .select('*')
                .eq('gig_id', gigId)
                .order('created_at', { ascending: true });
            if (!data) return;
            const relevant = data.filter((m: any) =>
                (m.sender_id === user.id && m.receiver_id === otherUserId) ||
                (m.sender_id === otherUserId && m.receiver_id === user.id)
            );
            setMessages((prev: any[]) => {
                const seen = new Set(prev.map((m: any) => m.id));
                const merged = [...prev, ...relevant.filter((m: any) => !seen.has(m.id))];
                return merged.sort((a: any, b: any) => (a.created_at < b.created_at ? -1 : 1));
            });
        };

        // Find or Set Active Conversation Context
        const existingConv = conversations.find(c => c.conversationKey === activeChat);
        if (existingConv) {
            setActiveConversation(existingConv);
        } else {
            // Fallback for deep linking
            setActiveConversation({
                conversationKey: activeChat,
                gig_id: gigId,
                otherUserId: otherUserId,
                otherUser: { name: "Loading...", id: otherUserId }
            });
        }

        // Load Messages & Limits and set up real-time sub
        const loadMessagesAndLimits = async () => {
            // A. Load Messages
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('gig_id', gigId)
                .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
                .order('created_at', { ascending: true });

            if (data) {
                setMessages(data);
                const myCount = data.filter((m: any) =>
                    m.sender_id === user.id &&
                    m.message_type !== 'offer' &&
                    !magicChips.includes(m.content)
                ).length;
                setMessageCount(myCount);
                setTimeout(scrollToBottom, 50); // Initial scroll
            }

            // B. Check Gig Status & Limits
            const { data: gig } = await supabase
                .from('gigs')
                .select('status, listing_type, market_type, poster_id, price, is_physical')
                .eq('id', gigId)
                .single();

            if (gig) {
                setActiveGigStatus(gig.status);
                const isPoster = user.id === gig.poster_id;
                const isPreAgreement = gig.status === 'open';

                // The pre-agreement cap is enforced server-side in /api/chat/send
                // and is deliberately not surfaced here. This block previously
                // capped at 5, exempted KYC-verified users, and applied only to
                // applicants — none of which matched the server, so people were
                // shown one number and stopped by another.
                {
                    setMessageLimit(null);
                    setIsLimitReached(false);
                }
            }
        };
        loadMessagesAndLimits();

        // Cleanup old channel
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
        }

        // Real-time subscription for new messages
        const channel = supabase
            .channel(`messages_${gigId}_${otherUserId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `gig_id=eq.${gigId}`,
            }, (payload: any) => {
                const newMsg = payload.new as any;
                if (
                    (newMsg.sender_id === user.id && newMsg.receiver_id === otherUserId) ||
                    (newMsg.sender_id === otherUserId && newMsg.receiver_id === user.id)
                ) {
                    // Dedup by id: an optimistic send and the realtime echo are
                    // the same message and were both being appended.
                    setMessages(prev => prev.some((m: any) => m.id === newMsg.id) ? prev : [...prev, newMsg]);
                    
                    // Update limit counter if I sent the message
                    if (newMsg.sender_id === user.id && newMsg.message_type !== 'offer' && !magicChips.includes(newMsg.content)) {
                        setMessageCount(prev => prev + 1);
                    }

                    // Update conversation list last message
                    setConversations(prev => prev.map(c =>
                        c.conversationKey === activeChat
                            ? { ...c, lastMessage: newMsg }
                            : c
                    ));
                    scrollToBottom();

                    // Check for location alert
                    if (newMsg.message_type === 'system' && newMsg.content === 'LOCATION_ALERT' && newMsg.sender_id !== user.id) {
                        toast.success("🚨 The other user has arrived at the location!", { duration: 10000, position: 'top-center' });
                        playRingtone();
                        if ("vibrate" in navigator) {
                            navigator.vibrate([1000, 500, 1000, 500, 1000]);
                        }
                    }
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'gigs',
                filter: `id=eq.${gigId}`,
            }, (payload: any) => {
                setActiveGigStatus((payload.new as any).status);
            })
            .subscribe((status: string) => {
                // Same failure mode as the chat room: without a status handler a
                // dropped socket stops delivering messages silently while the
                // thread still looks live. Every reconnect re-reads the thread,
                // because events sent while we were down are gone for good.
                if (status === 'SUBSCRIBED') {
                    setLiveStatus('live');
                    void resyncThreadRef.current();
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                    setLiveStatus('reconnecting');
                }
            });

        channelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
        };

    }, [activeChat, user]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };


    // 4. Send Message Logic
    const sendMessage = async (e?: React.FormEvent, type: 'text' | 'image' | 'offer' | 'system' = 'text', contentUrl?: string, amount?: number) => {
        if (e) e.preventDefault();
        if (isSending) return; // Prevent double-send

        const text = contentUrl || newMessage.trim();
        if ((!text && type === 'text') || !user || !activeChat || (isLimitReached && type !== 'image')) return;

        setIsSending(true);

        const [gigId, otherUserId] = activeChat.split('_');
        if (type === 'text') setNewMessage(""); // Optimistic clear

        // A. Moderation (Fail-Open) - Skip for Images
        if (type === 'text') {
            try {
                const modRes = await fetch('/api/moderation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text })
                });

                if (modRes.ok) {
                    const aiCheck = await modRes.json();
                    if (!aiCheck.success) {
                        toast.error(`Message Blocked: ${aiCheck.reason}`);
                        return; // Stop here
                    }
                }
            } catch (warn) {
                console.warn("Moderation Network Error. Allowing message.", warn);
            }
        }

        // B. Send API
        try {
            const res = await fetch("/api/chat/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    gigId,
                    receiverId: otherUserId,
                    applicantId: otherUserId, // API key requirement if I am Poster
                    content: text,
                    type,
                    offerAmount: amount
                })
            });

            // Robust JSON Handling
            const raw = await res.text();
            let data;
            try {
                data = JSON.parse(raw);
            } catch {
                throw new Error("Server returned non-JSON response: " + raw);
            }

            if (!res.ok) {
                toast.error(data.message || friendlyHttpError(res.status, data.error));
                return;
            }

            // Success (Realtime will update UI)
            if (type === 'offer') {
                setIsOfferModalOpen(false);
                setOfferAmount("");
            }

        } catch (err: any) {
            toast.error(friendlyError(err));
        } finally {
            setIsSending(false);
        }
    };

    const sendOffer = () => {
        const amt = Number(offerAmount);
        if (!amt || amt <= 0) return;
        sendMessage(undefined, 'offer', '', amt);
    };

    const acceptOffer = async (msg: any) => {
        if (!confirm("Accept this offer? This will close the deal.")) return;

        try {
            const [gigId, otherUserId] = activeChat ? activeChat.split('_') : [null, null];

            const res = await fetch("/api/gig/accept-offer", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    gigId: msg.gig_id || gigId,
                    workerId: msg.sender_id, // The applicant who made the offer
                    price: msg.offer_amount
                })
            });

            if (res.ok) {
                toast.success("Offer accepted! This gig is now assigned.");
                setActiveGigStatus('assigned');
                setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, offer_status: 'accepted' } : m));
            } else {
                const json = await res.json().catch(() => ({}));
                toast.error(friendlyHttpError(res.status, json?.error));
            }
        } catch (e) {
            toast.error(friendlyError(e));
        }
    };

    const approveWork = async (gigId: string) => {
        if (!confirm("Approve the work and release funds? This will complete the deal.")) return;

        try {
            const res = await fetch("/api/gig/complete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    gigId: gigId,
                    rating: 5,
                    review: "Work approved via messages."
                })
            });

            if (res.ok) {
                toast.success("Work approved! Payout initiated.");
                setActiveGigStatus('completed');
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    gig_id: gigId,
                    content: "Work has been approved and funds released.",
                    message_type: 'system',
                    created_at: new Date().toISOString()
                }]);
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(friendlyHttpError(res.status, data?.error));
            }
        } catch (err) {
            toast.error(friendlyError(err));
        }
    };

    const raiseDispute = async (gigId: string) => {
        if (!disputeReason.trim()) return toast.error("Please provide a reason.");
        setIsDisputing(true);
        try {
            const res = await fetch("/api/gig/dispute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ gigId, reason: disputeReason })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success("Dispute raised. Escrow is frozen.");
                setShowDisputeModal(false);
                setActiveGigStatus('disputed');
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    gig_id: gigId,
                    content: "A dispute has been raised on this gig. Escrow is frozen.",
                    message_type: 'system',
                    created_at: new Date().toISOString()
                }]);
            } else {
                toast.error(friendlyHttpError(res.status, data?.error));
            }
        } catch (err) {
            toast.error(friendlyError(err));
        } finally {
            setIsDisputing(false);
        }
    };

    const requestChanges = async (gigId: string) => {
        if (!changesFeedback.trim()) return toast.error("Tell the worker what to change.");
        setIsRequestingChanges(true);
        try {
            const res = await fetch("/api/gig/request-changes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ gigId, feedback: changesFeedback })
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                toast.success("Changes requested. The worker can revise and resubmit.");
                setShowChangesModal(false);
                setChangesFeedback("");
                setActiveGigStatus('assigned');
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    gig_id: gigId,
                    content: `Changes requested:\n\n"${changesFeedback.trim()}"\n\nWorker can revise and resubmit.`,
                    message_type: 'system',
                    created_at: new Date().toISOString()
                }]);
            } else {
                toast.error(friendlyHttpError(res.status, data?.error));
            }
        } catch (err) {
            toast.error(friendlyError(err));
        } finally {
            setIsRequestingChanges(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) return toast.error("File size must be less than 5MB");
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return toast.error("Only JPG, PNG, WEBP allowed");

        setIsUploading(true);
        try {
            const gigId = activeChat ? activeChat.split('_')[0] : 'general';
            const upload = await compressImage(file, COMPRESS_PRESETS.attachment);
            const fileExt = upload.name.split('.').pop();
            const fileName = `${gigId}/${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('chat-attachments')
                .upload(fileName, upload);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('chat-attachments')
                .getPublicUrl(fileName);

            await sendMessage(undefined, 'image', publicUrl);

        } catch (err: any) {
            toast.error(friendlyError(err));
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };


    const isCompleted = activeGigStatus === 'completed' || activeGigStatus === 'cancelled' || activeGigStatus === 'disputed';
    const isPosterView = activeConversation?.gig?.poster_id === user?.id;
    const isPhysicalGig = activeConversation?.gig?.is_physical === true;
    const isMarketGig = false;
    // Approve/disapprove only valid for: poster, non-physical, non-market (Hustle remote), when delivered.
    // Accept legacy 'SUBMITTED' as well as the canonical 'delivered'.
    const canApproveOrDispute = isPosterView && !isPhysicalGig && !isMarketGig && (activeGigStatus === 'delivered' || activeGigStatus === 'SUBMITTED');

    // Update hasSentLocationAlert
    useEffect(() => {
        const sent = messages.some(m => m.sender_id === user?.id && m.content === 'LOCATION_ALERT' && m.message_type === 'system');
        setHasSentLocationAlert(sent);
    }, [messages, user?.id]);

    return (
        <div className="flex h-[100dvh] bg-[#0B0B11] text-white overflow-hidden font-sans selection:bg-brand-purple">

            {/* SIDEBAR */}
            <div className={`${activeChat ? 'hidden md:flex' : 'flex'} w-full md:w-[280px] flex-col border-r border-white/5 bg-[#0B0B11] shrink-0`}>
                <div className="p-3 border-b border-white/5 flex gap-2 items-center bg-[var(--card)]">
                    <button onClick={() => router.back()} className="p-1.5 -ml-1 hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-white">
                        <ArrowLeft size={16} />
                    </button>
                    <h1 className="text-base font-bold tracking-tight">Messages</h1>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading && conversations.length === 0 ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-white/60" /></div>
                    ) : conversations.length === 0 ? (
                        <div className="p-4">
                            <EmptyState
                                sloth="/sleeping_sloth.png"
                                title="Inbox zero. The sloth approves."
                                description="Apply to a task or post one — your chats with the other party will land here."
                                actionLabel="Browse tasks"
                                actionHref="/feed"
                            />
                        </div>
                    ) : (
                        conversations.map((chat) => {
                            const gigStatus = chat.gig?.status;
                            return (
                                <div
                                    key={chat.conversationKey}
                                    onClick={() => setActiveChat(chat.conversationKey)}
                                    className={`p-3 mx-2 my-1 rounded-xl cursor-pointer flex gap-3 transition hover:bg-white/5 ${activeChat === chat.conversationKey ? 'bg-white/10' : ''}`}
                                >
                                    <div className="relative shrink-0">
                                        <Avatar
                                            src={chat.otherUser.avatar_url}
                                            fallback={chat.otherUser.name || "?"}
                                            className="w-10 h-10"
                                            textClassName="text-sm"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-baseline mb-0.5">
                                            <h3 className="font-semibold text-white text-sm truncate">{chat.otherUser.name}</h3>
                                            <span className="text-[10px] text-white/40 ml-2 shrink-0">
                                                {formatSmartDate(chat.lastMessage.created_at)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-white/50 truncate">{chat.lastMessage.content}</p>
                                        {gigStatus && gigStatus !== 'open' && (
                                            <span className="mt-0.5 inline-block">
                                                <StatusBadge tone={statusToTone(gigStatus)}>
                                                    {gigStatus === 'completed'
                                                        ? 'Completed'
                                                        : (gigStatus === 'assigned' || gigStatus === 'delivered')
                                                            ? 'Hired'
                                                            : gigStatus}
                                                </StatusBadge>
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        }) ) }

                </div>
            </div>

            {/* CHAT AREA */}
            <div className={`${!activeChat ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-[#0B0B11] relative min-w-0`}>
                {activeChat ? (
                    <>
                        {/* Header */}
                        <div className="p-3 border-b border-white/5 bg-[var(--card)] flex items-center gap-3 z-20 shadow-sm">
                            <button onClick={() => setActiveChat(null)} className="p-2 -ml-1 hover:bg-white/10 rounded-full shrink-0" aria-label="Back">
                                <ArrowLeft size={18} />
                            </button>

                            <Avatar
                                src={activeConversation?.otherUser?.avatar_url}
                                fallback={activeConversation?.otherUser?.name || "?"}
                                className="w-8 h-8"
                                textClassName="text-xs"
                            />

                             <div className="min-w-0 flex-1">
                                <h2 className="font-bold text-white text-sm leading-tight truncate">
                                    {activeConversation?.otherUser?.name || "Loading..."}
                                </h2>
                                <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5">
                                    {activeConversation?.gig?.title && <span className="opacity-50 truncate">{activeConversation.gig.title}</span>}
                                    {activeGigStatus && (() => {
                                        const inReview = activeGigStatus === 'delivered' || activeGigStatus === 'SUBMITTED';
                                        const hired = activeGigStatus === 'assigned';
                                        const label = activeGigStatus === 'completed' ? 'Completed' : inReview ? 'In Review' : hired ? 'Hired' : activeGigStatus;
                                        const tone = activeGigStatus === 'completed' ? 'text-[var(--brand-purple-soft)] bg-[var(--brand-purple)]/10'
                                            : inReview ? 'text-[#C9A9FF] bg-[#C9A9FF]/10'
                                            : hired ? 'text-white/70 bg-white/10'
                                            : 'text-white/30';
                                        return <span className={`font-bold px-1.5 py-0.5 rounded-full ${tone}`}>{label}</span>;
                                    })()}
                                </div>
                            </div>

                            {/* Approve/Disapprove — Poster only, remote Hustle, status=delivered */}
                            {canApproveOrDispute && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => approveWork(activeConversation.gig_id)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--brand-purple)] hover:brightness-110 text-white rounded-xl text-xs font-bold transition active:scale-95 whitespace-nowrap"
                                    >
                                        <CheckCircle2 size={13} />
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => setShowChangesModal(true)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 rounded-xl text-xs font-bold transition active:scale-95 whitespace-nowrap"
                                    >
                                        <RotateCcw size={13} />
                                        Request changes
                                    </button>
                                    <button
                                        onClick={() => setShowDisputeModal(true)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/50 border border-white/10 rounded-xl text-xs font-bold transition active:scale-95 whitespace-nowrap"
                                    >
                                        <AlertTriangle size={13} />
                                        Dispute
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Telegram Alert Banner */}
                        {hasTelegramLinked === false && showTelegramBanner && activeGigStatus === 'open' && (
                            <div className="mx-4 mt-4 p-3 bg-brand-purple/10 border border-brand-purple/20 rounded-xl flex items-start gap-3 relative animate-in slide-in-from-top-2">
                                <button onClick={() => setShowTelegramBanner(false)} className="absolute top-2 right-2 text-brand-purple/70 hover:text-white transition-colors">
                                    <X size={14} />
                                </button>
                                <div className="p-1.5 bg-brand-purple/20 rounded-lg text-brand-purple shrink-0">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                                </div>
                                <div className="pr-6">
                                    <h3 className="text-brand-purple text-sm font-bold mb-0.5 flex items-center gap-2">
                                        Never miss a reply!
                                        <div className="group relative hidden md:block">
                                            <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[10px] cursor-help">?</span>
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-[#1A1A24] border border-white/10 rounded-lg text-[10px] text-white/70 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition text-center z-50">
                                                Web notifications only work when the app is open. Telegram ensures you get instantly notified.
                                            </div>
                                        </div>
                                    </h3>
                                    <p className="text-white/60 text-xs mb-2">Connect Telegram to get instant notifications even when you're away.</p>
                                    <Link href="/dashboard/settings" className="inline-block px-3 py-1.5 bg-brand-purple hover:bg-brand-purple/90 text-white text-xs font-bold rounded-lg transition-colors shadow-lg shadow-brand-purple/20 active:scale-95">Link Telegram Now</Link>
                                </div>
                            </div>
                        )}

                        {/* OFFER MODAL */}
                        {isOfferModalOpen && (
                            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                                <div className="bg-[#1A1A24] border border-white/10 rounded-3xl p-6 w-full max-w-sm relative">
                                    <button
                                        onClick={() => setIsOfferModalOpen(false)}
                                        className="absolute top-4 right-4 text-white/60 hover:text-white"
                                    >
                                        <X size={20} />
                                    </button>
                                    <h3 className="text-xl font-bold mb-1">Make an Offer</h3>
                                    <p className="text-white/50 text-xs mb-6">Propose a new price for this item.</p>

                                    <div className="space-y-4">
                                        <input
                                            type="number"
                                            value={offerAmount}
                                            onChange={(e) => setOfferAmount(e.target.value)}
                                            placeholder="Enter amount (₹)"
                                            className="w-full bg-black/20 text-white p-4 rounded-xl border border-white/10 focus:border-brand-purple outline-none text-lg font-bold"
                                        />
                                        <button
                                            onClick={sendOffer}
                                            disabled={!offerAmount || Number(offerAmount) <= 0}
                                            className="w-full py-3 bg-brand-purple text-white font-bold rounded-xl active:scale-95 transition shadow-lg shadow-brand-purple/20"
                                        >
                                            Send Offer
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Messages Feed */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 bg-[#0B0B11] relative">
                            {/* Chat Wallpaper Dots */}
                            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

                            {messages.map((msg) => {
                                const isMe = msg.sender_id === user?.id;
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} relative z-10`}>
                                        {msg.message_type === 'offer' ? (
                                            // OFFER CARD UI
                                            <div className={`max-w-[85%] md:max-w-[300px] w-full rounded-2xl overflow-hidden border ${isMe ? 'border-[#8825F5]/50 bg-[#8825F5]/5' : 'border-white/10 bg-[#1A1A24]'}`}>
                                                <div className="p-4 bg-white/10 border-b border-white/5 flex justify-between items-center">
                                                    <span className="text-xs font-bold uppercase tracking-wider text-white/60">
                                                        {isMe ? "You sent an offer" : "Received Offer"}
                                                    </span>
                                                    <IndianRupee size={14} className="text-[#8825F5]" />
                                                </div>
                                                <div className="p-6 flex flex-col items-center gap-2">
                                                    <div className="text-3xl font-semibold text-white tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                                                        ₹{msg.offer_amount}
                                                    </div>
                                                    <p className="text-[10px] text-white/60">
                                                        {isMe ? "Waiting for response..." : "Proposed price"}
                                                    </p>
                                                </div>
                                                {/* Actions for Receiver (Poster) */}
                                                {!isMe && activeConversation?.gig?.poster_id === user.id && activeConversation.gig.status === 'open' && (
                                                    <div className="p-2 grid grid-cols-2 gap-2 bg-black/20">
                                                        <button
                                                            onClick={() => sendMessage(undefined, 'text', `I've declined the offer of ₹${msg.offer_amount}.`)}
                                                            className="py-2 rounded-lg bg-white/5 text-white/70 border border-white/10 text-xs font-semibold hover:bg-white/10 transition-colors"
                                                        >
                                                            Decline
                                                        </button>
                                                        <button
                                                            onClick={() => acceptOffer(msg)}
                                                            className="py-2 rounded-lg bg-[var(--brand-purple)] text-white text-xs font-semibold hover:brightness-110 transition"
                                                        >
                                                            Accept
                                                        </button>
                                                    </div>
                                                )}
                                                <div className="px-4 py-2 text-[9px] text-right opacity-30 font-mono">
                                                    {formatSmartDate(msg.created_at)}
                                                </div>
                                            </div>
                                        ) : msg.message_type === 'system' && msg.content === 'LOCATION_ALERT' ? (
                                            <div className={`max-w-[85%] md:max-w-[65%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm break-words ${isMe ? 'bg-red-500/20 border border-red-500/30 text-white rounded-tr-sm' : 'bg-red-500/10 border border-red-500/20 text-red-400 rounded-tl-sm'}`}>
                                                <div className="flex items-center gap-2 font-bold mb-1">
                                                    <AlertTriangle size={16} className={isMe ? 'text-white' : 'text-red-400'} />
                                                    {isMe ? "You arrived at the location" : "User arrived at the location"}
                                                </div>
                                                <div className={`text-[9px] mt-1 text-right font-mono ${isMe ? 'text-white/60' : 'text-red-400/50'}`}>
                                                    {formatSmartDate(msg.created_at)}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className={`max-w-[85%] md:max-w-[65%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm break-words ${isMe
                                                ? 'bg-[#8825F5] text-white rounded-tr-sm'
                                                : 'bg-[#1A1A24] border border-white/5 text-white/90 rounded-tl-sm'
                                                }`}>
                                                {msg.message_type === 'image' ? (
                                                    <div className="relative cursor-zoom-in" onClick={() => setSelectedImage(msg.content)}>
                                                        <div className="relative w-full aspect-video bg-black/20 rounded-lg overflow-hidden mb-1">
                                                            <Image
                                                                src={msg.content}
                                                                alt="Attachment"
                                                                fill
                                                                className="object-cover"
                                                                unoptimized
                                                            />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    msg.content
                                                )}
                                                <div className={`text-[9px] mt-1 text-right font-mono ${isMe ? 'text-white/60' : 'text-white/50'}`}>
                                                    {formatSmartDate(msg.created_at)}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Completed Banner & Input */}
                        <div className="bg-[var(--card)] border-t border-white/5 z-20">
                            {isCompleted ? (
                                <div className="px-4 py-3 flex items-center justify-center gap-2 text-sm text-white/60 bg-white/[0.03] border-b border-white/[0.06]">
                                    <CheckCircle2 size={15} className="text-[var(--brand-purple-soft)]" />
                                    {activeGigStatus === 'completed' ? 'Deal completed. Chat is now closed.' : 'Gig cancelled. Chat is closed.'}
                                </div>
                            ) : (
                                <div className="p-3">
                                    {liveStatus === 'reconnecting' && (
                                        <div
                                            role="status"
                                            aria-live="polite"
                                            className="mb-2 px-3 py-2 flex items-center justify-center gap-2 text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-xl"
                                        >
                                            Reconnecting — new messages will appear once you&apos;re back online.
                                        </div>
                                    )}

                                    {(isPhysicalGig || isMarketGig) && (activeGigStatus === 'assigned' || activeGigStatus === 'delivered') && !hasSentLocationAlert && user && (
                                        <div className="mb-3 px-1">
                                            <button
                                                type="button"
                                                onClick={() => sendMessage(undefined, 'system', 'LOCATION_ALERT')}
                                                disabled={isSending}
                                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-semibold hover:bg-red-500/20 transition-colors disabled:opacity-50"
                                            >
                                                <MapPin size={16} /> I&apos;m here at the location (notify)
                                            </button>
                                        </div>
                                    )}

                                    <form onSubmit={(e) => sendMessage(e)} className="flex gap-2 max-w-4xl mx-auto relative items-center">
                                        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept="image/jpeg,image/png,image/webp" />
                                        {/* Removed Offer Button */}
                                        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isLimitReached || isUploading}
                                            className="p-2.5 bg-[#1A1A24] hover:bg-[#2A2A35] rounded-full text-white/50 border border-white/10 disabled:opacity-50 shrink-0"
                                        >
                                            {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
                                        </button>
                                        <input
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            placeholder={isLimitReached ? "Waiting for acceptance..." : "Type a message..."}
                                            disabled={isLimitReached}
                                            className="flex-1 bg-[#1A1A24] text-white text-sm px-4 py-2.5 rounded-full border border-white/10 focus:border-[#8825F5] focus:ring-1 focus:ring-[#8825F5]/20 outline-none transition disabled:opacity-50 min-w-0"
                                        />
                                        <button type="submit" disabled={!newMessage.trim() || isLimitReached || isSending}
                                            className="p-2.5 bg-[var(--brand-purple)] hover:brightness-110 transition disabled:opacity-50 text-white rounded-full shrink-0"
                                        >
                                            <Send size={16} className="translate-x-0.5" />
                                        </button>
                                    </form>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#0B0B11] relative overflow-hidden">
                        {/* Subtle background glow */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-purple/5 rounded-full blur-[100px] pointer-events-none"></div>
                        
                        <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6 relative z-10 shadow-xl shadow-black/50">
                            <Send size={32} className="text-brand-purple opacity-80 translate-x-1" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2 relative z-10">Your Messages</h2>
                        <p className="text-white/50 text-sm mb-10 max-w-sm text-center relative z-10 leading-relaxed">
                            Select a conversation from the sidebar or post a new Hustle to begin chatting.
                        </p>

                        {!hasTelegramLinked && hasTelegramLinked !== null && (
                            <div className="max-w-md w-full bg-[var(--card)] border border-white/10 rounded-2xl p-5 relative z-10 hover:border-brand-purple/30 transition-colors group">
                                <div className="flex flex-col sm:flex-row items-start gap-4">
                                    <div className="bg-brand-purple/10 p-3 rounded-xl shrink-0">
                                        <Send className="w-6 h-6 text-brand-purple" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-white font-bold text-sm mb-1 flex items-center gap-2 flex-wrap">
                                            Never miss a message
                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-brand-purple/20 text-brand-purple uppercase tracking-wider shrink-0">Recommended</span>
                                        </h3>
                                        <p className="text-xs text-white/50 mb-3 leading-relaxed">
                                            Connect your Telegram to get instant notifications when someone messages you or arrives at a location.
                                        </p>
                                        <Link href="/dashboard/settings" className="inline-flex items-center justify-center px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg transition-colors group-hover:bg-brand-purple w-full sm:w-auto">
                                            Connect Telegram
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Lightbox */}
            {selectedImage && (
                <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setSelectedImage(null)}>
                    <button className="absolute top-6 right-6 p-4 bg-white/10 rounded-full text-white hover:bg-white/20 transition"><X className="w-8 h-8" /></button>
                    <div className="relative w-full max-w-6xl h-full max-h-[85vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()} >
                        <Image src={selectedImage || ""} alt="Fullscreen Attachment" fill className="object-contain" unoptimized quality={100} />
                    </div>
                </div>
            )}

            {/* Dispute Modal — Poster only, for remote hustle gigs */}
            {showDisputeModal && activeConversation && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-[#1A1A24] border border-red-500/30 rounded-3xl p-6 max-w-sm w-full animate-in zoom-in-95 relative shadow-[0_0_40px_rgba(239,68,68,0.15)]">
                        <button onClick={() => setShowDisputeModal(false)} className="absolute top-4 right-4 text-white/60 hover:text-white">
                            <X size={18} />
                        </button>
                        <div className="w-10 h-10 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto mb-3">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-center mb-1">Raise a Dispute</h3>
                        <p className="text-center text-white/50 text-xs mb-4">Escrow will be frozen. Our team reviews within 24h.</p>
                        <textarea
                            value={disputeReason}
                            onChange={(e) => setDisputeReason(e.target.value)}
                            placeholder="Describe what was not delivered as agreed…"
                            className="w-full bg-black/20 text-white text-sm p-4 rounded-xl border border-white/10 focus:border-red-500/50 outline-none resize-none h-28 mb-4"
                        />
                        <button
                            onClick={() => raiseDispute(activeConversation.gig_id)}
                            disabled={isDisputing || !disputeReason.trim()}
                            className="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50"
                        >
                            {isDisputing ? <Loader2 size={16} className="animate-spin" /> : <AlertTriangle size={16} />}
                            Freeze & Raise Dispute
                        </button>
                    </div>
                </div>
            )}

            {/* Request Changes Modal — Poster only, lightweight revision loop */}
            {showChangesModal && activeConversation && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-[#1A1A24] border border-white/10 rounded-3xl p-6 max-w-sm w-full animate-in zoom-in-95 relative">
                        <button onClick={() => setShowChangesModal(false)} className="absolute top-4 right-4 text-white/60 hover:text-white">
                            <X size={18} />
                        </button>
                        <div className="w-10 h-10 bg-[var(--brand-purple)]/15 text-[var(--brand-purple-soft)] rounded-full flex items-center justify-center mx-auto mb-3">
                            <RotateCcw className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-center mb-1">Request changes</h3>
                        <p className="text-center text-white/50 text-xs mb-4">The worker revises and resubmits. Funds stay safely held, no dispute.</p>
                        <textarea
                            value={changesFeedback}
                            onChange={(e) => setChangesFeedback(e.target.value)}
                            placeholder="What needs to change? Be specific so they can fix it fast…"
                            className="w-full bg-black/20 text-white text-sm p-4 rounded-xl border border-white/10 focus:border-[var(--brand-purple)]/50 outline-none resize-none h-28 mb-4"
                        />
                        <button
                            onClick={() => requestChanges(activeConversation.gig_id)}
                            disabled={isRequestingChanges || !changesFeedback.trim()}
                            className="w-full py-3 bg-[var(--brand-purple)] hover:brightness-110 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50"
                        >
                            {isRequestingChanges ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                            Send back for changes
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}

function formatSmartDate(dateString: string) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) return time;
    if (isYesterday) return `Yesterday, ${time}`;
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
}
