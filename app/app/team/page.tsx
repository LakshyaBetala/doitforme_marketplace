import { createServer } from "@/lib/supabaseServer";
import { SectionTitle, Card, Pill, Empty } from "@/components/app/ui";

export const metadata = { title: "Team" };

/**
 * TEAM — who is in the Inner Circle, and who is free.
 *
 * The question a project lead has before raising a brief is "who can take
 * this", and the answer is a function of role plus how much is already on
 * someone. Nothing in the product answered it; staffing happened in a chat.
 *
 * NO CONTACT DETAILS ARE SHOWN. `users` has column privileges precisely so a
 * screen like this cannot leak an email or a phone number (CLAUDE.md: every
 * student's email, phone and UPI were once dumpable with the anon key), and a
 * staffing screen does not need them — the PM already has a chat thread. Name,
 * role and current load is the whole useful answer.
 */
export default async function Team() {
  const supabase = await createServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: members } = await supabase
    .from("users")
    .select("id, name, username, inner_circle_role, jobs_completed, rating")
    .eq("is_elite", true)
    .limit(100);

  const roster = members ?? [];
  if (roster.length === 0) {
    return (
      <>
        <SectionTitle>Inner Circle</SectionTitle>
        <Empty
          title="No members yet"
          hint="Approved members appear here with their role and how much work they are carrying."
        />
      </>
    );
  }

  // One query for the whole roster's live load, then grouped in memory. A query
  // per member would be a request per row, which is the pattern that turns a
  // roster screen into forty round trips.
  const { data: liveGigs } = await supabase
    .from("gigs")
    .select("assigned_worker_id")
    .in("status", ["assigned", "DELIVERED"])
    .in(
      "assigned_worker_id",
      roster.map((m) => m.id),
    )
    .limit(1000);

  const load = new Map<string, number>();
  for (const g of liveGigs ?? []) {
    const k = String(g.assigned_worker_id);
    load.set(k, (load.get(k) ?? 0) + 1);
  }

  const groups: { title: string; rows: typeof roster }[] = [
    { title: "Builders", rows: roster.filter((m) => m.inner_circle_role === "TECH") },
    { title: "Partners", rows: roster.filter((m) => m.inner_circle_role === "OUTREACH") },
    { title: "No role set", rows: roster.filter((m) => !m.inner_circle_role) },
  ];

  return (
    <>
      {groups.map((g) =>
        g.rows.length === 0 ? null : (
          <div key={g.title}>
            <SectionTitle>
              {g.title} · {g.rows.length}
            </SectionTitle>
            <div className="space-y-2.5">
              {g.rows.map((m) => {
                const n = load.get(m.id) ?? 0;
                return (
                  <Card key={m.id} href={m.username ? `/u/${m.username}` : undefined}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold leading-snug">
                          {m.name || m.username || "Member"}
                        </p>
                        <p className="mt-0.5 text-[12px] text-[var(--a-fg-faint)]">
                          {m.jobs_completed ?? 0} delivered
                          {m.rating ? ` · ${Number(m.rating).toFixed(1)}★` : ""}
                        </p>
                      </div>
                      {n === 0 ? (
                        <Pill tone="ok">Free</Pill>
                      ) : n >= 2 ? (
                        <Pill tone="warn">{n} on</Pill>
                      ) : (
                        <Pill tone="neutral">{n} on</Pill>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ),
      )}
      <p className="mt-5 text-[12.5px] leading-relaxed text-[var(--a-fg-muted)]">
        Two live briefs is a stretch for one person. Anyone showing two or more
        is a staffing risk, not spare capacity.
      </p>
    </>
  );
}
