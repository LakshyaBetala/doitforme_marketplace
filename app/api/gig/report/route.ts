import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { targetId, targetType, reason, details } = await req.json();

        const cookieStore = await cookies();
        const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!targetId || !targetType || !reason) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // 1. Check Rate Limiter (Max 3 reports per hour)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { count, error: countError } = await supabase
            .from('reports')
            .select('*', { count: 'exact', head: true })
            .eq('reporter_id', user.id)
            .gte('created_at', oneHourAgo);

        if (countError && countError.code !== '42P01') { // Ignore "relation does not exist" for now
            console.error("Rate limit check error:", countError);
        }

        if (count !== null && count >= 3) {
            return NextResponse.json({ error: "You can only submit 3 reports per hour to prevent abuse." }, { status: 429 });
        }

        // 2. Insert Report
        const { error: insertError } = await supabase.from('reports').insert({
            reporter_id: user.id,
            target_id: targetId,
            target_type: targetType, // 'gig' or 'user'
            reason,
            details: details || null,
            status: 'pending' // pending, reviewed, resolved
        });

        if (insertError) {
            if (insertError.code === '42P01') {
                // Table doesn't exist yet, graceful fallback message
                console.warn("Reports table is missing on the database. Please run the SQL migration.");
                return NextResponse.json({ error: "Reporting system is currently undergoing maintenance. Please try again later." }, { status: 503 });
            }
            throw insertError;
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Report API Error:", error);
        return NextResponse.json({ error: "Failed to submit report. Please try again." }, { status: 500 });
    }
}
