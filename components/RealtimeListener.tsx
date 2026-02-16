
"use client";

import { useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function RealtimeListener() {
    const supabase = supabaseBrowser();
    const router = useRouter();

    useEffect(() => {
        const setupListener = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. MESSAGES LISTENER
            const msgChannel = supabase
                .channel('public:messages')
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'messages',
                        filter: `receiver_id=eq.${user.id}`
                    },
                    (payload) => {
                        const newMsg = payload.new as any;
                        // Avoid notifying if user is literally on that chat page (optional optimization, skip for now to ensure delivery)
                        toast.info("New Message", {
                            description: newMsg.content || "You have a new message.",
                            action: {
                                label: "View",
                                onClick: () => router.push(`/messages?chat=${newMsg.gig_id}_${newMsg.sender_id}`)
                            }
                        });
                    }
                )
                .subscribe();

            // 2. MY GIGS UPDATES (As Poster)
            const myGigsChannel = supabase
                .channel('public:gigs:poster')
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'gigs',
                        filter: `poster_id=eq.${user.id}`
                    },
                    (payload) => {
                        const newGig = payload.new as any;
                        const oldGig = payload.old as any;

                        if (newGig.status !== oldGig.status) {
                            let msg = `Gig '${newGig.title}' status: ${newGig.status}`;
                            if (newGig.status === 'cancellation_requested') msg = `Cancellation REQUESTED for '${newGig.title}'`;
                            if (newGig.status === 'completed') msg = `Gig '${newGig.title}' Completed! Funds Released.`;

                            toast.success("Gig Update", {
                                description: msg,
                                action: { label: "View", onClick: () => router.push(`/gig/${newGig.id}`) }
                            });
                        }
                    }
                )
                .subscribe();

            // 3. MY WORK UPDATES (As Worker)
            const myWorkChannel = supabase
                .channel('public:gigs:worker')
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'gigs',
                        filter: `assigned_worker_id=eq.${user.id}`
                    },
                    (payload) => {
                        const newGig = payload.new as any;
                        const oldGig = payload.old as any;

                        if (newGig.status !== oldGig.status) {
                            let msg = `Work '${newGig.title}' updated to: ${newGig.status}`;
                            if (newGig.status === 'cancelled') msg = `Gig '${newGig.title}' was CANCELLED.`;
                            if (newGig.status === 'assigned') msg = `You have been ASSIGNED to '${newGig.title}'!`;

                            toast.info("Work Update", {
                                description: msg,
                                action: { label: "View", onClick: () => router.push(`/gig/${newGig.id}`) }
                            });
                        }
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(msgChannel);
                supabase.removeChannel(myGigsChannel);
                supabase.removeChannel(myWorkChannel);
            };
        };

        setupListener();
    }, [supabase, router]);

    return null;
}
