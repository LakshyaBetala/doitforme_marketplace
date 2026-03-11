import { NextResponse } from 'next/server';

export async function GET() {
    const chatId = '1472648156'; // Laksh's Telegram Chat ID
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!BOT_TOKEN) {
        return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN is missing' });
    }

    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: '🔧 <b>Debug Test</b>\nIf you see this, the production Telegram pipeline is working!',
                parse_mode: 'HTML',
                disable_web_page_preview: true
            })
        });

        const result = await response.json();
        return NextResponse.json({ 
            status: response.status,
            telegramResponse: result,
            botTokenPrefix: BOT_TOKEN.substring(0, 10) + '...'
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
