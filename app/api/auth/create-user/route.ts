import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, email } = body;

    console.log("API: Handling create-user for:", email);

    if (!id || !email) {
      return NextResponse.json({ error: "Missing ID or Email" }, { status: 400 });
    }

    // Initialize Admin Client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // --- STEP 1: CHECK FOR STALE DATA ---
    // Does a user with this email ALREADY exist?
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    // If email exists BUT the ID is different, we have a "Ghost User" from a previous signup.
    // We must delete the old row to allow the new Auth ID to take over.
    if (existingUser && existingUser.id !== id) {
      console.log(`API: Stale user found (Old ID: ${existingUser.id}). Deleting...`);
      
      // Delete the old user row (Cascading delete will clean up their old wallet/gigs)
      await supabase.from("users").delete().eq("id", existingUser.id);
      
      // Also ensure wallet is gone if cascade didn't work
      await supabase.from("wallets").delete().eq("user_id", existingUser.id);
    }
    // ------------------------------------

    // --- STEP 2: UPSERT NEW USER ---
    const { error: userError } = await supabase
      .from("users")
      .upsert({ 
        id: id, 
        email: email,
        name: email.split("@")[0],
        kyc_verified: false 
      })
      .select()
      .single();

    if (userError) {
      console.error("API: User Upsert Error:", userError);
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    // --- STEP 3: ENSURE WALLET ---
    const { error: walletError } = await supabase
      .from("wallets")
      .upsert(
        { user_id: id, balance: 0, frozen_balance: 0 }, 
        { onConflict: "user_id", ignoreDuplicates: true }
      );

    if (walletError) {
      console.error("API: Wallet Error:", walletError);
    }

    console.log("API: User sync successful.");
    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("API: Critical Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}