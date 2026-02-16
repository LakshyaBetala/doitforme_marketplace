import { analyzeIntentAI } from '@/lib/moderation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const text = body?.text || '';

    const result = await analyzeIntentAI(text);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Moderation route error (Fail Open):', err);
    // FAIL OPEN: If moderation fails, we allow the message to proceed.
    // Return success: true so the client doesn't block it.
    return new Response(JSON.stringify({ success: true, flagged: false, reason: "Moderation Skipped" }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
