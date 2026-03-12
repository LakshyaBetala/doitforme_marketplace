import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, name, phone, college, upi_id } = body;

    // SECURITY: Authenticate caller via cookie — use session user ID, never trust body
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

    const id = user.id; // Server-verified user ID

    if (!email) {
      return NextResponse.json({ error: "Missing Email" }, { status: 400 });
    }

    // Validate UPI ID Format
    if (upi_id) {
      const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
      if (!upiRegex.test(upi_id)) {
        return NextResponse.json({ error: "Invalid UPI ID format. Example: name@oksbi" }, { status: 400 });
      }
    }

    // Admin Client (Bypasses RLS for user upsert operations)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Fetch existing user data
    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .single();

    // Smart data: keep old, overwrite only if new data sent
    const finalName = name || existingUser?.name || email.split("@")[0];
    const finalPhone = phone || existingUser?.phone || null;
    const finalCollege = college || existingUser?.college || null;
    const finalUpi = upi_id || existingUser?.upi_id || null;
    const finalKyc = existingUser?.kyc_verified || false;

    // Upsert user (with verified ID from session)
    const { error: userError } = await supabase
      .from("users")
      .upsert({
        id: id,
        email: email,
        name: finalName,
        phone: finalPhone,
        college: finalCollege,
        upi_id: finalUpi,
        kyc_verified: finalKyc,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (userError) {
      console.error("API: User Upsert Error:", userError);
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    // Auto-generate referral code if missing
    if (!existingUser?.referral_code) {
      const { data: codeData } = await supabase.rpc("generate_referral_code");
      if (codeData) {
        await supabase
          .from("users")
          .update({ referral_code: codeData })
          .eq("id", id);
      }
    }

    // Ensure wallet exists
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