"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Image from "next/image";
import Link from "next/link";
import { Send, ArrowLeft, MoreVertical, Phone, Video, Search, Star, AlertTriangle, User, Loader2 } from "lucide-react";

export default function ChatPage() {
    const supabase = supabaseBrowser();
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [conversations, setConversations] = useState<any[]>([]);
    const [activeChat, setActiveChat] = useState<string | null>(null);

    // Active Conversation Data (Derived or Fetched)
    const [activeConversation, setActiveConversation] = useState<any>(null);

    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 1. Initialize User
    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) {
                setUser(data.user);
                fetchInitialData(data.user.id);
            }
        });
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
                  gig:gigs!gig_id(title, listing_type, poster_id, assigned_worker_id)
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

                const userMap = new Map((users || []).map(u => [u.id, u]));

                // D. Attach Profiles to Conversations
                const derivedConversations = Array.from(conversationMap.values()).map(conv => {
                    const profile = userMap.get(conv.otherUserId);
                    return {
                        ...conv,
                        otherUser: profile || {
                            id: conv.otherUserId,
                            name: "Unknown User",
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

    // Limit State
    const [messageCount, setMessageCount] = useState(0);
    const [messageLimit, setMessageLimit] = useState<number | null>(null);
    const [isLimitReached, setIsLimitReached] = useState(false);

    // 3. Handle Active Chat Selection & Message Loading
    useEffect(() => {
        if (!activeChat || !user) return;

        const [gigId, otherUserId] = activeChat.split('_');

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

        const magicChips = [
            "Available?", "Best Price?", "Where to meet?", "Can I see more pics?",
            "I'm interested!", "My Portfolio", "Can do in 1 day", "Let's discuss!"
        ];

        // Load Messages & Limits
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
                // Count MY messages in this chat (Exclude Offers AND Magic Chips)
                const myCount = data.filter((m: any) =>
                    m.sender_id === user.id &&
                    m.message_type !== 'offer' &&
                    !magicChips.includes(m.content)
                ).length;
                setMessageCount(myCount);
            }

            // B. Check Gig Status & Limits
            const { data: gig } = await supabase
                .from('gigs')
                .select('status, listing_type, poster_id')
                .eq('id', gigId)
                .single();

            if (gig) {
                const isPoster = user.id === gig.poster_id;
                const isPreAgreement = gig.status === 'open';

                if (!isPoster && isPreAgreement) {
                    // Applicant Logic
                    const limit = gig.listing_type === 'MARKET' ? 5 : 2;
                    setMessageLimit(limit);

                    // Recalculate isLimitReached with the correct count
                    const myCount = data?.filter((m: any) =>
                        m.sender_id === user.id &&
                        m.message_type !== 'offer' &&
                        !magicChips.includes(m.content)
                    ).length || 0;

                    setIsLimitReached(myCount >= limit);
                } else {
                    // Poster or Hired -> No Limit
                    setMessageLimit(null);
                    setIsLimitReached(false);
                }
            }
        };
        loadMessagesAndLimits();

        // Subscribe to New Messages
        const channel = supabase.channel(`chat_${gigId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `gig_id=eq.${gigId}`
            }, (payload) => {
                const newMsg = payload.new;
                // Filter ensuring it belongs to THIS 1:1 chat
                if (
                    (newMsg.sender_id === user.id && newMsg.receiver_id === otherUserId) ||
                    (newMsg.sender_id === otherUserId && newMsg.receiver_id === user.id)
                ) {
                    setMessages(prev => {
                        const updated = [...prev, newMsg];
                        // Update Count & Limit if I sent it
                        if (newMsg.sender_id === user.id && messageLimit) {
                            const newCount = updated.filter(m =>
                                m.sender_id === user.id &&
                                m.message_type !== 'offer' &&
                                !magicChips.includes(m.content)
                            ).length;
                            setMessageCount(newCount);
                            setIsLimitReached(newCount >= messageLimit);
                        }
                        return updated;
                    });
                    scrollToBottom();
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };

    }, [activeChat, user, conversations]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };


    // 4. Send Message Logic
    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !user || !activeChat || isLimitReached) return;

        const [gigId, otherUserId] = activeChat.split('_');
        const text = newMessage.trim();
        setNewMessage(""); // Optimistic clear

        // A. Moderation (Fail-Open)
        try {
            const modRes = await fetch('/api/moderation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });

            if (modRes.ok) {
                const aiCheck = await modRes.json();
                if (!aiCheck.success) {
                    alert(`Message Blocked: ${aiCheck.reason}`);
                    return; // Stop here
                }
            } else {
                console.warn("Moderation API failed (500). Allowing message.");
            }
        } catch (warn) {
            console.warn("Moderation Network Error. Allowing message.", warn);
        }

        // B. Send API
        try {
            const res = await fetch("/api/chat/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    gigId,
                    // Fix: Send BOTH receiverId and applicantId to be safe
                    receiverId: otherUserId,
                    applicantId: otherUserId, // API key requirement if I am Poster
                    content: text
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
                alert(data.message || data.error || "Failed to send.");
                return;
            }

            // Success (Realtime will update UI)

        } catch (err: any) {
            console.error("Send Error:", err);
            alert("Failed to send message. Please try again.");
        }
    };


    return (
        <div className="flex h-screen bg-[#0B0B11] text-white overflow-hidden font-sans selection:bg-brand-purple">

            {/* SIDEBAR */}
            <div className={`${activeChat ? 'hidden md:flex' : 'flex'} w-full md:w-[380px] flex-col border-r border-white/5 bg-[#0B0B11]`}>
                <div className="p-5 border-b border-white/5 flex gap-4 items-center bg-[#121217]">
                    <button onClick={() => router.back()} className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-white">
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="text-xl font-bold tracking-tight">Messages</h1>
                    <div className="flex-1"></div>
                    <button className="p-2 hover:bg-white/10 rounded-full transition-colors"><MoreVertical size={18} /></button>
                </div>

                <div className="p-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 text-white/30 w-4 h-4" />
                        <input className="w-full bg-[#1A1A24] rounded-xl pl-10 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-brand-purple/50 transition-all" placeholder="Search conversations..." />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading && conversations.length === 0 ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-white/20" /></div>
                    ) : conversations.length === 0 ? (
                        <div className="p-8 text-center text-white/40 text-sm">No messages yet.</div>
                    ) : (
                        conversations.map((chat) => (
                            <div
                                key={chat.conversationKey}
                                onClick={() => setActiveChat(chat.conversationKey)}
                                className={`p-4 mx-2 rounded-xl cursor-pointer flex gap-4 transition-all hover:bg-white/5 ${activeChat === chat.conversationKey ? 'bg-white/10' : ''}`}
                            >
                                <div className="relative shrink-0">
                                    <div className="w-12 h-12 rounded-full bg-[#2A2A35] flex items-center justify-center overflow-hidden border border-white/5">
                                        {chat.otherUser.avatar_url ? (
                                            <Image src={chat.otherUser.avatar_url} alt="" fill className="object-cover" />
                                        ) : (
                                            <User className="w-5 h-5 text-white/40" />
                                        )}
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h3 className="font-semibold text-white truncate">{chat.otherUser.name}</h3>
                                        <span className="text-[10px] text-white/30 ml-2 shrink-0">
                                            {new Date(chat.lastMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-sm text-white/50 truncate pr-4">{chat.lastMessage.content}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* CHAT AREA */}
            <div className={`${!activeChat ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-[#050505] relative`}>
                {activeChat ? (
                    <>
                        {/* Header */}
                        <div className="p-4 border-b border-white/5 bg-[#121217] flex items-center justify-between z-20 shadow-xl">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setActiveChat(null)} className="md:hidden p-2 -ml-2 hover:bg-white/10 rounded-full"><ArrowLeft size={20} /></button>

                                <div className="w-10 h-10 rounded-full bg-[#2A2A35] flex items-center justify-center overflow-hidden border border-white/10 relative">
                                    {activeConversation?.otherUser?.avatar_url ? (
                                        <Image src={activeConversation.otherUser.avatar_url} alt="" fill className="object-cover" />
                                    ) : (
                                        <User className="w-5 h-5 text-white/40" />
                                    )}
                                </div>

                                <div>
                                    <h2 className="font-bold text-white text-sm md:text-base leading-tight">
                                        {activeConversation?.otherUser?.name || "Loading..."}
                                    </h2>
                                    <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5">
                                        {activeConversation?.otherUser?.rating ? (
                                            <span className="flex items-center gap-1 text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded">
                                                <Star size={10} fill="currentColor" /> {activeConversation.otherUser.rating}
                                            </span>
                                        ) : <span className="text-white/20">New User</span>}

                                        {activeConversation?.gig?.title && <span className="opacity-50 truncate max-w-[150px]">• {activeConversation.gig.title}</span>}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                {/* Actions removed as per user request */}
                            </div>
                        </div>

                        {/* Messages Feed */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 bg-[#050505] relative">
                            {/* Chat Wallpaper Dots */}
                            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

                            {messages.map((msg) => {
                                const isMe = msg.sender_id === user?.id;
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} relative z-10`}>
                                        <div className={`max-w-[85%] md:max-w-[65%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm break-words ${isMe
                                            ? 'bg-[#8825F5] text-white rounded-tr-sm'
                                            : 'bg-[#1A1A24] border border-white/5 text-white/90 rounded-tl-sm'
                                            }`}>
                                            {msg.content}
                                            <div className={`text-[9px] mt-1 text-right font-mono ${isMe ? 'text-white/60' : 'text-white/30'}`}>
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="p-4 bg-[#121217] border-t border-white/5 z-20">
                            {/* Limit Warning Badge */}
                            {messageLimit && (
                                <div className={`mb-3 flex justify-center ${isLimitReached ? 'animate-pulse' : ''}`}>
                                    <span className={`text-xs px-3 py-1 rounded-full border ${isLimitReached
                                        ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                        : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                                        }`}>
                                        {isLimitReached
                                            ? "Limit Reached. Wait for the poster to accept your proposal."
                                            : `${messageLimit - messageCount} messages left before acceptance`
                                        }
                                    </span>
                                </div>
                            )}

                            <form onSubmit={sendMessage} className="flex gap-3 max-w-4xl mx-auto relative">
                                {isLimitReached && (
                                    <div className="absolute inset-0 bg-[#121217]/60 z-10 flex items-center justify-center backdrop-blur-[1px] rounded-full cursor-not-allowed">
                                        <span className="text-xs font-bold text-white/50 bg-black/40 px-3 py-1 rounded-full">
                                            Reply Halted (Pending Approval)
                                        </span>
                                    </div>
                                )}

                                <input
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder={isLimitReached ? "Waiting for acceptance..." : "Type a message..."}
                                    disabled={isLimitReached}
                                    className={`flex-1 bg-[#1A1A24] text-white text-sm px-5 py-3 rounded-full border border-white/10 focus:border-[#8825F5] focus:ring-1 focus:ring-[#8825F5]/20 outline-none transition-all ${isLimitReached ? 'opacity-50' : ''}`}
                                />
                                <button
                                    type="submit"
                                    disabled={!newMessage.trim() || isLimitReached}
                                    className={`p-3 bg-[#8825F5] hover:bg-[#7b1dd1] disabled:opacity-50 disabled:scale-95 text-white rounded-full shadow-lg shadow-[#8825F5]/20 transition-all ${isLimitReached ? 'grayscale opacity-30' : ''}`}
                                >
                                    <Send size={18} className="translate-x-0.5" />
                                </button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-white/30 gap-4">
                        <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-2 animate-pulse">
                            <Send size={40} className="opacity-50" />
                        </div>
                        <p>Select a chat to start messaging</p>
                    </div>
                )}
            </div>

        </div>
    );
}
