import Link from "next/link";
import { createServer } from "@/lib/supabaseServer";
import {
  FALLBACK_ROLES,
  applicationStage,
  STAGE_COPY,
  APPLICATION_STAGES,
  type RoleRow,
} from "@/lib/innerCircle";

/**
 * WHAT A NON-MEMBER SEES WHEN THEY OPEN THE APP.
 *
 * This replaced a dead end, and the correction matters commercially. The app is
 * listed publicly and anyone can install it — downloads are the point — so the
 * most common first run is somebody with no account and no membership. Telling
 * that person "invite only" and stopping is the worst possible outcome: they
 * uninstall, and the install was wasted.
 *
 * So this screen RECRUITS. It is the same funnel the website runs, rendered for
 * a phone: what the Inner Circle is, which roles are open right now, what is
 * opening next, and — if they have already applied — exactly where their
 * application stands. Someone who stumbles on the app before the website gets a
 * route in rather than a locked door.
 *
 * The stage is DERIVED by applicationStage() from the application row's
 * timestamps, not stored. Same reason as everywhere else in this codebase: a
 * status column beside the facts is the one that goes stale.
 */
export default async function JoinScreen({ userId }: { userId: string }) {
  const supabase = await createServer();

  const [{ data: roleRows }, { data: application }] = await Promise.all([
    // Anon-readable on purpose — it is the role list on a public page and holds
    // nothing but labels and a status. Asserted positively in the anon audit.
    supabase
      .from("inner_circle_roles")
      .select("value, label, tagline, blurb, status, seats, sort")
      .order("sort", { ascending: true }),
    supabase
      .from("inner_circle_applications")
      .select("id, role, status, created_at, screened_at, task_sent_at, decided_at, score")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // A dropped query must not make the product look like it has no roles.
  const roles: RoleRow[] = (roleRows as RoleRow[] | null)?.length
    ? (roleRows as RoleRow[])
    : FALLBACK_ROLES;
  const open = roles.filter((r) => r.status === "open");
  const planned = roles.filter((r) => r.status === "planned");

  if (application) {
    return <Applied application={application} />;
  }

  return (
    <div className="mx-auto w-full max-w-[520px] px-5 pb-16" style={{ paddingTop: "calc(var(--a-safe-top) + 28px)" }}>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--a-accent-ink)]">
        Inner Circle
      </p>
      <h1
        className="mt-3 text-[30px] font-semibold leading-[1.08] tracking-tight"
        style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}
      >
        Get paid for real client work
      </h1>
      <p className="mt-3.5 text-[14.5px] leading-relaxed text-[var(--a-fg-muted)]">
        The Inner Circle is the team that delivers paid projects for real
        companies. Money is held in escrow before you start, so the work is
        funded before you touch it. Members are chosen after two paid trial
        tasks — the trials are the application, and they pay either way.
      </p>

      <h2 className="mb-3 mt-8 text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--a-fg-faint)]">
        Open now
      </h2>
      <div className="space-y-3">
        {open.map((r) => (
          <Link
            key={r.value}
            href={`/inner-circle?role=${encodeURIComponent(r.value)}`}
            className="icapp-press block rounded-[var(--a-r-card)] border border-[var(--a-accent-line)] bg-[var(--a-surface)] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[16px] font-semibold leading-snug">{r.label}</p>
                <p className="mt-0.5 text-[12.5px] font-medium text-[var(--a-accent-ink)]">
                  {r.tagline}
                </p>
              </div>
              {/* Seats are shown because a cohort with a number is a cohort
                  somebody can miss. Hidden when it is genuinely undecided
                  rather than invented. */}
              {r.seats ? (
                <span className="shrink-0 rounded-full border border-[var(--a-line-strong)] px-2.5 py-1 text-[11px] font-bold text-[var(--a-fg-muted)]">
                  {r.seats} seats
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--a-fg-muted)]">{r.blurb}</p>
            <p className="mt-3 text-[13px] font-semibold text-[var(--a-accent-ink)]">
              Apply for this →
            </p>
          </Link>
        ))}
      </div>

      {planned.length > 0 ? (
        <>
          <h2 className="mb-3 mt-8 text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--a-fg-faint)]">
            Opening next
          </h2>
          <div className="space-y-2.5">
            {planned.map((r) => (
              <div
                key={r.value}
                className="rounded-[var(--a-r-card)] border border-dashed border-[var(--a-line-strong)] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[15px] font-semibold text-[var(--a-fg-muted)]">{r.label}</p>
                  <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-[var(--a-fg-faint)]">
                    Soon
                  </span>
                </div>
                {r.tagline ? (
                  <p className="mt-1 text-[12.5px] text-[var(--a-fg-faint)]">{r.tagline}</p>
                ) : null}
              </div>
            ))}
          </div>
          {/* The roster grows on purpose, and saying so is what makes a
              "planned" role worth advertising rather than a tease. */}
          <p className="mt-3 text-[12.5px] leading-relaxed text-[var(--a-fg-faint)]">
            New roles open as the work arrives. Applying for an open one now is
            the fastest route in.
          </p>
        </>
      ) : null}

      <div className="mt-9 space-y-3">
        <Link
          href="/inner-circle"
          className="icapp-press flex min-h-[52px] w-full items-center justify-center rounded-[var(--a-r-ctl)] bg-[var(--a-accent)] px-5 text-[15px] font-semibold text-[var(--a-on-accent)]"
        >
          Start an application
        </Link>
        {/*
          The second route in, and not a consolation prize. Someone who is not
          ready for the Inner Circle can still earn on the marketplace, and the
          delivery record they build there is what a future application is
          judged on. It is the honest next step, not a redirect to get rid of
          them.
        */}
        <Link
          href="/dashboard"
          className="icapp-press flex min-h-[52px] w-full items-center justify-center rounded-[var(--a-r-ctl)] border border-[var(--a-line-strong)] bg-[var(--a-surface)] px-5 text-[15px] font-semibold text-[var(--a-fg)]"
        >
          Browse open gigs instead
        </Link>
      </div>
    </div>
  );
}

type AppRow = {
  role?: string | null;
  status?: string | null;
  created_at?: string | null;
  screened_at?: string | null;
  task_sent_at?: string | null;
  decided_at?: string | null;
  score?: number | null;
};

/**
 * Where an existing application stands.
 *
 * "We will get back to you" is what makes an applicant give up, so this shows
 * the actual four stages and which one they are on. The stage is derived from
 * the row's own timestamps by applicationStage().
 */
function Applied({ application }: { application: AppRow }) {
  const stage = applicationStage(application as never);
  const copy = STAGE_COPY[stage];
  const idx = APPLICATION_STAGES.indexOf(stage);
  const decided = stage === "decided";
  const approved = decided && application.status === "approved";

  return (
    <div className="mx-auto w-full max-w-[520px] px-5 pb-16" style={{ paddingTop: "calc(var(--a-safe-top) + 28px)" }}>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--a-accent-ink)]">
        Your application
      </p>
      <h1
        className="mt-3 text-[27px] font-semibold leading-[1.1] tracking-tight"
        style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}
      >
        {copy.label}
      </h1>
      <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--a-fg-muted)]">{copy.hint}</p>

      <ol className="mt-7 space-y-3">
        {APPLICATION_STAGES.map((s, i) => {
          const done = i < idx;
          const now = i === idx;
          return (
            <li
              key={s}
              className={`flex items-center gap-3 rounded-[var(--a-r-ctl)] border px-4 py-3 ${
                now
                  ? "border-[var(--a-accent-line)] bg-[var(--a-accent-soft)]"
                  : "border-[var(--a-line)] bg-[var(--a-surface)]"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  done
                    ? "bg-[var(--a-ok-soft)] text-[var(--a-ok)]"
                    : now
                      ? "bg-[var(--a-accent)] text-[var(--a-on-accent)]"
                      : "bg-[var(--a-surface-3)] text-[var(--a-fg-faint)]"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span
                className={`text-[14px] font-semibold ${
                  now ? "text-[var(--a-fg)]" : done ? "text-[var(--a-fg-muted)]" : "text-[var(--a-fg-faint)]"
                }`}
              >
                {STAGE_COPY[s].label}
              </span>
            </li>
          );
        })}
      </ol>

      {approved ? (
        <p className="mt-6 rounded-[var(--a-r-card)] border border-[rgba(78,192,138,0.28)] bg-[var(--a-ok-soft)] p-4 text-[13.5px] leading-relaxed text-[var(--a-ok)]">
          You are in. Close and reopen the app to load your workspace — if it
          still shows this screen, your role has not been set yet and an admin
          needs to finish the approval.
        </p>
      ) : null}

      <div className="mt-8 space-y-3">
        <Link
          href="/inner-circle"
          className="icapp-press flex min-h-[52px] w-full items-center justify-center rounded-[var(--a-r-ctl)] border border-[var(--a-line-strong)] bg-[var(--a-surface)] px-5 text-[15px] font-semibold text-[var(--a-fg)]"
        >
          See the full application
        </Link>
        <Link
          href="/dashboard"
          className="icapp-press flex min-h-[52px] w-full items-center justify-center rounded-[var(--a-r-ctl)] border border-[var(--a-line-strong)] bg-[var(--a-surface)] px-5 text-[15px] font-semibold text-[var(--a-fg-muted)]"
        >
          Earn on the marketplace meanwhile
        </Link>
      </div>
    </div>
  );
}
