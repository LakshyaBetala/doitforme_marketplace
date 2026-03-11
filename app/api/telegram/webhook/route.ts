import { NextResponse } from 'next/server';
import { createClient } from "@supabase/supabase-js";
import { sendTelegramAlert } from '@/lib/telegram';

export async function GET() {
    return NextResponse.json({ 
        status: "Online", 
        message: "Telegram Webhook is listening for POST requests." 
    });
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        
        // Telegram might send updates instead of messages (e.g. edited_message, callback_query)
        const message = body.message || body.edited_message;
        
        if (!message || !message.text || !message.chat || !message.chat.id) {
            return NextResponse.json({ ok: true });
        }

        const text = message.text;
        const chatId = message.chat.id.toString();

        // Check if it's the start command with the UUID payload
        if (text.startsWith('/start ')) {
            const userId = text.split(' ')[1];
            // Validate UUID length/format to prevent injection
            if (userId && userId.length === 36) {
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
        } else if (text === '/start') {
            await sendTelegramAlert(chatId, "👋 <b>Welcome to DoItForMe!</b>\n\nTo link your account and start receiving notifications, please log into <a href='https://doitforme.in'>doitforme.in</a> and click the <b>Connect Telegram</b> button on your Profile page.");
        } else if (text === '/help') {
            await sendTelegramAlert(chatId, "🛠️ <b>DoItForMe Help Center</b>\n\n<b>Commands:</b>\n/start - Link your account (via website)\n/profile - Go to your Profile\n/gigs - View your active Gigs\n\n<b>Having trouble?</b>\nIf you aren't receiving notifications, ensure you have selected your <b>Interests & Strengths</b> on your Profile page so we know which gigs to notify you about!");
        } else if (text === '/profile') {
            await sendTelegramAlert(chatId, "👤 <b>Your Profile</b>\n\nClick here to view or edit your profile, set your preferences, and manage your account:\n<a href='https://doitforme.in/profile'>Open Profile</a>");
        } else if (text === '/gigs') {
            await sendTelegramAlert(chatId, "💼 <b>Your Gigs</b>\n\nClick here to view your active Hustle and Marketplace gigs:\n<a href='https://doitforme.in/dashboard'>Open Dashboard</a>");
        } else {
            // Optional: Echo back for unknown commands, or just ignore. 
            // Ignored here to prevent spamming users who type random things.
        }
        
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Telegram Webhook Error:", error);
        return NextResponse.json({ ok: true }); // Always return 200 so Telegram doesn't retry
    }
}
