import AppShell from "@/components/shell/AppShell";
import "../workspace-theme.css";
import { notFound } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import GigCard from "@/components/ui/GigCard";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge, { statusToTone, humanizeStatus } from "@/components/ui/StatusBadge";
import Skeleton, { GigCardSkeleton, GigCardCompactSkeleton } from "@/components/ui/Skeleton";
import Avatar from "@/components/ui/Avatar";
import { workflowFor } from "@/lib/innerCircle";
import { AlertTriangle, Check, Circle, Hammer } from "lucide-react";

/**
 * The design lab. Dev only.
 *
 * This exists because of a hole in how this redesign can be checked. Every
 * signed-in surface is behind an auth gate, Supabase Auth is answering 402, and
 * proxy.ts therefore redirects /dashboard, /feed, /activity, /messages,
 * /profile and the whole Inner Circle to /login. So the pages cannot be opened
 * at all — not by a person, and not by Playwright. Stubbing the network does not
 * help either: the gate is a SERVER component calling auth.getUser(), which a
 * browser-side route intercept never touches.
 *
 * What CAN be checked is the components, which is most of what "does the design
 * work" means. Everything below is the real primitive or the real derived logic
 * with sample props — not a mock of it — rendered inside the real shell, at every
 * state that matters: loading, empty, populated, error, blocked.
 *
 * It is also the thing to open when changing a token. The whole point of the
 * shared contract is that one change moves every surface at once, and this is
 * where you see whether it did.
 *
 * Refuses to exist in production.
 */

const GIG = {
  id: "demo-hustle",
  title: "Build a landing page for our campus fest",
  price: 4500,
  listing_type: "HUSTLE" as const,
  location: "Remote",
  is_physical: false,
  created_at: new Date(Date.now() - 3 * 3600_000).toISOString(),
  applicant_count: 4,
  users: { college: "Christ University" },
};

const COMPANY_GIG = {
  ...GIG,
  id: "demo-company",
  title: "React dashboard for an internal analytics tool",
  price: 18000,
  listing_type: "COMPANY_TASK" as const,
  is_featured: true,
  is_physical: true,
  company_id: "c1",
  companies: { name: "Nexa Labs" },
  applicant_count: 11,
};

const SERVICE_GIG = {
  ...GIG,
  id: "demo-service",
  title: "I design and build Framer sites for startups",
  price: 2500,
  listing_type: "SERVICE" as const,
  applicant_count: 2,
};

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12 first:mt-0">
      <h2
        className="text-[20px] font-extrabold tracking-[-0.02em] text-[var(--w-ink-strong)]"
        style={{ fontFamily: "var(--font-display), sans-serif" }}
      >
        {title}
      </h2>
      {note && (
        <p className="mt-1.5 max-w-[68ch] text-[13.5px] leading-[1.6] text-[var(--w-muted)]">
          {note}
        </p>
      )}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function DesignLab() {
  if (process.env.NODE_ENV === "production") notFound();

  const midFlight = workflowFor({
    assigned_worker_id: "w",
    payment_status: "HELD",
    status: "delivered",
  });
  const disputed = workflowFor({
    assigned_worker_id: "w",
    payment_status: "HELD",
    status: "delivered",
    dispute_reason: "not what we agreed",
  });

  return (
    <AppShell name="Alex Kumar" role="STUDENT" isElite innerCircleRole="TECH">
      <p className="text-[13px] font-bold text-[var(--w-faint)]">DEV ONLY</p>
      <h1
        className="mt-1.5 text-[32px] font-extrabold leading-[1.1] tracking-[-0.03em] text-[var(--w-ink-strong)] sm:text-[38px]"
        style={{ fontFamily: "var(--font-display), sans-serif" }}
      >
        Design lab
      </h1>
      <p className="mt-2 max-w-[62ch] text-[14.5px] leading-[1.6] text-[var(--w-muted)]">
        Every shared component, in every state, inside the real shell. Change a token in
        workspace-theme.css and this page is where you see what it moved.
      </p>

      <div className="mt-10">
        <Section
          title="Type scale"
          note="Manrope for display, DM Sans for everything else. Display sizes are set per-use rather than from a scale, because there are only four of them."
        >
          <div className="grid gap-3">
            <p
              className="text-[38px] font-extrabold leading-[1.05] tracking-[-0.03em] text-[var(--w-ink-strong)]"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              Page title, 38px
            </p>
            <p
              className="text-[22px] font-extrabold tracking-[-0.02em] text-[var(--w-ink-strong)]"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              Card heading, 22px
            </p>
            <p className="text-[15px] font-extrabold text-[var(--w-ink-strong)]">
              Section label, 15px bold
            </p>
            <p className="max-w-[62ch] text-[14.5px] leading-[1.65] text-[var(--w-muted)]">
              Body copy at 14.5px with 1.65 line height, held to roughly 62 characters. Measure
              matters more than size for whether a paragraph gets read.
            </p>
            <p className="text-[13px] font-bold text-[var(--w-faint)]">OVERLINE, 13px BOLD</p>
          </div>
        </Section>

        <Section
          title="Surfaces and hairlines"
          note="Depth comes from the surface scale and a hairline, never a drop shadow. The cream page is the lowest layer."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["--w-page", "Page"],
              ["--w-surface", "Surface"],
              ["--w-raised", "Raised (cards)"],
            ].map(([token, label]) => (
              <div
                key={token}
                className="rounded-[16px] border border-[var(--w-line-strong)] p-5"
                style={{ background: `var(${token})` }}
              >
                <p className="text-[14px] font-bold text-[var(--w-ink-strong)]">{label}</p>
                <code className="mt-1 block text-[12px] text-[var(--w-muted)]">{token}</code>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Buttons"
          note="One primary per surface. Every variant is token-based, so the same component is correct on the dark marketing pages too — and primary keeps a white label on the accent fill rather than --fg, which is what stops a theme sweep making it invisible."
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="primary" loading>
              Loading
            </Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {/* The orange CTA from the Figma. Orange carries dark grape text, not
                white — white on #ffa51e is 1.9:1 and fails badly. */}
            <button className="min-h-[46px] rounded-[11px] bg-[var(--w-orange)] px-5 text-[14.5px] font-bold text-[#371448] transition-opacity hover:opacity-90">
              Orange CTA
            </button>
            <Link
              href="#"
              className="inline-flex min-h-[46px] items-center rounded-[11px] border border-[var(--w-line-strong)] px-5 text-[14.5px] font-bold text-[var(--w-ink)] transition-colors hover:bg-[var(--chip)]"
            >
              Outline link
            </Link>
          </div>
        </Section>

        <Section
          title="Status pills"
          note="Every status in the product renders through statusToTone(). Never an inline ternary of tailwind colors — that is how six pages end up with six greens."
        >
          <div className="flex flex-wrap gap-2">
            {[
              "open", "applied", "pending", "assigned", "held", "delivered",
              "completed", "released", "paid", "disputed", "refunded", "cancelled",
            ].map((s) => (
              <StatusBadge key={s} tone={statusToTone(s)}>
                {humanizeStatus(s)}
              </StatusBadge>
            ))}
          </div>
        </Section>

        <Section
          title="Gig cards"
          note="The one component shared between the cream workspace and the dark public /talent page. Compact is the feed grid; detailed is the overview list."
        >
          <p className="mb-3 text-[12.5px] font-bold text-[var(--w-faint)]">COMPACT</p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <GigCard gig={GIG} variant="compact" />
            <GigCard gig={COMPANY_GIG} variant="compact" />
            <GigCard gig={SERVICE_GIG} variant="compact" />
          </div>
          <p className="mb-3 mt-7 text-[12.5px] font-bold text-[var(--w-faint)]">DETAILED</p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <GigCard gig={GIG} variant="detailed" />
            <GigCard gig={COMPANY_GIG} variant="detailed" />
            <GigCard gig={SERVICE_GIG} variant="detailed" />
          </div>
        </Section>

        <Section title="Loading" note="Content-shaped skeletons, never a centered spinner on a populated page.">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <GigCardCompactSkeleton />
            <GigCardSkeleton />
            <div className="rounded-[16px] border border-[var(--w-line-strong)] bg-[var(--w-raised)] p-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-7 w-40" />
              <Skeleton className="mt-3 h-3 w-full" />
              <Skeleton className="mt-1.5 h-3 w-2/3" />
            </div>
          </div>
        </Section>

        <Section title="Empty states" note="A zero state should say what to do next, not just that there is nothing.">
          <div className="grid gap-5 lg:grid-cols-2">
            <EmptyState
              sloth="/sleeping_sloth.png"
              title="Quiet here for now"
              description="No open tasks right now. Post one and students will come to you."
              actionLabel="Post a task"
              actionHref="#"
            />
            <EmptyState
              icon={Hammer}
              title="No briefs yet"
              description="We put members forward as company work comes in."
              actionLabel="Explore open work"
              actionHref="#"
            />
          </div>
        </Section>

        <Section
          title="The derived tech workflow"
          note="Projected from the gig row by workflowFor(), not stored. Left: funded and delivered, waiting on the client. Right: the same brief disputed — blocked, not 'in review', because nothing is in motion and it is on us."
        >
          <div className="grid gap-5 lg:grid-cols-2">
            {[
              ["Mid-flight", midFlight],
              ["Disputed", disputed],
            ].map(([label, steps]) => (
              <div
                key={label as string}
                className="rounded-[16px] border border-[var(--w-line-strong)] bg-[var(--w-raised)] p-6"
              >
                <p className="mb-4 text-[12.5px] font-bold text-[var(--w-faint)]">
                  {String(label).toUpperCase()}
                </p>
                <ol className="grid">
                  {(steps as ReturnType<typeof workflowFor>).map((s, i, arr) => {
                    const dot =
                      s.state === "done"
                        ? "border-[var(--ok-solid)] bg-[var(--ok-solid)] text-white"
                        : s.state === "blocked"
                        ? "border-[var(--bad-solid)] bg-[var(--bad-solid)] text-white"
                        : s.state === "current"
                        ? "border-[var(--w-orange)] bg-[var(--w-orange)] text-[#371448]"
                        : "border-[var(--w-line-strong)] bg-[var(--w-raised)] text-[var(--w-faint)]";
                    return (
                      <li key={s.key} className="flex gap-3.5">
                        <div className="flex flex-col items-center">
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${dot}`}
                          >
                            {s.state === "done" ? (
                              <Check size={14} strokeWidth={3} />
                            ) : s.state === "blocked" ? (
                              <AlertTriangle size={13} strokeWidth={2.6} />
                            ) : (
                              <Circle size={s.state === "current" ? 9 : 7} strokeWidth={5} />
                            )}
                          </span>
                          {i !== arr.length - 1 && (
                            <span
                              className={`mt-1 w-[2px] flex-1 rounded ${
                                s.state === "done" ? "bg-[var(--ok-line)]" : "bg-[var(--w-line)]"
                              }`}
                            />
                          )}
                        </div>
                        <div className={`min-w-0 pb-4 ${s.state === "todo" ? "opacity-60" : ""}`}>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[14px] font-bold text-[var(--w-ink-strong)]">
                              {s.title}
                            </p>
                            {(s.state === "current" || s.state === "blocked") && (
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide ${
                                  s.owner === "you"
                                    ? "bg-[var(--w-orange-soft)] text-[var(--w-orange-ink)]"
                                    : "bg-[var(--w-violet-soft)] text-[var(--w-violet)]"
                                }`}
                              >
                                {s.owner === "you"
                                  ? "Your move"
                                  : s.owner === "client"
                                  ? "With the client"
                                  : "With us"}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[12.5px] leading-[1.55] text-[var(--w-muted)]">
                            {s.detail}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Form fields" note="16px minimum on inputs, or iOS zooms the page on focus and never zooms back.">
          <div className="grid max-w-[640px] gap-4">
            <div>
              <label htmlFor="dl-a" className="block text-[12.5px] font-bold text-[var(--w-ink-strong)]">
                Company
              </label>
              <input
                id="dl-a"
                placeholder="Who are we talking to?"
                className="mt-1.5 min-h-[46px] w-full rounded-[11px] border border-[var(--w-line-strong)] bg-white px-3.5 text-[15px] text-[var(--w-ink)] outline-none focus-visible:border-[var(--w-violet)]"
              />
            </div>
            <div>
              <label htmlFor="dl-b" className="block text-[12.5px] font-bold text-[var(--w-ink-strong)]">
                Notes
              </label>
              <textarea
                id="dl-b"
                rows={3}
                placeholder="Anything the next person would want to know."
                className="mt-1.5 w-full resize-none rounded-[11px] border border-[var(--w-line-strong)] bg-white px-3.5 py-3 text-[15px] text-[var(--w-ink)] outline-none focus-visible:border-[var(--w-violet)]"
              />
            </div>
            <div>
              <label htmlFor="dl-c" className="block text-[12.5px] font-bold text-[var(--w-ink-strong)]">
                Stage
              </label>
              <select
                id="dl-c"
                className="mt-1.5 min-h-[46px] w-full rounded-[11px] border border-[var(--w-line-strong)] bg-[var(--w-raised)] px-3 text-[15px] font-semibold text-[var(--w-ink)]"
              >
                <option>New</option>
                <option>Contacted</option>
              </select>
            </div>
            <div>
              <label htmlFor="dl-d" className="block text-[12.5px] font-bold text-[var(--w-ink-strong)]">
                Next action
              </label>
              {/* The date picker is the reason .workspace sets color-scheme:light.
                  Inheriting the global dark setting paints this control black. */}
              <input
                id="dl-d"
                type="date"
                className="mt-1.5 min-h-[46px] w-full rounded-[11px] border border-[var(--w-line-strong)] bg-white px-3.5 text-[15px] text-[var(--w-ink)] outline-none focus-visible:border-[var(--w-violet)]"
              />
            </div>
            <p role="alert" className="text-[13px] text-[var(--bad)]">
              Inline error text sits under the field it belongs to.
            </p>
          </div>
        </Section>

        <Section title="Cards and avatars">
          <div className="grid gap-5 sm:grid-cols-2">
            <Card>
              <p className="text-[14px] font-bold text-[var(--w-ink-strong)]">Card, default</p>
              <p className="mt-1 text-[13px] text-[var(--w-muted)]">bg-[var(--surface)] + hairline.</p>
            </Card>
            <Card variant="elevated">
              <p className="text-[14px] font-bold text-[var(--w-ink-strong)]">Card, elevated</p>
              <p className="mt-1 text-[13px] text-[var(--w-muted)]">For modals and popovers.</p>
            </Card>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <Avatar fallback="Alex" className="h-8 w-8" />
            <Avatar fallback="Nexa Labs" className="h-10 w-10" textClassName="text-base" />
            <Avatar fallback="Priya" className="h-14 w-14" textClassName="text-xl" />
          </div>
        </Section>

        <Section
          title="The grape panel"
          note="The one loud surface, matching the sidebar so it reads as brand rather than promo. Used on Overview and the Inner Circle hero, and nowhere else."
        >
          <div className="overflow-hidden rounded-[16px] bg-[linear-gradient(115deg,#351144_0%,#5b1479_63%,#8324af_100%)] p-7 sm:p-9">
            <p className="text-[13px] font-bold text-[#ffd28c]">Invite only</p>
            <h3
              className="mt-2 max-w-[20ch] text-[28px] font-extrabold leading-[1.08] tracking-[-0.03em] text-white sm:text-[34px]"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              The Inner Circle
            </h3>
            <p className="mt-3 max-w-[48ch] text-[14.5px] leading-[1.65] text-white/85">
              A small group of students we put in front of real companies first.
            </p>
            <button className="mt-6 min-h-[46px] rounded-[11px] bg-[var(--w-orange)] px-5 text-[14.5px] font-bold text-[#371448]">
              Ask to join
            </button>
          </div>
        </Section>
      </div>
    </AppShell>
  );
}
