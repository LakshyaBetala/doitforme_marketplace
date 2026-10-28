"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Image from "next/image";
import { MapPin, Globe2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import GigCard from "@/components/ui/GigCard";
import { GigCardCompactSkeleton } from "@/components/ui/Skeleton";

/**
 * Explore work — the open task board.
 *
 * The data logic here is unchanged and deliberately so: the filters encode
 * several corrections that are easy to undo by accident (company tasks must not
 * age out, direct hire requests must never reach the public board). Only the
 * presentation moved onto the app shell.
 *
 * Three things the page used to do that the shell now owns, and so are gone:
 * its own full-screen dark wrapper, a second DoItForMe logo with a messages
 * button beside it, and two fixed blurred purple blobs.
 */
export default function FeedPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [gigs, setGigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [campusFilter, setCampusFilter] = useState<"ALL" | "MY_CAMPUS">("ALL");

  const ITEMS_PER_PAGE = 12;

  const fetchGigs = async (pageIndex: number, isNewFilter: boolean = false) => {
    try {
      if (isNewFilter) {
        setLoading(true);
        setGigs([]);
      } else {
        setLoadingMore(true);
      }

      const { data: { user } } = await supabase.auth.getUser();

      let userCollege = null;
      if (user) {
        const { data: userData } = await supabase.from('users').select('college').eq('id', user.id).single();
        userCollege = userData?.college;
      }

      const nowIso = new Date().toISOString();
      const from = pageIndex * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      // Base Query
      let query = supabase
        .from("gigs")
        .select("*, users:poster_id!inner(college), companies:company_id(name), applications(count)")
        .eq("status", "open")
        // Hide anything already assigned/in progress — see dashboard note.
        .is("assigned_worker_id", null)
        // A gig created by hiring someone from their service advert is a private
        // request to ONE named person, not an open call. It is a HUSTLE with
        // status='open' and no assigned worker yet, which is precisely this
        // query's filter — so without this line every direct hire request would
        // be published to the whole task board for strangers to apply to.
        .is("source_service_id", null)
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, to);

      // Filters
      // Age out student hustles after 30 days, but NEVER company tasks: those
      // are internships/roles that stay open for months, and they are the only
      // real demand on the platform. The flat 30-day rule was silently hiding
      // every COMPANY_TASK ever posted while leaving it status='open' in the DB,
      // so companies saw their listing quietly die. Deadline still applies below.
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      query = query.or(`listing_type.eq.COMPANY_TASK,created_at.gt.${thirtyDaysAgo}`);

      // Filter only Hustles and Company Tasks
      query = query.in("listing_type", ["HUSTLE", "COMPANY_TASK"]).or(`deadline.is.null,deadline.gt.${nowIso}`);

      if (campusFilter === "MY_CAMPUS" && userCollege) {
        query = query.eq("users.college", userCollege);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        // Pro companies (pro_until > now) get their posts auto-featured.
        const { data: proCompanies } = await supabase
           .from("companies")
           .select("user_id, pro_until")
           .gt("pro_until", new Date().toISOString());

        const proPosterIds = new Set((proCompanies || []).map((c: any) => c.user_id));

        const enhancedData = data.map((gig: any) => ({
           ...gig,
           is_featured: gig.is_featured || proPosterIds.has(gig.poster_id),
           applicant_count: Array.isArray(gig.applications) ? (gig.applications[0]?.count ?? 0) : 0,
        }));

        // Sort so featured gigs always appear first within this page's result set
        enhancedData.sort((a: any, b: any) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0));

        setGigs(prev => isNewFilter ? enhancedData : [...prev, ...enhancedData]);
        setHasMore(data.length === ITEMS_PER_PAGE);
      }

    } catch (err) {
      console.error("Feed Error:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // --- SCROLL RESTORATION Logic ---
  useEffect(() => {
    const cached = sessionStorage.getItem("feed_cache");
    if (cached) {
      try {
        const state = JSON.parse(cached);
        const isFresh = Date.now() - state.timestamp < 1000 * 60 * 10; // 10 mins

        if (isFresh && state.gigs?.length > 0) {
          setGigs(state.gigs);
          setPage(state.page);
          setHasMore(state.hasMore);
          setCampusFilter(state.campusFilter);
          setLoading(false);

          // Restore Scroll
          setTimeout(() => {
            window.scrollTo(0, state.scrollTop);
          }, 50);
          return;
        }
      } catch (e) {
        console.error("Cache parse error", e);
        sessionStorage.removeItem("feed_cache");
      }
    }

    // If no cache, initial fetch
    fetchGigs(0, true);
  }, []); // Run ONCE on mount

  // Save State on Unmount
  useEffect(() => {
    const handleBeforeUnload = () => {
      const state = {
        gigs,
        page,
        hasMore,
        campusFilter,
        scrollTop: window.scrollY,
        timestamp: Date.now()
      };
      sessionStorage.setItem("feed_cache", JSON.stringify(state));
    };

    // Save on route change (unmount) and window close.
    //
    // The cleanup used to call handleBeforeUnload() and never removeEventListener,
    // so every run of this effect left another listener attached to window — and
    // it depends on `gigs`, which changes on every fetch. By the third page of
    // results the same handler was registered four times over.
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload(); // still persist on unmount
    };
  }, [gigs, page, hasMore, campusFilter]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchGigs(nextPage, false);
  };

  const applyFilter = (next: "ALL" | "MY_CAMPUS") => {
    setCampusFilter(next);
    setPage(0);
    setHasMore(true);
    // fetchGigs reads campusFilter out of its closure, so it has to run after
    // React has applied the new state rather than in the same tick.
    setTimeout(() => fetchGigs(0, true), 0);
  };

  return (
    <div className="pb-2">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-bold text-[var(--w-faint)]">THE TASK BOARD</p>
          <h1
            className="mt-1.5 text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em] text-[var(--w-ink-strong)] sm:text-[34px]"
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            Explore work
          </h1>
          <p className="mt-2 max-w-[52ch] text-[14.5px] leading-[1.6] text-[var(--w-muted)]">
            Open tasks from students and companies. Apply, get picked, get paid through escrow.
          </p>
        </div>

        {/* Two options, so a segmented control rather than a dropdown: it shows
            both states at once and costs one tap instead of three. */}
        <div
          role="group"
          aria-label="Filter by campus"
          className="inline-flex rounded-[11px] border border-[var(--w-line-strong)] bg-[var(--w-raised)] p-1"
        >
          {([
            ["ALL", "All campuses", Globe2],
            ["MY_CAMPUS", "My campus", MapPin],
          ] as const).map(([value, label, Icon]) => {
            const on = campusFilter === value;
            return (
              <button
                key={value}
                onClick={() => applyFilter(value)}
                aria-pressed={on}
                className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-[8px] px-3.5 text-[13.5px] font-bold transition-colors ${
                  on
                    ? "bg-[var(--w-orange)] text-[#371448]"
                    : "text-[var(--w-muted)] hover:bg-[var(--chip)]"
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            );
          })}
        </div>
      </header>

      {/* A real responsive grid. This was `columns-2 md:columns-3 lg:columns-4`
          inside a `max-w-xl` wrapper — four masonry columns sharing 36rem, so
          every card rendered about 9rem wide no matter the size of the screen. */}
      <div className="mt-8">
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <GigCardCompactSkeleton key={i} />
            ))}
          </div>
        ) : gigs.length === 0 ? (
          <div className="rounded-[16px] border border-[var(--w-line-strong)] bg-[var(--w-raised)] px-6 py-14 text-center">
            <div className="relative mx-auto h-36 w-36">
              <Image
                src="/sleeping_sloth.png"
                alt=""
                fill
                sizes="144px"
                className="object-contain opacity-90"
              />
            </div>
            <h2
              className="mt-4 text-[22px] font-extrabold tracking-[-0.02em] text-[var(--w-ink-strong)]"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              {campusFilter === "MY_CAMPUS" ? "Nothing on your campus yet" : "Quiet here for now"}
            </h2>
            <p className="mx-auto mt-2 max-w-[42ch] text-[14px] leading-[1.6] text-[var(--w-muted)]">
              {campusFilter === "MY_CAMPUS"
                ? "Try all campuses — most of this work is remote anyway."
                : "No open tasks right now. Post one and students will come to you."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {campusFilter === "MY_CAMPUS" && (
                <button
                  onClick={() => applyFilter("ALL")}
                  className="min-h-[44px] rounded-[11px] border border-[var(--w-line-strong)] px-5 text-[14px] font-bold text-[var(--w-ink)] transition-colors hover:bg-[var(--chip)]"
                >
                  Show all campuses
                </button>
              )}
              <button
                onClick={() => router.push("/post")}
                className="min-h-[44px] rounded-[11px] bg-[var(--w-orange)] px-5 text-[14px] font-bold text-[#371448] transition-opacity hover:opacity-90"
              >
                Post a task
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {gigs.map((gig, index) => {
                  const imageUrl = gig.images && gig.images[0]
                    ? supabase.storage.from("gig-images").getPublicUrl(gig.images[0]).data.publicUrl
                    : null;
                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.22, delay: Math.min(index * 0.025, 0.25) }}
                      key={gig.id}
                    >
                      <GigCard gig={gig} imageUrl={imageUrl} variant="compact" />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {hasMore && (
              <div className="pt-9 text-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="min-h-[44px] rounded-[11px] border border-[var(--w-line-strong)] bg-[var(--w-raised)] px-6 text-[14px] font-bold text-[var(--w-ink)] transition-colors hover:bg-[var(--chip)] disabled:opacity-50"
                >
                  {loadingMore ? "Loading" : "Show more work"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
