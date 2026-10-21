"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import GigCard from "@/components/ui/GigCard";
import EmptyState from "@/components/ui/EmptyState";
import { Loader2, Sparkles } from "lucide-react";
import PublicHeader from "@/components/home/PublicHeader";

/**
 * Talent directory — the home for SERVICE listings (self-promotion).
 *
 * This exists because self-promotion and demand are different products. A
 * student advertising "I make PPTs from ₹100" should be BROWSED and HIRED, not
 * dropped into the task feed where buyers have to scroll past sellers to find
 * anything to hire for. Splitting them is what stops the feed inverting.
 *
 * Deliberately not paginated yet — the whole directory is well under one page.
 */
export default function TalentPage() {
  const supabase = supabaseBrowser();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("gigs")
        // Named columns, not "*": this page is browsable without a session, and
        // gigs also carries delivery artifacts, dispute text and the payment
        // breakdown, which anon has no grant for (20260903_gigs_column_privileges).
        .select(
          `id, poster_id, company_id, assigned_worker_id, title, description, category, images,
           price, currency, security_deposit, listing_type, market_type, item_condition,
           is_physical, location, github_link, status, deadline, max_workers, trust_based,
           is_featured, is_highlighted, highlight_expires_at, is_managed, created_at,
           users:poster_id(name, college, rating, rating_count, username)`
        )
        .eq("listing_type", "SERVICE")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(60);
      setServices(data || []);
      setLoading(false);
    })();
  }, [supabase]);

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-white">
      <PublicHeader />
      <div className="max-w-6xl mx-auto px-5 md:px-8 py-8 md:py-12">
        <div className="mb-8">
          <h1
            className="text-4xl md:text-5xl font-bold tracking-tight mb-3"
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}
          >
            Talent
          </h1>
          <p className="text-[16px] text-white/65 max-w-xl leading-relaxed">
            Students offering their skills. Browse, then message someone to hire them —
            we hold the payment once you agree on the work.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="animate-spin text-white/40" size={28} />
          </div>
        ) : services.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No services listed yet"
            description="Offering a skill? Put yourself on the board and let people come to you."
            actionLabel="Offer a service"
            actionHref="/post"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <GigCard key={s.id} gig={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
