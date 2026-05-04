import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
        const { companyName, companyEmail, companyDetails, companyPhone, companyInterest, logoUrl, password } = body;

        if (!companyName?.trim() || !companyEmail?.trim() || !companyDetails?.trim() || !companyPhone?.trim()) {
            return NextResponse.json({ error: "All required company details must be provided." }, { status: 400 });
        }

        const serviceRoleClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Update user role to COMPANY (pending admin verification)
        const { error: updateError } = await serviceRoleClient
            .from('users')
            .update({
                role: 'COMPANY',
                name: companyName.trim(), 
                is_verified_company: false, // Requires admin approval
                phone: Number(companyPhone.replace(/\D/g, "")),
                experience: `Work Email: ${companyEmail.trim()}\n\nDetails: ${companyDetails.trim()}`,
                avatar_url: logoUrl || null
            })
            .eq('id', user.id);

        if (updateError) {
            console.error("Error setting company role:", updateError);
            return NextResponse.json({ error: "Database update failed: " + updateError.message }, { status: 500 });
        }

        // Update auth metadata
        const updateData: any = { 
            data: { 
                role: 'COMPANY', 
                company_name: companyName.trim(),
                company_email: companyEmail.trim(),
                avatar_url: logoUrl || null
            }
        };

        if (password) {
            updateData.password = password;
        }

        await supabase.auth.updateUser(updateData);

        // Insert into companies table with user_id and contact_email linked
        const { error: companyInsertError } = await serviceRoleClient.from('companies').upsert([{ 
            name: companyName.trim(), 
            is_active: false, // Pending admin approval
            user_id: user.id,
            contact_email: companyEmail.trim(),
            description: companyDetails.trim(),
            company_type: companyInterest || 'startup',
            // logo_url: logoUrl || null // Only if logo_url exists on companies table, otherwise we rely on users table. Let's rely on users table for now to avoid schema errors.
        }], { onConflict: 'name' });

        if (companyInsertError) {
            console.error("Company table insert error:", companyInsertError);
            // Don't fail the request — the user role is already set. Admin can reconcile.
        }

        return NextResponse.json({ success: true, message: "Request submitted! Pending admin approval." });

    } catch (err: any) {
        console.error("Company Onboard error:", err);
        return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
    }
}
