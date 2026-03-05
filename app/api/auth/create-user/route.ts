import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // 1. Extract upi_id from the request body
    // This comes from the 'verify' page where we passed the metadata
    const { id, email, name, phone, college, upi_id } = body;

    if (!id || !email) {
      return NextResponse.json({ error: "Missing ID or Email" }, { status: 400 });
    }

    // 2. Validate UPI ID Format (Regex Check)
    // This prevents bad data from entering the database early on.
    if (upi_id) {
      const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
      if (!upiRegex.test(upi_id)) {
        return NextResponse.json({ error: "Invalid UPI ID format. Example: name@oksbi" }, { status: 400 });
      }
    }

    // Initialize Admin Client (Bypasses RLS to ensure we can read/write everything)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // --- 3. FETCH EXISTING USER DATA ---
    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .single();

    // --- 4. PREPARE SMART DATA ---
    // If user exists, keep their old data. Only overwrite if new data is sent (truthy).
    // If user is new, use the defaults.

    const finalName = name || existingUser?.name || email.split("@")[0];
    const finalPhone = phone || existingUser?.phone || null;
    const finalCollege = college || existingUser?.college || null;

    // Preserve existing UPI if not provided in this update, otherwise use new one
    // This is crucial: If they log in again later without sending UPI, we don't want to erase the old one.
    const finalUpi = upi_id || existingUser?.upi_id || null;

    // Preserve verification status
    const finalKyc = existingUser?.kyc_verified || false;

    // --- 5. UPSERT USER (With UPI ID) ---
    const { error: userError } = await supabase
      .from("users")
      .upsert({
        id: id,
        email: email,
        name: finalName,
        phone: finalPhone,
        college: finalCollege,
        upi_id: finalUpi, // <--- Storing the UPI ID here for Payouts
        kyc_verified: finalKyc,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (userError) {
      console.error("API: User Upsert Error:", userError);
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    // --- 6. AUTO-GENERATE REFERRAL CODE ---
    // If user doesn't have a referral code yet, generate one
    if (!existingUser?.referral_code) {
      const { data: codeData } = await supabase.rpc("generate_referral_code");
      if (codeData) {
        await supabase
          .from("users")
          .update({ referral_code: codeData })
          .eq("id", id);
      }
    }

    // --- 7. ENSURE WALLET EXISTS ---
    // Wallets table is actively used by escrow release/refund RPCs,
    // freeze/unfreeze operations, and the auto-release cron job.
    const { error: walletError } = await supabase
      .from("wallets")
      .upsert(
        { user_id: id, balance: 0, frozen: 0 },
        { onConflict: "user_id", ignoreDuplicates: true }
      );

    if (walletError) console.error("API: Wallet Upsert Error:", walletError);

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("API: Critical Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}