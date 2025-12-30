import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Ignored
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Ignored
          }
        },
      },
    }
  )

  try {
    const body = await req.json();
    const { gigId, workerId, price } = body;

    // 1. Authenticate User
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get User's Wallet
    const { data: wallet, error: walletErr } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", user.id)
        .single();

    if (walletErr || !wallet) {
        // If wallet doesn't exist, create it with funds (Auto-Fund for testing)
        console.log("Creating wallet with initial funds...");
        await supabase.from("wallets").insert({ 
            user_id: user.id, 
            balance: price 
        });
    } else if (wallet.balance < price) {
        // --- AUTO-FUNDING LOGIC (For Testing) ---
        // If balance is too low, add the necessary funds first!
        const needed = price - wallet.balance;
        console.log(`Auto-funding wallet with ₹${needed}...`);
        
        await supabase
            .from("wallets")
            .update({ balance: wallet.balance + needed })
            .eq("user_id", user.id);
    }

    // 3. Deduct Balance (Now guaranteed to have enough)
    // We re-fetch balance to be safe, or just trust our math. Let's do the deduction.
    // Note: In production, use RPC for atomic transaction.
    
    // Fetch fresh wallet state
    const { data: freshWallet } = await supabase.from("wallets").select("balance").eq("user_id", user.id).single();
    
    const { error: updateError } = await supabase
        .from("wallets")
        .update({ balance: (freshWallet?.balance || price) - price })
        .eq("user_id", user.id);

    if (updateError) throw updateError;

    // 4. Update Gig Status
    const { error: gigError } = await supabase
        .from("gigs")
        .update({ 
            assigned_worker_id: workerId, 
            status: "ASSIGNED" 
        })
        .eq("id", gigId);

    if (gigError) throw gigError;

    // 5. Update Application Status
    const { error: appError } = await supabase
        .from("applications")
        .update({ status: "accepted" })
        .eq("gig_id", gigId)
        .eq("worker_id", workerId);

    if (appError) throw appError;

    return NextResponse.json({ success: true, message: "Worker hired & funds secured!" });

  } catch (error: any) {
    console.error("Hire Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}