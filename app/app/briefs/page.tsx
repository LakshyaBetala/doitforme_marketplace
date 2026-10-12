import { createServer } from "@/lib/supabaseServer";
import { workflowFor, workflowHeadline } from "@/lib/innerCircle";
import { platformFeeFor } from "@/lib/fees";
import { AGENCY_FEE_AUDIENCE } from "@/lib/agency";
import { SectionTitle, Card, Pill, Empty, inr } from "@/components/app/ui";

export const metadata = { title: "Briefs" };

/**
 * BRIEFS — every piece of work assigned to this builder, and the one next step
 * on each.
 *
 * The step is DERIVED by workflowFor() from the gig row, not stored. There are
 * already three state machines describing one gig (`status`, `payment_status`,
 * `managed_status`) and CLAUDE.md records what happens when a fourth is added:
 * the one that disagrees with the money is always the one the UI reads.
 */
export default async function Briefs() {
  const supabase = await createServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("gigs")
    .select(
      "id, title, status, price, payment_status, delivered_at, auto_release_at, dispute_reason, handshake_code",
    )
    .eq("assigned_worker_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const gigs = data ?? [];
  const open = gigs.filter((g) => g.status !== "completed" && g.status !== "cancelled");
  const past = gigs.filter((g) => g.status === "completed");
  const net = (p: number) => p - platformFeeFor(p, AGENCY_FEE_AUDIENCE);

  return (
    <>
      <SectionTitle>Live</SectionTitle>
      {open.length === 0 ? (
        <Empty
          title="No live briefs"
          hint="A brief shows up here the moment a project lead assigns it to you, with its deadline and what it pays you."
        />
      ) : (
        <div className="space-y-2.5">
          {open.map((g) => {
            const head = workflowHeadline(workflowFor(g as never));
            return (
              <Card key={g.id} href={`/gig/${g.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 text-[15px] font-semibold leading-snug">{g.title}</p>
                  {g.dispute_reason ? (
                    <Pill tone="bad">Disputed</Pill>
                  ) : g.status === "DELIVERED" ? (
                    <Pill tone="ok">In review</Pill>
                  ) : (
                    <Pill tone="warn">To build</Pill>
                  )}
                </div>
                {head ? (
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--a-fg-muted)]">
                    {/* `owner` is shown so nobody waits on themselves by
                        mistake — it is the whole point of the headline step. */}
                    {head.owner === "you" ? "Your move: " : "Waiting on them: "}
                    {head.title}
                  </p>
                ) : null}
                <p className="icapp-num mt-2 text-[13px] font-semibold text-[var(--a-gold)]">
                  {inr(net(Number(g.price) || 0))}
                  <span className="font-normal text-[var(--a-fg-faint)]"> to you</span>
                </p>
              </Card>
            );
          })}
        </div>
      )}

      {past.length > 0 ? (
        <>
          <SectionTitle>Delivered</SectionTitle>
          <div className="space-y-2.5">
            {past.slice(0, 15).map((g) => (
              <Card key={g.id} href={`/gig/${g.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 text-[14.5px] font-medium leading-snug text-[var(--a-fg-muted)]">
                    {g.title}
                  </p>
                  <span className="icapp-num shrink-0 text-[13px] font-semibold text-[var(--a-gold)]">
                    {inr(net(Number(g.price) || 0))}
                  </span>
                </div>
              </Card>
            ))}
          </div>
          {/*
            This list is the thing a portfolio cannot fake: dated, client-paid,
            third-party-verified delivery. It is the moat argument made visible
            to the person it belongs to.
          */}
          <p className="mt-4 text-[12.5px] leading-relaxed text-[var(--a-fg-muted)]">
            {past.length} delivered and paid through escrow. This record is
            verifiable by anyone you show it to — it is not a portfolio claim.
          </p>
        </>
      ) : null}
    </>
  );
}
