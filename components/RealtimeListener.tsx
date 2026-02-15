
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

            const channel = supabase
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

            return () => {
                supabase.removeChannel(channel);
            };
        };

        setupListener();
    }, [supabase, router]);

    return null;
}
