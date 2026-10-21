"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight, Plus, ShieldCheck, Users, Clock, IndianRupee,
  CheckCircle2, Upload, Wallet2, Sparkles,
} from "lucide-react";
import GigCard from "@/components/ui/GigCard";
import Skeleton, { GigCardSkeleton } from "@/components/ui/Skeleton";
import ProfileCompletion from "@/components/ProfileCompletion";
import { Reveal, Stagger, StaggerItem, CountUp } from "@/components/motion";

/**
 * Overview — what needs you, and what you are owed.
 *
 * This page used to be a second feed with its own 72px top bar carrying the
 * logo, a search box, a Refer & Earn chip, a messages button, the notification
 * bell and a profile dropdown; then a filter rail; then the same gig list that
 * /feed renders. Against a persistent sidebar that is three navigations for one
 * product, and it is why the brief asked for "no menu options repeating two
 * times". The bar is gone — its one-of-a-kind contents (log out, install app,
 * enable alerts) moved into the sidebar account menu, and the bell and inbox
 * into the top bar, so nothing was dropped on the floor.
 *
 * What replaces it is the thing a landing surface should do and never did:
 * answer "is anything waiting on me". Those actions existed only if you went
 * looking for them on /activity — a poster with five applicants and an unfunded
 * escrow saw a gig list indistinguishable from a stranger's.
 *
 * Earnings are folded in here, which is where /payouts goes. There is still no
 * Wallet: payouts are manual, so a withdrawable balance would be a promise we
 * cannot keep. This shows what is owed and links to the record.
 */

type ActionItem = {
  id: string;
  href: string;
  label: string;
  detail: string;
  tone: "act" | "wait";
  icon: typeof Users;
};

const lower = (v: unknown) => String(v ?? "").toLowerCase();

export default function Overview() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [owed, setOwed] = useState(0);
  const [paid, setPaid] = useState(0);
  const [fresh, setFresh] = useState<any[]>([]);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return router.push("/login");

      const nowIso = new Date().toISOString();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [dbUserRes, postedRes, workingRes, payoutRes, freshRes] = await Promise.all([
        supabase.from("users").select("*").eq("id", authUser.id).single(),

        // What I posted that is still live, with how many people applied.
        supabase
          .from("gigs")
          .select("id, title, status, payment_status, price, auto_release_at, applications(count)")
          .eq("poster_id", authUser.id)
          .not("status", "in", "(completed,cancelled)")
          .order("created_at", { ascending: false })
          .limit(30),

        // What I am being paid to do.
        supabase
          .from("gigs")
          .select("id, title, status, payment_status, price, auto_release_at")
          .eq("assigned_worker_id", authUser.id)
          .not("status", "in", "(completed,cancelled)")
          .order("created_at", { ascending: false })
          .limit(30),

        supabase.from("payout_queue").select("amount, status").eq("worker_id", authUser.id),

        // A short taste of the board. Deliberately a glance, not a feed — the
        // filters, pagination and campus toggle all live on /feed, and having
        // two of them is the duplication this redesign exists to remove.
        supabase
          .from("gigs")
          .select("*, users:poster_id(college), companies:company_id(name), applications(count)")
          .neq("poster_id", authUser.id)
          .eq("status", "open")
          .is("assigned_worker_id", null)
          .is("source_service_id", null)
          .in("listing_type", ["HUSTLE", "COMPANY_TASK"])
          .or(`deadline.is.null,deadline.gt.${nowIso}`)
          .or(`listing_type.eq.COMPANY_TASK,created_at.gt.${thirtyDaysAgo}`)
          .order("created_at", { ascending: false })
          .limit(3),
      ]);

      const dbUser = dbUserRes.data;
      if (dbUser?.role === "COMPANY") return router.push("/company/dashboard");
      setUser({ ...authUser, user_metadata: { ...authUser.user_metadata, ...dbUser } });

      // ---- derive the action list ------------------------------------------
      const items: ActionItem[] = [];

      for (const g of (postedRes.data as any[]) || []) {
        const status = lower(g.status);
        const pay = lower(g.payment_status);
        const applicants = Array.isArray(g.applications) ? g.applications[0]?.count ?? 0 : 0;

        if (status === "open" && applicants > 0) {
          items.push({
            id: `pick-${g.id}`, href: `/gig/${g.id}`, tone: "act", icon: Users,
            label: `${applicants} ${applicants === 1 ? "person" : "people"} applied`,
            detail: g.title,
          });
        } else if (status === "assigned" && pay !== "held") {
          // Nothing starts until escrow is funded, so this is the most expensive
          // item on the page to leave sitting.
          items.push({
            id: `fund-${g.id}`, href: `/gig/${g.id}`, tone: "act", icon: ShieldCheck,
            label: "Add money to escrow to start",
            detail: g.title,
          });
        } else if (status === "delivered") {
          const hrs = g.auto_release_at
            ? Math.max(0, Math.round((new Date(g.auto_release_at).getTime() - Date.now()) / 36e5))
            : null;
          items.push({
            id: `review-${g.id}`, href: `/gig/${g.id}`, tone: "act", icon: CheckCircle2,
            label: "Work delivered — review it",
            detail: hrs !== null ? `${g.title} · releases on its own in ${hrs}h` : g.title,
          });
        }
      }

      for (const g of (workingRes.data as any[]) || []) {
        const status = lower(g.status);
        if (status === "assigned") {
          items.push({
            id: `deliver-${g.id}`, href: `/gig/${g.id}`, tone: "act", icon: Upload,
            label: lower(g.payment_status) === "held" ? "Money is held — submit your work" : "You are hired for this",
            detail: g.title,
          });
        } else if (status === "delivered") {
          items.push({
            id: `await-${g.id}`, href: `/gig/${g.id}`, tone: "wait", icon: Clock,
            label: "Waiting for the client to approve",
            detail: g.title,
          });
        }
      }

      // Act-now before waiting-on-someone-else. Nothing else about the order is
      // meaningful, and a stable sort stops it reshuffling between loads.
      items.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "act" ? -1 : 1));
      setActions(items.slice(0, 6));

      const payouts = (payoutRes.data as any[]) || [];
      setOwed(payouts.filter((p) => lower(p.status) === "pending").reduce((s, p) => s + Number(p.amount || 0), 0));
      setPaid(payouts.filter((p) => lower(p.status) === "completed").reduce((s, p) => s + Number(p.amount || 0), 0));

      setFresh(
        ((freshRes.data as any[]) || []).map((g) => ({
          ...g,
          applicant_count: Array.isArray(g.applications) ? g.applications[0]?.count ?? 0 : 0,
        }))
      );

      const dismissed = localStorage.getItem(`doitforme_prefs_dismissed_${authUser.id}`);
      if ((!dbUser?.preferences || dbUser.preferences.length === 0) && !dismissed) {
        setShowPreferencesModal(true);
      }
      setLoading(false);
    };
    load();
  }, [router, supabase]);

  if (loading) return <OverviewSkeleton />;

  const meta = user?.user_metadata || {};
  const firstName = String(meta.name || meta.full_name || user?.email?.split("@")[0] || "there").split(" ")[0];
  const kycDone = Boolean(meta.kyc_verified);
  const needsAction = actions.filter((a) => a.tone === "act").length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="pb-2">
      {/* ---- greeting ---------------------------------------------------- */}
      <Reveal immediate>
        <p className="text-[14px] font-bold text-[var(--w-faint)]">
          {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1
          className="mt-1.5 text-[34px] font-extrabold leading-[1.08] tracking-[-0.03em] text-[var(--w-ink-strong)] sm:text-[42px]"
          style={{ fontFamily: "var(--font-display), sans-serif" }}
        >
          {greeting}, {firstName}
        </h1>
        <p className="mt-2.5 text-[16px] leading-[1.6] text-[var(--w-muted)]">
          {needsAction > 0
            ? `${needsAction} ${needsAction === 1 ? "thing needs" : "things need"} you today.`
            : actions.length > 0
            ? "Nothing needs you right now — a couple of things are with other people."
            : "Nothing waiting on you. Good time to find work."}
        </p>
      </Reveal>

      {/* ---- the two things you can start -------------------------------- */}
      <Stagger immediate delay={0.1} className="mt-8 grid gap-4 sm:grid-cols-2">
        <StaggerItem>
          <Link
            href="/post"
            className="card-lift group relative flex h-full items-center gap-5 overflow-hidden rounded-[22px] bg-[linear-gradient(115deg,#351144_0%,#5b1479_63%,#8324af_100%)] p-7"
          >
            <span aria-hidden className="absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/[0.07]" />
            <span className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-[var(--w-orange)] text-[#371448] transition-transform duration-300 group-hover:rotate-90">
              <Plus size={30} strokeWidth={2.8} />
            </span>
            <span className="relative min-w-0">
              <span
                className="block text-[22px] font-extrabold tracking-[-0.02em] text-white"
                style={{ fontFamily: "var(--font-display), sans-serif" }}
              >
                Post a task
              </span>
              <span className="mt-1 block text-[15px] leading-[1.5] text-white/80">
                Need something done? Get offers in minutes.
              </span>
            </span>
          </Link>
        </StaggerItem>
        <StaggerItem>
          <Link
            href="/feed"
            className="card-lift group flex h-full items-center gap-5 rounded-[22px] border border-[var(--w-line-strong)] bg-[var(--w-raised)] p-7"
          >
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-[var(--w-violet-soft)] text-[var(--w-violet)] transition-transform duration-300 group-hover:scale-110">
              <Sparkles size={28} />
            </span>
            <span className="min-w-0">
              <span
                className="block text-[22px] font-extrabold tracking-[-0.02em] text-[var(--w-ink-strong)]"
                style={{ fontFamily: "var(--font-display), sans-serif" }}
              >
                Find work
              </span>
              <span className="mt-1 block text-[15px] leading-[1.5] text-[var(--w-muted)]">
                Open tasks from students and companies.
              </span>
            </span>
          </Link>
        </StaggerItem>
      </Stagger>

      {/* ---- needs you --------------------------------------------------- */}
      {actions.length > 0 && (
        <section className="mt-11">
          <div className="flex items-center gap-3">
            <h2 className="text-[20px] font-extrabold tracking-[-0.02em] text-[var(--w-ink-strong)]">
              Needs you
            </h2>
            {needsAction > 0 && (
              <span className="soft-ping flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--w-orange)] px-2 text-[13px] font-extrabold text-[#371448]">
                {needsAction}
              </span>
            )}
          </div>
          <Stagger as="ul" className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3" gap={0.07}>
            {actions.map((a) => {
              const Icon = a.icon;
              const act = a.tone === "act";
              return (
                <StaggerItem as="li" key={a.id}>
                  <Link
                    href={a.href}
                    className="card-lift group flex items-center gap-4 rounded-[18px] border border-[var(--w-line-strong)] bg-[var(--w-raised)] p-5"
                  >
                    <span
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] ${
                        act
                          ? "bg-[var(--w-orange-soft)] text-[var(--w-orange-ink)]"
                          : "bg-[var(--w-violet-soft)] text-[var(--w-violet)]"
                      }`}
                    >
                      <Icon size={22} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block sm:truncate text-[16.5px] font-bold text-[var(--w-ink-strong)]">
                        {a.label}
                      </span>
                      <span className="block line-clamp-2 sm:line-clamp-1 text-[14.5px] text-[var(--w-muted)]">{a.detail}</span>
                    </span>
                    <span
                      className={`hidden shrink-0 rounded-full px-3 py-1 text-[12.5px] font-bold sm:block ${
                        act ? "bg-[var(--w-orange-soft)] text-[var(--w-orange-ink)]" : "bg-[var(--chip)] text-[var(--w-muted)]"
                      }`}
                    >
                      {act ? "Your turn" : "Waiting"}
                    </span>
                    <ArrowRight
                      size={20}
                      className="shrink-0 text-[var(--w-faint)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--w-violet)]"
                    />
                  </Link>
                </StaggerItem>
              );
            })}
          </Stagger>
        </section>
      )}

      {/* ---- earnings, folded in from /payouts --------------------------- */}
      {(owed > 0 || paid > 0) && (
        <Reveal as="section" className="mt-11">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[20px] font-extrabold tracking-[-0.02em] text-[var(--w-ink-strong)]">
                Your earnings
              </h2>
              {/* Honest about the mechanism. Calling this a balance would imply
                  a withdraw button, and there isn't one — a person pays these. */}
              <p className="mt-0.5 text-[14.5px] text-[var(--w-muted)]">
                Paid out by hand, usually within a day of release.
              </p>
            </div>
            <Link
              href="/payouts"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[11px] px-3.5 text-[14px] font-bold text-[var(--w-violet)] hover:bg-[var(--w-violet-soft)]"
            >
              See all <ArrowRight size={15} />
            </Link>
          </div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[20px] bg-[var(--w-orange-soft)] p-6">
              <dt className="flex items-center gap-2 text-[14px] font-bold text-[var(--w-orange-ink)]">
                <Wallet2 size={17} /> Owed to you
              </dt>
              <dd
                className="mt-2 flex items-center text-[38px] font-extrabold tracking-[-0.03em] text-[#5c3407]"
                style={{ fontFamily: "var(--font-display), sans-serif" }}
              >
                <IndianRupee size={30} strokeWidth={2.6} />
                <CountUp to={owed} />
              </dd>
            </div>
            <div className="rounded-[20px] border border-[var(--w-line-strong)] bg-[var(--w-raised)] p-6">
              <dt className="flex items-center gap-2 text-[14px] font-bold text-[var(--w-muted)]">
                <CheckCircle2 size={17} /> Paid so far
              </dt>
              <dd
                className="mt-2 flex items-center text-[38px] font-extrabold tracking-[-0.03em] text-[var(--w-ink-strong)]"
                style={{ fontFamily: "var(--font-display), sans-serif" }}
              >
                <IndianRupee size={30} strokeWidth={2.6} />
                <CountUp to={paid} />
              </dd>
            </div>
          </dl>
        </Reveal>
      )}

      {/* ---- nudges ------------------------------------------------------ */}
      <Reveal className="mt-11 grid gap-4 empty:hidden">
        <ProfileCompletion user={user?.user_metadata} />

        {!kycDone && (
          <Link
            href="/verify-id"
            className="card-lift flex items-center gap-4 rounded-[18px] border border-[var(--w-line-strong)] bg-[var(--w-raised)] p-5"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[var(--w-violet-soft)] text-[var(--w-violet)]">
              <ShieldCheck size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16.5px] font-bold text-[var(--w-ink-strong)]">
                Verify your student ID
              </span>
              <span className="block text-[14.5px] text-[var(--w-muted)]">
                Any student ID works — school, college or graduate. Takes a minute.
              </span>
            </span>
            <ArrowRight size={20} className="shrink-0 text-[var(--w-faint)]" />
          </Link>
        )}
      </Reveal>

      {/* ---- a glance at the board --------------------------------------- */}
      {fresh.length > 0 && (
        <section className="mt-12">
          <Reveal>
            <div className="flex items-end justify-between gap-4">
              <h2 className="text-[20px] font-extrabold tracking-[-0.02em] text-[var(--w-ink-strong)]">
                Fresh on the board
              </h2>
              <Link
                href="/feed"
                className="inline-flex min-h-[44px] items-center gap-1.5 text-[14px] font-bold text-[var(--w-violet)] hover:underline"
              >
                Explore all work <ArrowRight size={15} />
              </Link>
            </div>
          </Reveal>
          <Stagger className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {fresh.map((gig) => (
              <StaggerItem key={gig.id} className="h-full">
                <GigCard gig={gig} variant="detailed" className="h-full" />
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      )}

      {showPreferencesModal && (
        <PreferencesModal
          user={user}
          supabase={supabase}
          onClose={() => {
            if (user?.id) localStorage.setItem(`doitforme_prefs_dismissed_${user.id}`, "1");
            setShowPreferencesModal(false);
          }}
        />
      )}
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="pb-2">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-3 h-9 w-56" />
      <Skeleton className="mt-3 h-4 w-72" />
      <div className="mt-7 grid gap-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[74px] rounded-[13px]" />
        ))}
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-[96px] rounded-[16px]" />
        <Skeleton className="h-[96px] rounded-[16px]" />
      </div>
      <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <GigCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

function PreferencesModal({ user, supabase, onClose }: { user: any; supabase: any; onClose: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const categories = [
    "Tech & Engineering", "Design & Creative", "Science & Medical", "Law & Humanities",
    "Commerce & Finance", "Academics & Gigs", "Errands & Manual Labor", "Writing & Content",
    "Tutoring", "Other",
  ];

  const handleToggle = (cat: string) => {
    if (selected.includes(cat)) setSelected(selected.filter((c) => c !== cat));
    else if (selected.length < 5) setSelected([...selected, cat]);
  };

  const handleSave = async () => {
    if (selected.length === 0) return;
    setLoading(true);
    await supabase.from("users").update({ preferences: selected }).eq("id", user.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2d1937]/55 p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-[18px] border border-[var(--w-line-strong)] bg-[var(--w-raised)] p-6 sm:p-8">
        <h2
          className="text-[22px] font-extrabold tracking-[-0.02em] text-[var(--w-ink-strong)]"
          style={{ fontFamily: "var(--font-display), sans-serif" }}
        >
          What kind of work interests you?
        </h2>
        <p className="mt-2 text-[14px] leading-[1.6] text-[var(--w-muted)]">
          Pick up to five. We use this to decide what to show you first, and what to email you about.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {categories.map((cat) => {
            const on = selected.includes(cat);
            return (
              <button
                key={cat}
                onClick={() => handleToggle(cat)}
                aria-pressed={on}
                className={`min-h-[40px] rounded-[10px] border px-3.5 text-[13px] font-bold transition-colors ${
                  on
                    ? "border-[var(--w-orange)] bg-[var(--w-orange)] text-[#371448]"
                    : "border-[var(--w-line-strong)] text-[var(--w-ink)] hover:bg-[var(--chip)]"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
        <div className="mt-7 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={loading || selected.length === 0}
            className="min-h-[46px] flex-1 rounded-[11px] bg-[var(--w-orange)] px-5 text-[14.5px] font-bold text-[#371448] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Saving" : "Save"}
          </button>
          <button
            onClick={onClose}
            className="min-h-[46px] rounded-[11px] px-4 text-[14px] font-bold text-[var(--w-muted)] hover:bg-[var(--chip)]"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
