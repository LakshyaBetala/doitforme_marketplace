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
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) { try { cookieStore.set({ name, value, ...options }) } catch (e) {} },
        remove(name: string, options: CookieOptions) { try { cookieStore.set({ name, value: '', ...options }) } catch (e) {} },
      },
    }
  )

  try {
    const { amount, upi } = await req.json();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!amount || amount < 50) return NextResponse.json({ error: "Min withdrawal is ₹50" }, { status: 400 });

    // 1. Get Current Balance
    const { data: wallet } = await supabase
      .from("wallets")
      .select("balance, frozen")
      .eq("user_id", user.id)
      .single();

    if (!wallet || wallet.balance < amount) {
      return NextResponse.json({ error: "Insufficient funds" }, { status: 400 });
    }

    // 2. Perform Transaction (Deduct Balance, Add to Frozen)
    const { error: walletError } = await supabase
      .from("wallets")
      .update({ 
        balance: wallet.balance - amount,
        frozen: (wallet.frozen || 0) + amount 
      })
      .eq("user_id", user.id);

    if (walletError) throw walletError;

    // 3. Log the Withdrawal Request
    // (Ensure you ran the SQL above to create the 'withdrawals' table)
    const { error: logError } = await supabase
      .from("withdrawals")
      .insert({
        user_id: user.id,
        amount: amount,
        upi_id: upi,
        status: "pending"
      });

    if (logError) console.error("Failed to log withdrawal:", logError);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Withdraw Error:", error);
    return NextResponse.json({ error: error.message || "Server Error" }, { status: 500 });
  }
}