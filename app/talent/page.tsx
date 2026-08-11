"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import GigCard from "@/components/ui/GigCard";
import EmptyState from "@/components/ui/EmptyState";
import { Loader2, ChevronLeft, Sparkles } from "lucide-react";

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
        .select("*, users:poster_id(name, college, rating, rating_count, username)")
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
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors px-3 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.16] mb-8"
        >
          <ChevronLeft size={18} />
          <span className="text-xs font-semibold">Back</span>
        </Link>

        <div className="mb-8">
          <h1
            className="text-3xl md:text-4xl font-semibold tracking-tight mb-2"
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}
          >
            Talent
          </h1>
          <p className="text-sm text-white/60 max-w-xl leading-relaxed">
            Students offering their skills. Browse, then message someone to hire them —
            payment is held in escrow once you agree on the work.
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
