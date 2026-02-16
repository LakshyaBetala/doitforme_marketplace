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
    console.error('Moderation route error:', err);
    return new Response(JSON.stringify({ success: true, flagged: true }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
