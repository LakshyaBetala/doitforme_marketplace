import { NextResponse } from 'next/server';
import { createClient } from "@supabase/supabase-js";

// Force Vercel to treat this as a dynamic serverless function, never cache it
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendTG(chatId: string, text: string) {
    if (!BOT_TOKEN) {
        console.error("TELEGRAM_BOT_TOKEN is missing!");
        return { ok: false, error: "Missing BOT_TOKEN" };
    }
    
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
            disable_web_page_preview: true
        })
    });
    
    const data = await res.json();
    if (!data.ok) {
        console.error("Telegram API Error:", JSON.stringify(data));
    }
    return data;
}

export async function GET() {
    return NextResponse.json({ 
        status: "Online", 
        message: "Telegram Webhook is listening for POST requests." 
    });
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        
        // Telegram sends different update types
        const message = body.message || body.edited_message;
        
        if (!message?.text || !message?.chat?.id) {
            return NextResponse.json({ ok: true });
        }

        // Strip @botname suffix that Telegram appends when user taps commands from menu
        // e.g. "/profile@doitforme_alerts_bot" → "/profile"
        const rawText = message.text.trim();
        const text = rawText.replace(/@\S+/, '').trim();
        const chatId = message.chat.id.toString();

        // /start with UUID payload (account linking from Profile deep link)
        if (text.startsWith('/start ')) {
            const userId = text.split(' ')[1]?.trim();
            
            if (userId && userId.length === 36) {
                const supabaseAdmin = createClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.SUPABASE_SERVICE_ROLE_KEY!
                );
                
                // First, clear this chat_id from any other user (handles re-linking)
                await supabaseAdmin
                    .from('users')
                    .update({ telegram_chat_id: null })
                    .eq('telegram_chat_id', chatId);
                
                // Now set it on the target user
                const { error } = await supabaseAdmin
                    .from('users')
                    .update({ telegram_chat_id: chatId })
                    .eq('id', userId);

                if (!error) {
                    await sendTG(chatId, "✅ <b>Success!</b> Your DoItForMe account is linked. You'll now receive instant updates here for messages and gigs!");
                } else {
                    console.error("Supabase Error linking Telegram:", JSON.stringify(error));
                    await sendTG(chatId, "❌ <b>Error:</b> We couldn't link your account right now. Please try again from the app.");
                }
            } else {
                await sendTG(chatId, "⚠️ Invalid link. Please open the bot from the <b>Connect Telegram</b> button on your DoItForMe Profile page.");
            }
            return NextResponse.json({ ok: true });
        }
        
        // Plain /start (no UUID — user opened bot directly)
        if (text === '/start') {
            await sendTG(chatId, "👋 <b>Welcome to DoItForMe!</b>\n\nTo link your account and start receiving notifications, please log into <a href='https://doitforme.in'>doitforme.in</a> and click the <b>Connect Telegram</b> button on your Profile page.");
            return NextResponse.json({ ok: true });
        }
        
        // /help
        if (text === '/help') {
            await sendTG(chatId, "🛠️ <b>DoItForMe Help Center</b>\n\n<b>Commands:</b>\n/start - Link your account (via website)\n/profile - Go to your Profile\n/gigs - View your active Gigs\n\n<b>Having trouble?</b>\nIf you aren't receiving notifications, ensure you have selected your <b>Interests & Strengths</b> on your Profile page so we know which gigs to notify you about!");
            return NextResponse.json({ ok: true });
        }
        
        // /profile
        if (text === '/profile') {
            await sendTG(chatId, "👤 <b>Your Profile</b>\n\nClick here to view or edit your profile, set your preferences, and manage your account:\n<a href='https://doitforme.in/profile'>Open Profile</a>");
            return NextResponse.json({ ok: true });
        }
        
        // /gigs
        if (text === '/gigs') {
            await sendTG(chatId, "💼 <b>Your Gigs</b>\n\nClick here to view your active Hustle and Marketplace gigs:\n<a href='https://doitforme.in/dashboard'>Open Dashboard</a>");
            return NextResponse.json({ ok: true });
        }

        // Unknown text — silently ignore
        return NextResponse.json({ ok: true });
        
    } catch (error: any) {
        console.error("Telegram Webhook Error:", error?.message || error);
        return NextResponse.json({ ok: true }); // Always return 200 so Telegram doesn't retry
    }
}
