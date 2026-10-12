import { createServer } from "@/lib/supabaseServer";
import { platformFeeFor, PLATFORM_FEES } from "@/lib/fees";
import { AGENCY_FEE_AUDIENCE } from "@/lib/agency";
import { SectionTitle, Card, Stat, Pill, Empty, inr } from "@/components/app/ui";

export const metadata = { title: "Earnings" };

/**
 * EARNINGS — a top-level tab, not a section inside a work list.
 *
 * "What am I owed" is the question a person paid per outcome opens an app to
 * answer, and burying it one level down is how it stops being believed. It is
 * also the only screen that distinguishes EARNED from PAID, which is the
 * distinction that matters when somebody is waiting on money.
 *
 * Everything here is NET, and the fee is shown rather than hidden. CLAUDE.md:
 * the product only ever shows net, because a student told one number who
 * receives a smaller one has been misled however correct the arithmetic was.
 * Showing the deduction explicitly is what makes the net figure trustworthy
 * instead of merely smaller.
 */
export default async function Earnings() {
  const supabase = await createServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: gigs }, { data: commissions }] = await Promise.all([
    supabase
      .from("gigs")
      .select("id, title, price, status, payment_status")
      .eq("assigned_worker_id", user.id)
      .limit(200),
    // RLS already restricts these to the owner; earnings are deliberately not
    // team-readable (20261012_agency_program.sql).
    supabase.from("outreach_commissions").select("id, amount, tranche, paid_at, lead_id").limit(200),
  ]);

  const net = (p: number) => p - platformFeeFor(p, AGENCY_FEE_AUDIENCE);
  const all = gigs ?? [];
  const paidGigs = all.filter((g) => g.status === "completed");
  const pendingGigs = all.filter((g) => g.status !== "completed" && g.status !== "cancelled");

  const paid = paidGigs.reduce((a, g) => a + net(Number(g.price) || 0), 0);
  const pending = pendingGigs.reduce((a, g) => a + net(Number(g.price) || 0), 0);

  const comms = commissions ?? [];
  const commPaid = comms.filter((c) => c.paid_at).reduce((a, c) => a + (Number(c.amount) || 0), 0);
  const commOwed = comms.filter((c) => !c.paid_at).reduce((a, c) => a + (Number(c.amount) || 0), 0);

  const totalPaid = paid + commPaid;
  const totalOwed = pending + commOwed;
  const feePct = Math.round(PLATFORM_FEES[AGENCY_FEE_AUDIENCE] * 100);

  return (
    <>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Stat label="Paid to you" value={inr(totalPaid)} sub="net, in your account" tone="money" />
        <Stat
          label="Still coming"
          value={inr(totalOwed)}
          sub="in flight or awaiting payout"
          tone="money"
        />
      </div>

      {comms.length > 0 ? (
        <>
          <SectionTitle>Commission</SectionTitle>
          <div className="space-y-2.5">
            {comms.slice(0, 20).map((c) => (
              <Card key={c.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-semibold">
                      {c.tranche === 1 ? "On first payment" : "On client acceptance"}
                    </p>
                    <p className="mt-0.5 text-[12px] text-[var(--a-fg-faint)]">
                      {c.tranche === 1 ? "40% tranche" : "60% tranche"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="icapp-num text-[15px] font-semibold text-[var(--a-gold)]">
                      {inr(Number(c.amount) || 0)}
                    </p>
                    {c.paid_at ? <Pill tone="ok">Paid</Pill> : <Pill tone="warn">Owed</Pill>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : null}

      <SectionTitle>From briefs</SectionTitle>
      {paidGigs.length === 0 && pendingGigs.length === 0 ? (
        <Empty
          title="Nothing yet"
          hint="Every brief you deliver shows here with exactly what reached your account."
        />
      ) : (
        <div className="space-y-2.5">
          {[...pendingGigs, ...paidGigs].slice(0, 25).map((g) => (
            <Card key={g.id} href={`/gig/${g.id}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 flex-1 text-[14.5px] font-medium leading-snug">{g.title}</p>
                <div className="shrink-0 text-right">
                  <p className="icapp-num text-[14.5px] font-semibold text-[var(--a-gold)]">
                    {inr(net(Number(g.price) || 0))}
                  </p>
                  {g.status === "completed" ? (
                    <Pill tone="ok">Paid</Pill>
                  ) : (
                    <Pill tone="neutral">Open</Pill>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <p className="mt-5 text-[12.5px] leading-relaxed text-[var(--a-fg-muted)]">
        Amounts shown are what reaches you. DoItForMe takes {feePct}% of a brief
        to run escrow, verification and payouts; the figure above is already
        after that, never before. Payouts are made by hand, so there is a person
        to ask if one is late.
      </p>
    </>
  );
}
