"use client";

import { useEffect, useState, useRef } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { containsSensitiveInfo } from "@/lib/moderation";
import Image from "next/image";
import Link from "next/link";
import { Send, ArrowLeft, MoreVertical, Phone, Video, Search, Star } from "lucide-react";

export default function ChatPage() {
    const supabase = supabaseBrowser();
    const [user, setUser] = useState<any>(null);
    const [conversations, setConversations] = useState<any[]>([]);
    const [activeChat, setActiveChat] = useState<string | null>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Fetch User
    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) {
                setUser(data.user);
                fetchConversations(data.user.id);
            }
        });
    }, []);

    // Fetch Conversations (Robust: Split Queries to avoid Join/RLS recursion)
    const fetchConversations = async (userId: string) => {
        try {
            setLoading(true);

            // 1. Fetch Messages
            const { data: messages, error: msgError } = await supabase
                .from('messages')
                .select(`
          *,
          gig:gigs!gig_id(title, listing_type)
        `)
                .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
                .order('created_at', { ascending: false });

            if (msgError) throw msgError;

            if (messages && messages.length > 0) {
                // 2. Collect Unique User IDs (Sender & Receiver)
                const userIds = new Set<string>();
                messages.forEach((m: any) => {
                    if (m.sender_id) userIds.add(m.sender_id);
                    if (m.receiver_id) userIds.add(m.receiver_id);
                });

                // 3. Fetch User Details
                const { data: users, error: userError } = await supabase
                    .from('users')
                    .select('id, name, avatar_url, rating, rating_count, jobs_completed')
                    .in('id', Array.from(userIds));

                if (userError) {
                    console.error("Error fetching chat users:", userError.message, userError.details, userError.hint);
                }

                const userMap = new Map();
                users?.forEach((u: any) => userMap.set(u.id, u));

                // 4. Map Conversations
                const conversationMap = new Map();

                messages.forEach((msg: any) => {
                    // Identify the "Other User"
                    const isSender = msg.sender_id === userId;
                    const otherUserId = isSender ? msg.receiver_id : msg.sender_id;

                    // Skip if no other user ID (shouldn't happen in 1:1)
                    if (!otherUserId) return;

                    const key = `${msg.gig_id}_${otherUserId}`;

                    if (!conversationMap.has(key)) {
                        const otherUser = userMap.get(otherUserId) || {
                            name: "Unknown User",
                            avatar_url: null,
                            rating: "N/A",
                            rating_count: 0,
                            jobs_completed: 0
                        };

                        conversationMap.set(key, {
                            ...msg,
                            otherUser,
                            conversationKey: key,
                            // Attach resolved sender/receiver for the chat view
                            sender: userMap.get(msg.sender_id),
                            receiver: userMap.get(msg.receiver_id)
                        });
                    }
                });

                setConversations(Array.from(conversationMap.values()));
            } else {
                setConversations([]);
            }
        } catch (err: any) {
            console.error("Error loading chats:", err.message || err);
        } finally {
            setLoading(false);
        }
    };

    // Subscribe to Realtime Messages
    useEffect(() => {
        if (!activeChat || !user) return; // Ensure user is loaded

        // Parse the active chat key to get filters
        // activeChat is now "gigId_otherUserId"
        const [gigId, otherUserId] = activeChat.split('_');
        if (!gigId || !otherUserId) return;

        const loadMessages = async () => {
            const { data } = await supabase
                .from('messages')
                .select('*')
                .eq('gig_id', gigId)
                .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
                .order('created_at', { ascending: true });

            if (data) setMessages(data);
        };
        loadMessages();

        // Enhanced Realtime Subscription
        // Note: RLS might filter this, but for now we listen to the table
        const channel = supabase.channel(`chat_${activeChat}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `gig_id=eq.${gigId}`
            },
                (payload) => {
                    // Only add if it belongs to this specific conversation
                    const msg = payload.new;
                    if (
                        (msg.sender_id === user.id && msg.receiver_id === otherUserId) ||
                        (msg.sender_id === otherUserId && msg.receiver_id === user.id)
                    ) {
                        setMessages(prev => [...prev, msg]);
                        scrollToBottom();
                    }
                })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [activeChat, user]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // --- MODERATION & LIMITS ---
    const checkLimits = () => {
        if (!activeChat || !user) return false;

        const chat = conversations.find(c => c.conversationKey === activeChat);
        if (!chat || !chat.gig) return true; // Fail safe

        // 1. If Gig is Assigned/Completed/Sold -> UNLIMITED
        // (In a real app, we'd fetch the latest status, but for now relies on chat.gig which might be stale. 
        //  ideally we fetch gig details when opening chat)
        // For robustness, let's assume if we are in a chat, we want to enforce limits unless we know otherwise.
        // We'll trust the loaded messages count for now.

        const myMessagesCount = messages.filter(m => m.sender_id === user.id).length;
        const limit = chat.gig.listing_type === 'MARKET' ? 4 : 2;

        if (myMessagesCount >= limit) {
            return false;
        }
        return true;
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !user || !activeChat) return;

        // 1. Content Moderation
        const modification = containsSensitiveInfo(newMessage);
        if (modification.detected) {
            alert(`Subject to Moderation: ${modification.reason}`);
            return;
        }

        // 2. Check Limits
        if (!checkLimits()) {
            // Re-check logic: If I am the poster, I should have a button to Hire. 
            // If I am the worker, I am blocked.
            // We'll handle the UI blocking in the Render, but double check here.
            alert("Message limit reached. Please hire the worker (or wait to be hired) to continue chatting.");
            return;
        }

        const [gigId, otherUserId] = activeChat.split('_');

        const { error } = await supabase.from('messages').insert({
            gig_id: gigId,
            sender_id: user.id,
            receiver_id: otherUserId,
            content: newMessage,
        });

        if (error) alert("Failed to send");
        else setNewMessage("");
    };

    return (
        <div className="flex h-screen bg-[#0B0B11] text-white overflow-hidden">

            {/* SIDEBAR (Conversations) */}
            <div className={`${activeChat ? 'hidden md:flex' : 'flex'} w-full md:w-[400px] flex-col border-r border-white/5`}>
                <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#121217]">
                    <h1 className="text-xl font-bold">Messages</h1>
                    <div className="flex gap-2">
                        <button className="p-2 hover:bg-white/10 rounded-full"><MoreVertical size={20} /></button>
                    </div>
                </div>

                <div className="p-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 text-white/40 w-4 h-4" />
                        <input placeholder="Search chats..." className="w-full bg-white/5 rounded-xl pl-10 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:bg-white/10 transition-colors" />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? <div className="p-4 text-center text-white/40">Loading...</div> : (
                        conversations.map((chat: any) => (
                            <div key={chat.gig_id} onClick={() => setActiveChat(chat.gig_id)} className={`p-4 hover:bg-white/5 cursor-pointer flex gap-4 transition-colors ${activeChat === chat.gig_id ? 'bg-white/5' : ''}`}>
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-purple to-brand-blue flex items-center justify-center text-lg font-bold">
                                    {chat.gig?.title?.[0] || "?"}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h3 className="font-bold truncate text-white/90">{chat.gig?.title || "Unknown Gig"}</h3>
                                        <span className="text-[10px] text-white/40">
                                            {new Date(chat.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-sm text-white/50 truncate">{chat.content}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* MAIN CHAT AREA */}
            <div className={`${!activeChat ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-[#0B0B11] relative`}>
                {activeChat ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-4 border-b border-white/5 bg-[#121217] flex items-center justify-between shadow-sm z-10">
                            <div className="flex items-center gap-4">
                                <button onClick={() => setActiveChat(null)} className="md:hidden p-2 -ml-2 hover:bg-white/10 rounded-full"><ArrowLeft size={20} /></button>

                                {/* Avatar */}
                                <div className="w-10 h-10 rounded-full bg-zinc-800 border border-white/5 overflow-hidden relative">
                                    {conversations.find(c => c.conversationKey === activeChat)?.otherUser?.avatar_url ? (
                                        <Image src={conversations.find(c => c.conversationKey === activeChat)?.otherUser?.avatar_url} alt="Ava" fill className="object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-white/40 font-bold">
                                            {conversations.find(c => c.conversationKey === activeChat)?.otherUser?.name?.[0] || "?"}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <h2 className="font-bold text-white leading-tight">
                                        {conversations.find(c => c.conversationKey === activeChat)?.otherUser?.name || "Unknown User"}
                                    </h2>
                                    <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                                        <span className="flex items-center gap-0.5 text-yellow-500">
                                            <Star size={10} fill="currentColor" />
                                            {(conversations.find(c => c.conversationKey === activeChat)?.otherUser?.rating_count || 0) > 0
                                                ? conversations.find(c => c.conversationKey === activeChat)?.otherUser?.rating
                                                : "New"}
                                        </span>
                                        <span>•</span>
                                        <span>{(conversations.find(c => c.conversationKey === activeChat)?.otherUser?.jobs_completed || 0)} Jobs</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <button className="p-2 hover:bg-white/10 rounded-full text-white/60"><Phone size={20} /></button>
                                <button className="p-2 hover:bg-white/10 rounded-full text-white/60"><Video size={20} /></button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#050505]">
                            {messages.map((msg: any) => {
                                const isMe = msg.sender_id === user?.id;
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] rounded-2xl p-3 px-4 ${isMe ? 'bg-brand-purple text-white rounded-tr-none' : 'bg-[#1A1A24] text-white/90 rounded-tl-none'}`}>
                                            <p className="text-sm">{msg.content}</p>
                                            <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-white/60' : 'text-white/40'}`}>
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-[#121217] border-t border-white/5">
                            <form onSubmit={sendMessage} className="flex items-center gap-2">
                                <input
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type a message..."
                                    className="flex-1 bg-white/5 rounded-full px-6 py-3 text-sm text-white focus:outline-none focus:bg-white/10 transition-colors"
                                />
                                <button type="submit" className="p-3 bg-brand-purple rounded-full text-white hover:bg-brand-purple/90 transition-colors shadow-lg shadow-brand-purple/20">
                                    <Send size={20} />
                                </button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center flex-col text-white/20">
                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4">
                            <Send size={40} />
                        </div>
                        <p>Select a conversation to start chatting</p>
                    </div>
                )}
            </div>
        </div>
    );
}
