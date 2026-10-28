"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Link from "next/link";
import { blurOnWheel } from "@/lib/inputs";
import { friendlyError } from "@/lib/errors";
import { INNER_CIRCLE_ROLES, type InnerCircleRole } from "@/lib/innerCircle";
import { ArrowRight, Check, Hammer, Loader2, ShieldCheck, Target } from "lucide-react";

/**
 * The Inner Circle.
 *
 * The tier already half-existed: users.is_elite has been in the schema since
 * the managed-mode pivot and the admin assignment desk sorts by it — but
 * nothing ever set it and nothing in the product mentioned it. This is the
 * front door, and 20261005_inner_circle.sql is the application trail behind it.
 *
 * Written as an invitation, not a sales page. The honest pitch is small: more
 * company work exists than there are people we trust to hand it to. Overselling
 * a tier that currently has zero members would be the fastest way to make it
 * worthless.
 */

type AppRow = {
  id: string;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  decision_note: string | null;
  created_at: string;
  role: InnerCircleRole;
};

const ROLE_ICON = { TECH: Hammer, OUTREACH: Target } as const;

const FIELD =
  "w-full min-h-[48px] rounded-[11px] border border-[var(--w-line-strong)] bg-white px-4 py-3 " +
  "text-[15px] text-[var(--w-ink)] placeholder:text-[var(--w-faint)] outline-none transition-colors " +
  "focus-visible:border-[var(--w-violet)]";

export default function InnerCirclePage() {
  const supabase = supabaseBrowser();
  const [loading, setLoading] = useState(true);
  const [isElite, setIsElite] = useState(false);
  const [application, setApplication] = useState<AppRow | null>(null);
  const [role, setRole] = useState<InnerCircleRole>("TECH");
  const [memberRole, setMemberRole] = useState<InnerCircleRole | null>(null);
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const [pitch, setPitch] = useState("");
  const [links, setLinks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return setLoading(false);

    const [{ data: profile }, { data: apps }] = await Promise.all([
      supabase
        .from("users")
        .select("is_elite, inner_circle_role, kyc_status")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("inner_circle_applications")
        .select("id, status, decision_note, created_at, role")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    setIsElite(Boolean(profile?.is_elite));
    setMemberRole((profile?.inner_circle_role as InnerCircleRole) ?? null);
    setKycStatus((profile?.kyc_status as string) ?? null);
    const latest = (apps?.[0] as AppRow) ?? null;
    setApplication(latest);
    // Pre-select whatever they asked for last time, so a re-application after a
    // rejection does not silently switch them back to the default role.
    if (latest?.role) setRole(latest.role);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const apply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pitch.trim().length < 40) {
      return setError("Tell us a bit more. A couple of sentences about what you do best.");
    }
    setSubmitting(true);
    setError("");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in again.");

      const { error: insertError } = await supabase.from("inner_circle_applications").insert({
        user_id: user.id,
        role,
        pitch: pitch.trim(),
        links: links
          .split(/[\s,]+/)
          .map((l) => l.trim())
          .filter(Boolean)
          .slice(0, 5),
      });
      if (insertError) throw insertError;
      await load();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const pending = application?.status === "pending";

  return (
    <div className="pb-4">
      {/* Hero. The grape panel is the page's one loud surface, matching the
          sidebar so membership reads as part of the brand rather than a promo. */}
      <section className="overflow-hidden rounded-[16px] bg-[linear-gradient(115deg,#351144_0%,#5b1479_63%,#8324af_100%)]">
        <div className="relative flex flex-col gap-6 p-7 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-[46ch]">
            <p className="text-[13px] font-bold text-[#ffd28c]">Invite only</p>
            <h1
              className="mt-2.5 text-[32px] font-extrabold leading-[1.05] tracking-[-0.03em] text-white sm:text-[40px]"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              The Inner Circle
            </h1>
            <p className="mt-4 text-[15px] leading-[1.65] text-white/85">
              A small group of students we put in front of real companies first. Paid briefs,
              proper budgets, and work worth putting your name on.
            </p>
          </div>
          <Image
            src="/sloth.png"
            alt=""
            width={148}
            height={148}
            className="hidden shrink-0 rounded-[26px] lg:block"
          />
        </div>
      </section>

      {/* Two roles, stated plainly. This is the first thing to understand about
          the tier, so it comes before anything is asked of the reader. */}
      <section className="mt-8">
        <h2 className="text-[15px] font-extrabold tracking-[-0.01em] text-[var(--w-ink-strong)]">
          There are two ways in
        </h2>
        <dl className="mt-3 grid gap-4 sm:grid-cols-2">
          {INNER_CIRCLE_ROLES.map((r) => {
            const Icon = ROLE_ICON[r.value];
            return (
              <div
                key={r.value}
                className="rounded-[16px] border border-[var(--w-line-strong)] bg-[var(--w-raised)] p-5"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-[var(--w-orange-soft)] text-[var(--w-orange-ink)]">
                  <Icon size={18} />
                </span>
                <dt className="mt-3.5 text-[15.5px] font-extrabold text-[var(--w-ink-strong)]">
                  {r.label}{" "}
                  <span className="font-semibold text-[var(--w-muted)]">&middot; {r.tagline}</span>
                </dt>
                <dd className="mt-1.5 text-[13.5px] leading-[1.65] text-[var(--w-muted)]">
                  {r.blurb}
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      {/* What membership means in practice. Three facts, no pricing-table dressing. */}
      <dl className="mt-7 grid gap-5 sm:grid-cols-3">
        {[
          ["Company briefs first", "You see paid company work before it reaches the open board."],
          ["We vouch for you", "We put your name forward directly instead of leaving you in a pile."],
          ["Same escrow", "Nothing changes about how you get paid. Money is held before you start."],
        ].map(([term, detail]) => (
          <div key={term} className="border-l-2 border-[var(--w-orange)] pl-4">
            <dt className="text-[14.5px] font-bold text-[var(--w-ink-strong)]">{term}</dt>
            <dd className="mt-1 text-[13.5px] leading-[1.6] text-[var(--w-muted)]">{detail}</dd>
          </div>
        ))}
      </dl>

      {/* State */}
      <section className="mt-8 rounded-[16px] border border-[var(--w-line-strong)] bg-[var(--w-raised)] p-6 sm:p-7">
        {loading ? (
          <div className="flex items-center gap-2.5 text-[14px] text-[var(--w-muted)]">
            <Loader2 size={18} className="animate-spin" />
            Checking your status
          </div>
        ) : isElite ? (
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--w-orange-soft)] px-3 py-1 text-[12px] font-bold text-[var(--w-orange-ink)]">
              <Check size={14} /> You&apos;re in
            </span>
            <h2
              className="mt-3.5 text-[22px] font-extrabold tracking-[-0.02em] text-[var(--w-ink-strong)]"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              You&apos;re in the Inner Circle
            </h2>
            <p className="mt-2 max-w-[52ch] text-[14px] leading-[1.65] text-[var(--w-muted)]">
              {memberRole === "OUTREACH"
                ? "Your pipeline is yours to work. Keep the next action set on every open lead and the day sorts itself."
                : "Company briefs come to you first. Keep your profile current so we can put you forward for the right ones."}
            </p>
            {memberRole && (
              <Link
                href={memberRole === "OUTREACH" ? "/inner-circle/outreach" : "/inner-circle/work"}
                className="mt-5 inline-flex min-h-[46px] items-center gap-2 rounded-[11px] bg-[var(--w-orange)] px-5 text-[14.5px] font-bold text-[#371448] transition-opacity hover:opacity-90"
              >
                {memberRole === "OUTREACH" ? "Open your pipeline" : "See your briefs"}
                <ArrowRight size={16} />
              </Link>
            )}
          </div>
        ) : pending ? (
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--w-violet-soft)] px-3 py-1 text-[12px] font-bold text-[var(--w-violet)]">
              Being reviewed
            </span>
            <h2
              className="mt-3.5 text-[22px] font-extrabold tracking-[-0.02em] text-[var(--w-ink-strong)]"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              We&apos;re reading your application
            </h2>
            <p className="mt-2 max-w-[52ch] text-[14px] leading-[1.65] text-[var(--w-muted)]">
              You applied for{" "}
              <strong className="font-bold text-[var(--w-ink-strong)]">
                {application?.role === "OUTREACH" ? "Outreach" : "Build"}
              </strong>
              . A person reads every one of these, so it takes a few days. We&apos;ll email you
              either way. In the meantime, finished work on the platform is the strongest thing you
              can add.
            </p>
          </div>
        ) : kycStatus !== "approved" ? (
          /*
            Verified students only, and the database says so too: the RLS insert
            policy requires is_kyc_approved() (20261011_inner_circle_requires_kyc.sql),
            so without this the form would submit and come back 42501 with
            nothing a person could act on. The Inner Circle is the group we put
            in front of paying companies and vouch for by name — screening
            someone we cannot confirm is a student is backwards.
          */
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--w-orange-soft)] px-3 py-1 text-[12px] font-bold text-[var(--w-orange-ink)]">
              <ShieldCheck size={14} /> One step first
            </span>
            <h2
              className="mt-3.5 text-[22px] font-extrabold tracking-[-0.02em] text-[var(--w-ink-strong)]"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              Verify your student ID to apply
            </h2>
            <p className="mt-2 max-w-[52ch] text-[14px] leading-[1.65] text-[var(--w-muted)]">
              {kycStatus === "manual_review"
                ? "Your ID is being checked by hand. As soon as it clears you can apply — nothing else is needed from you."
                : kycStatus === "rejected"
                  ? "Your last ID could not be verified. Upload a clearer photo of the front of your card and you can apply straight after."
                  : "We put this group in front of real companies and vouch for them by name, so we confirm you are a student first. It takes a few seconds and is usually instant."}
            </p>
            {kycStatus !== "manual_review" && (
              <Link
                href="/verify-id"
                className="mt-5 inline-flex min-h-[46px] items-center gap-2 rounded-[11px] bg-[var(--w-orange)] px-5 text-[14.5px] font-bold text-[#371448] transition-opacity hover:opacity-90"
              >
                {kycStatus === "rejected" ? "Upload a new photo" : "Verify my ID"}
                <ArrowRight size={16} />
              </Link>
            )}
          </div>
        ) : (
          <form onSubmit={apply}>
            <h2
              className="text-[22px] font-extrabold tracking-[-0.02em] text-[var(--w-ink-strong)]"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              Ask to join
            </h2>
            {application?.status === "rejected" && application.decision_note && (
              <p className="mt-3 rounded-[11px] border border-[var(--w-line-strong)] bg-[var(--w-page)] p-3.5 text-[13.5px] leading-[1.6] text-[var(--w-muted)]">
                Last time: {application.decision_note}
              </p>
            )}
            <p className="mt-2 max-w-[54ch] text-[14px] leading-[1.65] text-[var(--w-muted)]">
              There is no form to game. Tell us what you are genuinely good at and show us
              something you have made.
            </p>

            <fieldset className="mt-6">
              <legend className="text-[13px] font-bold text-[var(--w-ink-strong)]">
                Which one are you applying for?
              </legend>
              {/* Radios in a label, not a segmented control: this is a form field
                  that gets submitted, and it has to work with a keyboard and be
                  announced as a group. The visual selection is on the label. */}
              <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
                {INNER_CIRCLE_ROLES.map((r) => {
                  const Icon = ROLE_ICON[r.value];
                  const on = role === r.value;
                  return (
                    <label
                      key={r.value}
                      className={`flex cursor-pointer gap-3 rounded-[13px] border p-4 transition-colors ${
                        on
                          ? "border-[var(--w-violet)] bg-[var(--w-violet-soft)]"
                          : "border-[var(--w-line-strong)] hover:bg-[var(--chip)]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="ic-role"
                        value={r.value}
                        checked={on}
                        onChange={() => setRole(r.value)}
                        className="sr-only"
                      />
                      <Icon
                        size={18}
                        className={`mt-0.5 shrink-0 ${
                          on ? "text-[var(--w-violet)]" : "text-[var(--w-faint)]"
                        }`}
                      />
                      <span className="min-w-0">
                        <span className="block text-[14px] font-bold text-[var(--w-ink-strong)]">
                          {r.label}
                        </span>
                        <span className="mt-0.5 block text-[12.5px] leading-[1.55] text-[var(--w-muted)]">
                          {r.tagline}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <label
              htmlFor="pitch"
              className="mt-6 block text-[13px] font-bold text-[var(--w-ink-strong)]"
            >
              {role === "OUTREACH" ? "Who could you get us in front of?" : "What are you best at?"}
            </label>
            <textarea
              id="pitch"
              rows={4}
              value={pitch}
              onChange={(e) => setPitch(e.target.value)}
              placeholder={
                role === "OUTREACH"
                  ? "Companies or people you can already reach, and how you would open the conversation."
                  : "The work you want to be hired for, and why you are good at it."
              }
              className={`${FIELD} mt-2 resize-none`}
            />

            <label
              htmlFor="links"
              className="mt-5 block text-[13px] font-bold text-[var(--w-ink-strong)]"
            >
              Show us something
            </label>
            <input
              id="links"
              value={links}
              onChange={(e) => setLinks(e.target.value)}
              onWheel={blurOnWheel}
              placeholder="Up to 5 links, separated by spaces"
              className={`${FIELD} mt-2`}
            />

            {error && (
              <p role="alert" className="mt-3 text-[13px] text-[#b3261e]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 min-h-[48px] rounded-[11px] bg-[var(--w-orange)] px-6 text-[15px] font-bold text-[#371448] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Sending" : "Send application"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
