import { createServer } from "@/lib/supabaseServer";
import LogoutButton from "@/components/app/LogoutButton";
import { isAdminEmail } from "@/lib/admins";
import { appRoleFor, ROLE_TITLE, ROLE_BLURB } from "@/lib/appShell";
import { SectionTitle, Card, Pill } from "@/components/app/ui";
import { stepsFor, type Owner } from "@/lib/operations";
import type { AppRole } from "@/lib/appShell";

/**
 * The app's role names map onto the pipeline's OWNER names.
 *
 * They are deliberately different vocabularies: `Owner` is who is accountable
 * for a step in the operating model, `AppRole` is which surface somebody sees.
 * A builder is a BUILDER in the pipeline and TECH in the database, and
 * collapsing the two would mean renaming one of them every time the other
 * changed.
 */
const OWNER_FOR: Record<AppRole, Owner> = {
  TECH: "BUILDER",
  OUTREACH: "OUTREACH",
  PM: "PM",
  ADMIN: "ADMIN",
};

export const metadata = { title: "Me" };

/**
 * ME — the membership screen.
 *
 * This is where the tier is made explicit. Not a settings page: those links go
 * to the website, where settings already live and already work, and
 * reimplementing them in the app would be two places to get a UPI change wrong.
 * What belongs here is the one thing the website cannot say as well — that this
 * person was let in, when, and what that entitles them to.
 */
export default async function Me() {
  const supabase = await createServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: pmRows }] = await Promise.all([
    supabase
      .from("users")
      .select("name, email, is_elite, inner_circle_role, kyc_status, rating, jobs_completed, upi_id")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("projects").select("id").eq("pm_id", user.id).limit(1),
  ]);

  const role = appRoleFor({
    isAdmin: isAdminEmail(user.email),
    isPm: Boolean(pmRows && pmRows.length > 0),
    isElite: profile?.is_elite,
    innerCircleRole: profile?.inner_circle_role,
  });
  if (!role) return null;

  return (
    <>
      <div className="mt-5 rounded-[var(--a-r-card)] border border-[var(--a-accent-line)] bg-[var(--a-accent-soft)] p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--a-accent-ink)]">
            {ROLE_TITLE[role]}
          </p>
          <Pill tone="ok">Member</Pill>
        </div>
        <p className="mt-2 text-[17px] font-semibold leading-snug">{profile?.name || "Member"}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--a-fg-muted)]">
          {ROLE_BLURB[role]}
        </p>
      </div>

      <SectionTitle>Standing</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--a-fg-faint)]">
            Delivered
          </p>
          <p className="icapp-num mt-1 text-[22px] font-semibold">{profile?.jobs_completed ?? 0}</p>
        </Card>
        <Card>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--a-fg-faint)]">
            Rating
          </p>
          <p className="icapp-num mt-1 text-[22px] font-semibold">
            {profile?.rating ? Number(profile.rating).toFixed(1) : "—"}
          </p>
        </Card>
      </div>

      {/*
        A payout cannot be released without a UPI id — the release RPC refuses
        — so a missing one is the single thing most likely to hold up somebody's
        money, and it is worth one prompt here rather than a surprise at
        delivery. CLAUDE.md: it is collected at submission, not at signup.
      */}
      {!profile?.upi_id ? (
        <Card className="mt-3 !border-[rgba(224,162,60,0.3)] !bg-[var(--a-warn-soft)]" href="/profile/worker-setup">
          <p className="text-[14px] font-semibold text-[var(--a-warn)]">Add your UPI id</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--a-fg-muted)]">
            Payouts cannot be released without it. Takes a minute.
          </p>
        </Card>
      ) : null}

      {/*
        YOUR STEPS — the operating model, filtered to this person.
        PIPELINE in lib/operations.ts is the single source of truth for who owns
        what and how long they have. Rendering the owner's slice here means
        nobody has to be told the process verbally, which is the only version
        that was ever available before.
      */}
      <SectionTitle>What you own</SectionTitle>
      <div className="space-y-2.5">
        {stepsFor(OWNER_FOR[role]).map((s, i) => (
          <Card key={s.key}>
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 flex-1 text-[14.5px] font-semibold leading-snug">
                {i + 1}. {s.title}
              </p>
              {s.clock === null ? (
                <Pill tone="neutral">no clock</Pill>
              ) : (
                <Pill tone="warn">
                  {s.clock}d
                </Pill>
              )}
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--a-fg-muted)]">{s.exit}</p>
            {s.clock !== null ? (
              <p className="mt-1 text-[11.5px] text-[var(--a-fg-faint)]">
                {s.clock} working day{s.clock === 1 ? "" : "s"} from {s.from}
              </p>
            ) : null}
          </Card>
        ))}
      </div>

      <SectionTitle>Settings</SectionTitle>
      <div className="space-y-2.5">
        {[
          { href: "/profile", label: "Profile and skills" },
          { href: "/settings/notifications", label: "Notifications" },
          { href: "/program/terms", label: "Programme terms" },
          { href: "/payouts", label: "Payout history" },
        ].map((l) => (
          <Card key={l.href} href={l.href}>
            <p className="text-[14.5px] font-semibold">{l.label}</p>
          </Card>
        ))}
      </div>

      <div className="mt-7">
        <LogoutButton />
      </div>
    </>
  );
}
