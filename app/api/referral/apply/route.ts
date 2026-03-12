import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Service role client for privileged DB writes
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

// Apply a referral code during/after sign-up
export async function POST(req: Request) {
    try {
        const { referralCode } = await req.json();

        if (!referralCode) {
            return NextResponse.json({ error: "Missing referralCode" }, { status: 400 });
        }

        // SECURITY: Authenticate the caller via cookie/header — NEVER trust userId from body
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

        const userId = user.id; // Server-verified user ID

        // 1. Find the referrer by code
        const { data: referrer, error: refErr } = await supabaseAdmin
            .from("users")
            .select("id, referral_code")
            .eq("referral_code", referralCode.toUpperCase().trim())
            .single();

        if (refErr || !referrer) {
            return NextResponse.json({ error: "Invalid referral code" }, { status: 404 });
        }

        // 2. Prevent self-referral
        if (referrer.id === userId) {
            return NextResponse.json({ error: "You cannot refer yourself" }, { status: 400 });
        }

        // 3. Check if user was already referred
        const { data: existingRef } = await supabaseAdmin
            .from("referrals")
            .select("id")
            .eq("referred_id", userId)
            .single();

        if (existingRef) {
            return NextResponse.json({ error: "You have already used a referral code" }, { status: 400 });
        }

        // 4. Create referral record
        const { error: insertErr } = await supabaseAdmin
            .from("referrals")
            .insert({
                referrer_id: referrer.id,
                referred_id: userId,
                status: "SIGNED_UP",
                signup_reward_paid: true,
            });

        if (insertErr) {
            return NextResponse.json({ error: insertErr.message }, { status: 500 });
        }

        // 5. Update referred user's referred_by field
        await supabaseAdmin
            .from("users")
            .update({ referred_by: referralCode.toUpperCase().trim() })
            .eq("id", userId);

        // 6. Credit 25 RP to the referrer (expires in 100 years)
        const expiresAt = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();

        await supabaseAdmin.from("points_transactions").insert({
            user_id: referrer.id,
            amount: 25,
            type: "EARN",
            reason: "Referral sign-up bonus",
            reference_id: userId,
            expires_at: expiresAt,
            redeemed: false,
        });

        // 7. Update referrer's points balance
        await supabaseAdmin.rpc("increment_points", { uid: referrer.id, pts: 25 });

        // 8. Credit 25 RP to the referred user (expires in 100 years)
        await supabaseAdmin.from("points_transactions").insert({
            user_id: userId,
            amount: 25,
            type: "EARN",
            reason: "Signed up with a referral code",
            reference_id: referrer.id,
            expires_at: expiresAt,
            redeemed: false,
        });

        // 9. Update referred user's points balance
        await supabaseAdmin.rpc("increment_points", { uid: userId, pts: 25 });

        return NextResponse.json({ success: true, message: "Referral applied! Both users earned 25 RP." });

    } catch (err: any) {
        console.error("Referral apply error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
