import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() { return cookieStore.getAll() },
                    setAll(cookiesToSet) {
                        try {
                            cookiesToSet.forEach(({ name, value, options }) =>
                                cookieStore.set(name, value, options)
                            )
                        } catch {
                        }
                    },
                },
            }
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { companyName, companyEmail, companyDetails } = body;

        if (!companyName?.trim() || !companyEmail?.trim() || !companyDetails?.trim()) {
            return NextResponse.json({ error: "All company details are required." }, { status: 400 });
        }

        // We update the user's role and details.
        // For admin review, we can store the contact email and description in the 'experience' or metadata fields.
        const { error: updateError } = await supabase
            .from('users')
            .update({
                role: 'COMPANY',
                name: companyName.trim(), 
                is_verified_company: false,
                experience: `Work Email: ${companyEmail.trim()}\n\nDetails: ${companyDetails.trim()}`
            })
            .eq('id', user.id);

        if (updateError) {
            console.error("Error setting company role:", updateError);
            return NextResponse.json({ error: "Database update failed" }, { status: 500 });
        }

        // IMPORTANT: Also update auth metadata so the JWT role reflects it (if the app uses JWT roles)
        await supabase.auth.updateUser({
            data: { 
                role: 'COMPANY', 
                company_name: companyName.trim(),
                company_email: companyEmail.trim(),
            }
        });

        // Optionally, add to companies table so it can eventually be used in the platform generically
        await supabase.from('companies').insert([{ name: companyName.trim(), is_active: false }]).select().single();

        return NextResponse.json({ success: true, message: "Request submitted! Pending admin approval." });

    } catch (err: any) {
        console.error("Company Onboard error:", err);
        return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
    }
}
