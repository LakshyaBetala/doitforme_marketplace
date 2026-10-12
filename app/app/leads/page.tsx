import { createServer } from "@/lib/supabaseServer";
import { OUTREACH_STAGES, stageLabel, isOverdue, OPEN_STAGES } from "@/lib/innerCircle";
import { SectionTitle, Card, Pill, Empty, inr } from "@/components/app/ui";

export const metadata = { title: "Leads" };

/**
 * LEADS — the partner's pipeline, grouped by stage.
 *
 * Grouped rather than filtered by tabs: a pipeline is a shape, and seeing where
 * it is thin is the whole reason to look at one. Four filter chips would hide
 * that and add a tap.
 *
 * Writes still happen on the website's /inner-circle/outreach screen. That is
 * deliberate for now — the lead form has stage rules and a uniqueness
 * constraint on the company name behind it, and a second, half-equivalent
 * editor in the app would be the drift CLAUDE.md keeps warning about. The app
 * answers "who do I chase today"; the web form does the data entry.
 */
export default async function Leads() {
  const supabase = await createServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("outreach_leads")
    .select("id, company_name, stage, next_action_at, won_value, created_at")
    .eq("owner_id", user.id)
    .order("next_action_at", { ascending: true, nullsFirst: false })
    .limit(200);

  const leads = data ?? [];
  if (leads.length === 0) {
    return (
      <>
        <SectionTitle>Pipeline</SectionTitle>
        <Empty
          title="No leads yet"
          hint="Add the companies you are talking to on the web dashboard. They appear here with whoever is due a chase."
        />
        <Card className="mt-3" href="/inner-circle/outreach">
          <p className="text-[14.5px] font-semibold">Open the lead desk</p>
          <p className="mt-1 text-[12.5px] text-[var(--a-fg-muted)]">Add and edit leads there.</p>
        </Card>
      </>
    );
  }

  const open = leads.filter((l) => OPEN_STAGES.includes(l.stage as never));
  const won = leads.filter((l) => l.stage === "won");
  const wonValue = won.reduce((a, l) => a + (Number(l.won_value) || 0), 0);

  return (
    <>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Card>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--a-fg-faint)]">
            Live
          </p>
          <p className="icapp-num mt-1 text-[22px] font-semibold">{open.length}</p>
        </Card>
        <Card>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--a-fg-faint)]">
            Won
          </p>
          <p className="icapp-num mt-1 text-[22px] font-semibold text-[var(--a-gold)]">
            {inr(wonValue)}
          </p>
        </Card>
      </div>

      {OUTREACH_STAGES.map((s) => {
        const rows = leads.filter((l) => l.stage === s.value);
        if (rows.length === 0) return null;
        return (
          <div key={s.value}>
            <SectionTitle>
              {stageLabel(s.value)} · {rows.length}
            </SectionTitle>
            <div className="space-y-2.5">
              {rows.map((l) => {
                const late = isOverdue(l as { stage: string; next_action_at?: string | null });
                return (
                  <Card key={l.id} href="/inner-circle/outreach">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 flex-1 text-[15px] font-semibold leading-snug">
                        {l.company_name}
                      </p>
                      {late ? (
                        <Pill tone="bad">Overdue</Pill>
                      ) : l.stage === "won" ? (
                        <Pill tone="ok">Won</Pill>
                      ) : null}
                    </div>
                    {l.next_action_at ? (
                      <p className="mt-1.5 text-[12.5px] text-[var(--a-fg-muted)]">
                        Next action {new Date(l.next_action_at).toLocaleDateString("en-IN")}
                      </p>
                    ) : null}
                    {l.won_value ? (
                      <p className="icapp-num mt-1.5 text-[13px] font-semibold text-[var(--a-gold)]">
                        {inr(Number(l.won_value))}
                      </p>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
