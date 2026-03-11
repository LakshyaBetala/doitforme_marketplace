import { NextResponse } from 'next/server';
import { createClient } from "@supabase/supabase-js";
import { sendTelegramAlert } from '@/lib/telegram';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const message = body.message;

        if (!message || !message.text) return NextResponse.json({ ok: true });

        const text = message.text;
        const chatId = message.chat.id.toString();

        // Check if it's the start command with the UUID payload
        if (text.startsWith('/start ')) {
            const userId = text.split(' ')[1];

            // Validate UUID length/format to prevent injection
            if (userId.length === 36) {
                // We use Service Role because this is a server-to-server webhook
                const supabaseAdmin = createClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.SUPABASE_SERVICE_ROLE_KEY!
                );
                
                // Update the user's row with their Telegram Chat ID
                const { error } = await supabaseAdmin
                    .from('users')
                    .update({ telegram_chat_id: chatId })
                    .eq('id', userId);

                if (!error) {
                    await sendTelegramAlert(chatId, "✅ <b>Success!</b> Your DoItForMe account is linked. You'll now receive instant updates here for messages and gigs!");
                } else {
                    console.error("Supabase Error linking Telegram:", error);
                    await sendTelegramAlert(chatId, "❌ <b>Error:</b> We couldn't link your account right now. Please try again from the app.");
                }
            } else {
                await sendTelegramAlert(chatId, "Unrecognized DoItForMe Link. Please open the bot directly from the DoItForMe Profile page.");
            }
        }
        
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Telegram Webhook Error:", error);
        return NextResponse.json({ ok: true }); // Always return 200 so Telegram doesn't retry
    }
}
