import { createServer } from "@/lib/supabaseServer";
import { isAdminEmail } from "@/lib/admins";
import { SectionTitle, Card, Pill, Empty, inr } from "@/components/app/ui";

export const metadata = { title: "Projects" };

/**
 * PROJECTS — the delivery book, for a project lead or the founder.
 *
 * Reads `projects`, whose RLS does the compartmentalising: a PM sees the rows
 * where they are `pm_id`, an admin sees all, and a builder reaching this URL
 * sees nothing because the layout never renders the tab for them AND the policy
 * returns no rows. Two layers, as intended.
 *
 * The stage is derived from the gate timestamps rather than read from a status
 * column, because `projects` deliberately has no status column — see the long
 * note in 20261013_projects_and_pm_desk.sql about a second state machine beside
 * the money being the one that goes stale.
 */
export default async function Projects() {
  const supabase = await createServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = isAdminEmail(user.email);
  let q = supabase
    .from("projects")
    .select(
      "id, client_name, service_key, deal_value, due_on, scope_signed_at, first_payment_at, kickoff_at, integrated_at, accepted_at, handed_over_at, cancelled_at",
    )
    .order("due_on", { ascending: true, nullsFirst: false })
    .limit(60);
  if (!admin) q = q.eq("pm_id", user.id);

  const { data } = await q;
  const rows = data ?? [];
  const live = rows.filter((p) => !p.handed_over_at && !p.cancelled_at);
  const closed = rows.filter((p) => p.handed_over_at);
  const today = new Date().toISOString().slice(0, 10);

  const stage = (p: (typeof rows)[number]) => {
    if (p.cancelled_at) return { label: "Cancelled", tone: "bad" as const };
    if (p.handed_over_at) return { label: "Handed over", tone: "ok" as const };
    if (p.accepted_at) return { label: "Accepted", tone: "ok" as const };
    if (p.integrated_at) return { label: "Integrating", tone: "neutral" as const };
    if (p.kickoff_at) return { label: "Building", tone: "neutral" as const };
    if (p.first_payment_at) return { label: "Paid, not started", tone: "warn" as const };
    if (p.scope_signed_at) return { label: "Awaiting payment", tone: "warn" as const };
    return { label: "Scoping", tone: "warn" as const };
  };

  return (
    <>
      <SectionTitle>In delivery</SectionTitle>
      {live.length === 0 ? (
        <Empty
          title="Nothing in delivery"
          hint="Projects are created from the admin desk once a scope is signed. Each one carries its client, its value and its deadline."
        />
      ) : (
        <div className="space-y-2.5">
          {live.map((p) => {
            const s = stage(p);
            const late = p.due_on && String(p.due_on) < today;
            return (
              <Card key={p.id}>
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 text-[15px] font-semibold leading-snug">
                    {p.client_name}
                  </p>
                  {late ? <Pill tone="bad">Late</Pill> : <Pill tone={s.tone}>{s.label}</Pill>}
                </div>
                <p className="mt-1.5 text-[12.5px] text-[var(--a-fg-muted)]">
                  {String(p.service_key).replace(/_/g, " ").toLowerCase()}
                </p>
                <p className="icapp-num mt-2 text-[13px] font-semibold">
                  {inr(Number(p.deal_value) || 0)}
                  {p.due_on ? (
                    <span className="font-normal text-[var(--a-fg-faint)]">
                      {" "}
                      · due {String(p.due_on)}
                    </span>
                  ) : null}
                </p>
              </Card>
            );
          })}
        </div>
      )}

      {closed.length > 0 ? (
        <>
          <SectionTitle>Handed over</SectionTitle>
          <div className="space-y-2.5">
            {closed.slice(0, 20).map((p) => (
              <Card key={p.id}>
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 flex-1 text-[14.5px] font-medium text-[var(--a-fg-muted)]">
                    {p.client_name}
                  </p>
                  <span className="icapp-num shrink-0 text-[13px] font-semibold">
                    {inr(Number(p.deal_value) || 0)}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
