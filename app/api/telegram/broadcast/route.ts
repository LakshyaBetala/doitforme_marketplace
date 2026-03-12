import { NextResponse } from 'next/server';
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sendTelegramAlert } from '@/lib/telegram';

export async function POST(req: Request) {
    try {
        // SECURITY: Authenticate caller — only logged-in users can trigger broadcasts
        const cookieStore = await cookies();
        const supabaseAuth = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { cookies: { getAll() { return cookieStore.getAll(); } } }
        );

        const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { gigId, category, title, price, posterId } = await req.json();

        if (!gigId || !category) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // We use Service Role because we need to query ALL users' preferences and telegram_chat_ids
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Get ALL users who have this category in their preferences AND have linked Telegram
        const { data: matchedUsers, error } = await supabaseAdmin
            .from('users')
            .select('telegram_chat_id, id')
            .contains('preferences', [category])
            .not('telegram_chat_id', 'is', null)
            .neq('id', posterId || user.id);

        if (error) {
            console.error("Error fetching matched users for broadcast:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (matchedUsers && matchedUsers.length > 0) {
            const message = `🚀 <b>New Match in ${category}</b>\n<b>${title}</b>\nBudget/Price: ₹${price}\n\n<a href="https://doitforme.in/gig/${gigId}">View Details</a>`;
            
            // Send in parallel
            await Promise.allSettled(
                matchedUsers.map(u => sendTelegramAlert(u.telegram_chat_id, message))
            );
        }

        return NextResponse.json({ success: true, count: matchedUsers?.length || 0 });
    } catch (error: any) {
        console.error("Telegram Broadcast Error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
