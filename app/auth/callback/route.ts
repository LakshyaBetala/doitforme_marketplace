import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/dashboard";
    const ref = searchParams.get("ref"); // Capture optional referral

    if (code) {
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll();
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            cookieStore.set(name, value, options);
                        });
                    },
                },
            }
        );

        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error && data.user) {
            // Sync user to the users table
            try {
                await fetch(`${origin}/api/auth/create-user`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: data.user.id, email: data.user.email }),
                });
            } catch (e) {
                console.error("User sync failed:", e);
            }

            // Apply Referral Code if exists
            if (ref) {
                try {
                    await fetch(`${origin}/api/referral/apply`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ userId: data.user.id, referralCode: ref }),
                    });
                } catch (e) {
                    console.error("Referral apply failed in OAuth callback:", e);
                }
            }

            return NextResponse.redirect(`${origin}${next}`);
        }
    }

    // If something went wrong, redirect to login with error
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
