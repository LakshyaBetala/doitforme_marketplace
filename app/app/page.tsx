import { createServer } from "@/lib/supabaseServer";
import { resolveApp } from "@/lib/appIdentity.server";
import { type AppRole } from "@/lib/appShell";
import { isOverdue, stageLabel, OPEN_STAGES } from "@/lib/innerCircle";
import { platformFeeFor } from "@/lib/fees";
import { AGENCY_FEE_AUDIENCE } from "@/lib/agency";
import { SectionTitle, Card, Stat, Pill, Empty, inr } from "@/components/app/ui";

/**
 * TODAY — the only screen that has to exist.
 *
 * The question that opens this app is always the same: what needs me now, and
 * what am I owed. A home screen that answers neither is a menu, and a menu is
 * what makes an app feel like a website with bigger buttons. So this screen is
 * two stats and one list of things that are actually waiting, per role, and
 * nothing else.
 *
 * Every figure shown to a student is NET — what lands in their account. CLAUDE.md
 * is explicit about this: a student told "₹12,000" who receives ₹10,800 has been
 * misled however correct the arithmetic was, and the first payout is the
 * conversation that decides whether they believe anything else here.
 */
export default async function Today() {
  // Same resolver as the layout, so the tabs and the screen can never disagree
  // about which surface this is.
  const { userId, role } = await resolveApp();
  if (!userId || !role) return null;

  if (role === "TECH") return <TechToday userId={userId} />;
  if (role === "OUTREACH") return <OutreachToday userId={userId} />;
  return <LeadToday role={role} userId={userId} />;
}

/* -------------------------------------------------------------------------- */
/* BUILDER                                                                    */
/* -------------------------------------------------------------------------- */

async function TechToday({ userId }: { userId: string }) {
  const supabase = await createServer();

  // Driven from the work itself, ordered by its own deadline, so nothing can be
  // starved the way an unordered LIMIT once starved 316 gigs (CLAUDE.md).
  const { data: live } = await supabase
    .from("gigs")
    .select("id, title, status, price, payment_status, auto_release_at, delivered_at")
    .eq("assigned_worker_id", userId)
    .in("status", ["assigned", "DELIVERED"])
    .order("created_at", { ascending: true })
    .limit(20);

  const { data: done } = await supabase
    .from("gigs")
    .select("price")
    .eq("assigned_worker_id", userId)
    .eq("status", "completed")
    .limit(200);

  const gigs = live ?? [];
  // Gross in, net out. The fee is the recipient's, so this is what arrives.
  const netOf = (p: number) => p - platformFeeFor(p, AGENCY_FEE_AUDIENCE);
  const inFlight = gigs.reduce((a, g) => a + netOf(Number(g.price) || 0), 0);
  const earned = (done ?? []).reduce((a, g) => a + netOf(Number(g.price) || 0), 0);
  const awaitingReview = gigs.filter((g) => g.status === "DELIVERED").length;

  return (
    <>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Stat label="In flight" value={inr(inFlight)} sub={`${gigs.length} open`} tone="money" />
        <Stat label="Earned" value={inr(earned)} sub="paid out, net" tone="money" />
      </div>

      <SectionTitle>Your work</SectionTitle>
      {gigs.length === 0 ? (
        <Empty
          title="Nothing assigned right now"
          hint="When a project lead gives you a brief it lands here, with its deadline and what it pays."
        />
      ) : (
        <div className="space-y-2.5">
          {gigs.map((g) => (
            <Card key={g.id} href={`/gig/${g.id}`}>
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 flex-1 text-[15px] font-semibold leading-snug">{g.title}</p>
                {g.status === "DELIVERED" ? (
                  <Pill tone="ok">In review</Pill>
                ) : (
                  <Pill tone="warn">To build</Pill>
                )}
              </div>
              <p className="icapp-num mt-2 text-[13px] font-semibold text-[var(--a-gold)]">
                {inr(netOf(Number(g.price) || 0))}
                <span className="font-normal text-[var(--a-fg-faint)]"> to you</span>
              </p>
            </Card>
          ))}
        </div>
      )}

      {awaitingReview > 0 ? (
        <p className="mt-4 text-[12.5px] leading-relaxed text-[var(--a-fg-muted)]">
          {awaitingReview} submitted and waiting on review. Payment releases
          automatically 24 hours after delivery unless changes are requested.
        </p>
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* PARTNER                                                                    */
/* -------------------------------------------------------------------------- */

async function OutreachToday({ userId }: { userId: string }) {
  const supabase = await createServer();

  const { data: leadRows } = await supabase
    .from("outreach_leads")
    .select("id, company_name, stage, next_action_at, won_value")
    .eq("owner_id", userId)
    .order("next_action_at", { ascending: true, nullsFirst: false })
    .limit(50);

  const { data: commissions } = await supabase
    .from("outreach_commissions")
    // No `paid_at` column exists; a tranche's state is its gig's state.
    .select("amount, gig:gig_id(status)")
    .limit(200);

  const leads = leadRows ?? [];
  const open = leads.filter((l) => OPEN_STAGES.includes(l.stage as never));
  const due = leads.filter((l) => isOverdue(l as { stage: string; next_action_at?: string | null }));
  const owed = (commissions ?? [])
    .filter((c) => (c.gig as { status?: string } | null)?.status !== "completed")
    .reduce((a, c) => a + (Number(c.amount) || 0), 0);

  return (
    <>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Stat label="Owed to you" value={inr(owed)} sub="raised, not yet paid" tone="money" />
        <Stat
          label="Needs a nudge"
          value={String(due.length)}
          sub={`${open.length} live`}
          tone={due.length > 0 ? "warn" : "plain"}
        />
      </div>

      <SectionTitle>Follow up today</SectionTitle>
      {due.length === 0 ? (
        <Empty
          title="You are on top of it"
          hint="Leads appear here on the day you said you would chase them. Nothing is overdue."
        />
      ) : (
        <div className="space-y-2.5">
          {due.slice(0, 8).map((l) => (
            <Card key={l.id} href="/inner-circle/outreach">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 flex-1 text-[15px] font-semibold leading-snug">
                  {l.company_name}
                </p>
                <Pill tone="bad">Overdue</Pill>
              </div>
              <p className="mt-1.5 text-[12.5px] text-[var(--a-fg-muted)]">
                {stageLabel(String(l.stage))}
              </p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* PROJECT LEAD / FOUNDER                                                     */
/* -------------------------------------------------------------------------- */

async function LeadToday({ role, userId }: { role: AppRole; userId: string }) {
  const supabase = await createServer();

  // An admin sees everything (is_admin() in the policy); a PM sees their own.
  const base = supabase
    .from("projects")
    .select("id, client_name, service_key, deal_value, due_on, accepted_at, handed_over_at")
    .is("handed_over_at", null)
    .is("cancelled_at", null)
    .order("due_on", { ascending: true, nullsFirst: false })
    .limit(30);

  const { data: rows } = role === "ADMIN" ? await base : await base.eq("pm_id", userId);
  const projects = rows ?? [];
  const value = projects.reduce((a, p) => a + (Number(p.deal_value) || 0), 0);

  const today = new Date().toISOString().slice(0, 10);
  const late = projects.filter((p) => p.due_on && String(p.due_on) < today);

  return (
    <>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Stat label="In delivery" value={String(projects.length)} sub={inr(value) + " of work"} />
        <Stat
          label="Past due"
          value={String(late.length)}
          sub={late.length ? "needs a call" : "all on time"}
          tone={late.length > 0 ? "warn" : "plain"}
        />
      </div>

      <SectionTitle>Projects</SectionTitle>
      {projects.length === 0 ? (
        <Empty
          title="No projects in delivery"
          hint="A project appears here once it is created with a signed scope and a deal value."
        />
      ) : (
        <div className="space-y-2.5">
          {projects.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 flex-1 text-[15px] font-semibold leading-snug">
                  {p.client_name}
                </p>
                {p.due_on && String(p.due_on) < today ? (
                  <Pill tone="bad">Late</Pill>
                ) : p.accepted_at ? (
                  <Pill tone="ok">Accepted</Pill>
                ) : (
                  <Pill tone="neutral">Building</Pill>
                )}
              </div>
              <p className="icapp-num mt-2 text-[13px] text-[var(--a-fg-muted)]">
                {inr(Number(p.deal_value) || 0)}
                {p.due_on ? ` · due ${String(p.due_on)}` : ""}
              </p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
