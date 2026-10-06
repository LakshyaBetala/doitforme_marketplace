"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { blurOnWheel } from "@/lib/inputs";
import { friendlyError } from "@/lib/errors";
import {
  OUTREACH_STAGES, OPEN_STAGES, isOverdue, stageLabel, type OutreachStage,
} from "@/lib/innerCircle";
import {
  ArrowRight, Building2, CalendarClock, Loader2, Lock, Mail, Phone, Plus, Target, X,
} from "lucide-react";

/**
 * Outreach — the pipeline, and the day's work.
 *
 * Built around one question: who needs touching today. That is what
 * next_action_at is for, and why overdue leads are pulled to the top as their
 * own section rather than being a red dot somewhere in a long table. A CRM whose
 * landing view is "all 200 rows" gets used twice and then abandoned.
 *
 * Reads and writes go through the browser client against RLS rather than through
 * API routes. That is deliberate and safe here: outreach_leads is readable only
 * by is_outreach() or is_admin(), and updates are owner-only — see
 * 20261006_inner_circle_roles_and_outreach.sql. There is no server-side
 * authorization an API route could add that the policies do not already enforce,
 * and a route would be a second place for the rules to drift.
 *
 * The whole team can SEE the pipeline on purpose. A CRM that hides a teammate's
 * lead is how two people cold-email the same company in the same week, which is
 * exactly the impression a campus team cannot afford to make.
 */

type Lead = {
  id: string;
  company_name: string;
  website: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  source: string | null;
  stage: OutreachStage;
  lost_reason: string | null;
  value_estimate: number | null;
  notes: string | null;
  next_action_at: string | null;
  last_touch_at: string | null;
  owner_id: string | null;
  created_at: string;
  owner?: { name?: string | null } | null;
};

const FIELD =
  "w-full min-h-[46px] rounded-[11px] border border-[var(--w-line-strong)] bg-white px-3.5 py-2.5 " +
  "text-[14.5px] text-[var(--w-ink)] placeholder:text-[var(--w-faint)] outline-none transition-colors " +
  "focus-visible:border-[var(--w-violet)]";

const LABEL = "block text-[12.5px] font-bold text-[var(--w-ink-strong)]";

const dayLabel = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  const days = Math.round((d.getTime() - Date.now()) / 864e5);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  return `in ${days}d`;
};

export default function OutreachPage() {
  const supabase = supabaseBrowser();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<"today" | "mine" | "all">("today");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    company_name: "", contact_name: "", contact_email: "", contact_phone: "",
    website: "", source: "", value_estimate: "", notes: "", next_action_at: "",
  });

  const load = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return setLoading(false);
      setMe(user.id);

      const { data: profile } = await supabase
        .from("users")
        .select("is_elite, inner_circle_role")
        .eq("id", user.id)
        .maybeSingle();

      const ok = Boolean(profile?.is_elite) && profile?.inner_circle_role === "OUTREACH";
      setAllowed(ok);
      if (!ok) return setLoading(false);

      const { data, error: err } = await supabase
        .from("outreach_leads")
        .select("*, owner:owner_id(name)")
        .order("next_action_at", { ascending: true, nullsFirst: false })
        .limit(500);
      if (err) throw err;
      setLeads((data as Lead[]) || []);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const addLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name.trim()) return setError("A company name is the one thing we need.");
    setSaving(true);
    setError("");
    try {
      const { error: err } = await supabase.from("outreach_leads").insert({
        company_name: form.company_name.trim(),
        contact_name: form.contact_name.trim() || null,
        contact_email: form.contact_email.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        website: form.website.trim() || null,
        source: form.source.trim() || null,
        // An empty number input is "", which would become 0 — a budget of zero
        // rupees is a claim, not a blank.
        value_estimate: form.value_estimate.trim() ? Number(form.value_estimate) : null,
        notes: form.notes.trim() || null,
        next_action_at: form.next_action_at || null,
        owner_id: me,
        created_by: me,
      });
      if (err) throw err;
      setForm({
        company_name: "", contact_name: "", contact_email: "", contact_phone: "",
        website: "", source: "", value_estimate: "", notes: "", next_action_at: "",
      });
      setAdding(false);
      await load();
    } catch (err) {
      // The unique index on lower(btrim(company_name)) is doing its job here, and
      // "duplicate key violates unique constraint" is not something to show a person.
      const msg = friendlyError(err);
      setError(
        /duplicate|unique/i.test(String((err as any)?.message ?? msg))
          ? "Someone on the team already has that company in the pipeline."
          : msg
      );
    } finally {
      setSaving(false);
    }
  };

  /** Optimistic, because a stage change is the most common action on this page. */
  const setStage = async (lead: Lead, stage: OutreachStage) => {
    const prev = leads;
    setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, stage } : l)));
    const { error: err } = await supabase
      .from("outreach_leads")
      .update({ stage, last_touch_at: new Date().toISOString() })
      .eq("id", lead.id);
    if (err) {
      setLeads(prev); // RLS refused it, almost certainly not the owner
      setError(friendlyError(err));
      return;
    }
    await supabase.from("outreach_touches").insert({
      lead_id: lead.id,
      author_id: me,
      kind: "stage_change",
      body: `${stageLabel(lead.stage)} → ${stageLabel(stage)}`,
    });
  };

  const claim = async (lead: Lead) => {
    const { error: err } = await supabase
      .from("outreach_leads")
      .update({ owner_id: me })
      .eq("id", lead.id);
    if (err) return setError(friendlyError(err));
    await load();
  };

  const { overdue, visible, counts } = useMemo(() => {
    const overdue = leads.filter((l) => isOverdue(l));
    const byFilter =
      filter === "mine"
        ? leads.filter((l) => l.owner_id === me)
        : filter === "today"
        ? leads.filter((l) => OPEN_STAGES.includes(l.stage) && !isOverdue(l))
        : leads;
    const counts = Object.fromEntries(
      OUTREACH_STAGES.map((s) => [s.value, leads.filter((l) => l.stage === s.value).length])
    ) as Record<OutreachStage, number>;
    return { overdue, visible: byFilter, counts };
  }, [leads, filter, me]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-[var(--w-violet)]" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="max-w-[56ch] rounded-[16px] border border-[var(--w-line-strong)] bg-[var(--w-raised)] p-7">
        <span className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-[var(--chip)] text-[var(--w-muted)]">
          <Lock size={18} />
        </span>
        <h1
          className="mt-3.5 text-[22px] font-extrabold tracking-[-0.02em] text-[var(--w-ink-strong)]"
          style={{ fontFamily: "var(--font-display), sans-serif" }}
        >
          This is the outreach pipeline
        </h1>
        <p className="mt-2 text-[14px] leading-[1.65] text-[var(--w-muted)]">
          It holds other companies&apos; contact details, so it is limited to Inner Circle outreach
          members. You can ask to join.
        </p>
        <Link
          href="/inner-circle"
          className="mt-5 inline-flex min-h-[46px] items-center gap-2 rounded-[11px] bg-[var(--w-orange)] px-5 text-[14.5px] font-bold text-[#371448] hover:opacity-90"
        >
          About the Inner Circle <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-2">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-bold text-[var(--w-faint)]">THE INNER CIRCLE</p>
          <h1
            className="mt-1.5 text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em] text-[var(--w-ink-strong)] sm:text-[34px]"
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            Outreach
          </h1>
          <p className="mt-2 max-w-[56ch] text-[14.5px] leading-[1.6] text-[var(--w-muted)]">
            Companies we are talking to. Set a next action on everything open and this page becomes
            your to-do list.
          </p>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="inline-flex min-h-[46px] items-center gap-2 rounded-[11px] bg-[var(--w-orange)] px-5 text-[14.5px] font-bold text-[#371448] transition-opacity hover:opacity-90"
        >
          {adding ? <X size={16} /> : <Plus size={17} strokeWidth={2.6} />}
          {adding ? "Cancel" : "Add a company"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-[11px] bg-[var(--bad-soft)] p-3 text-[13.5px] text-[var(--bad)]">
          {error}
        </p>
      )}

      {/* ---- add form ---------------------------------------------------- */}
      {adding && (
        <form
          onSubmit={addLead}
          className="mt-6 rounded-[16px] border border-[var(--w-line-strong)] bg-[var(--w-raised)] p-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="company_name" className={LABEL}>
                Company <span className="font-semibold text-[var(--w-muted)]">(required)</span>
              </label>
              <input
                id="company_name"
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                placeholder="Who are we talking to?"
                className={`${FIELD} mt-1.5`}
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="contact_name" className={LABEL}>Contact</label>
              <input
                id="contact_name"
                value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                placeholder="Name of the person"
                className={`${FIELD} mt-1.5`}
              />
            </div>
            <div>
              <label htmlFor="contact_email" className={LABEL}>Email</label>
              <input
                id="contact_email"
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                className={`${FIELD} mt-1.5`}
              />
            </div>
            <div>
              <label htmlFor="contact_phone" className={LABEL}>Phone</label>
              <input
                id="contact_phone"
                value={form.contact_phone}
                onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                className={`${FIELD} mt-1.5`}
              />
            </div>
            <div>
              <label htmlFor="website" className={LABEL}>Website</label>
              <input
                id="website"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                className={`${FIELD} mt-1.5`}
              />
            </div>
            <div>
              <label htmlFor="source" className={LABEL}>How did you find them?</label>
              <input
                id="source"
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                placeholder="linkedin, campus, referral…"
                className={`${FIELD} mt-1.5`}
              />
            </div>
            <div>
              <label htmlFor="value_estimate" className={LABEL}>
                Rough budget <span className="font-semibold text-[var(--w-muted)]">(₹, optional)</span>
              </label>
              <input
                id="value_estimate"
                type="number"
                min={0}
                value={form.value_estimate}
                onChange={(e) => setForm({ ...form, value_estimate: e.target.value })}
                /* A focused number input treats the wheel as increment, so a
                   value silently counts down while you scroll past it. */
                onWheel={blurOnWheel}
                className={`${FIELD} mt-1.5`}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="next_action_at" className={LABEL}>
                Next action{" "}
                <span className="font-semibold text-[var(--w-muted)]">
                  (the one field worth filling in)
                </span>
              </label>
              <input
                id="next_action_at"
                type="date"
                value={form.next_action_at}
                onChange={(e) => setForm({ ...form, next_action_at: e.target.value })}
                className={`${FIELD} mt-1.5`}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="notes" className={LABEL}>Notes</label>
              <textarea
                id="notes"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Anything the next person would want to know."
                className={`${FIELD} mt-1.5 resize-none`}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="mt-5 min-h-[46px] rounded-[11px] bg-[var(--w-orange)] px-6 text-[14.5px] font-bold text-[#371448] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Adding" : "Add to pipeline"}
          </button>
        </form>
      )}

      {/* ---- pipeline counts --------------------------------------------- */}
      <dl className="mt-7 grid grid-cols-3 gap-2.5 sm:grid-cols-6">
        {OUTREACH_STAGES.map((s) => (
          <div
            key={s.value}
            className="rounded-[13px] border border-[var(--w-line-strong)] bg-[var(--w-raised)] p-3.5"
            title={s.hint}
          >
            <dt className="truncate text-[11.5px] font-bold text-[var(--w-muted)]">{s.label}</dt>
            <dd
              className="mt-0.5 text-[22px] font-extrabold tracking-[-0.02em] text-[var(--w-ink-strong)]"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              {counts[s.value] ?? 0}
            </dd>
          </div>
        ))}
      </dl>

      {/* ---- overdue, as its own section -------------------------------- */}
      {overdue.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[15px] font-extrabold tracking-[-0.01em] text-[var(--bad)]">
            Overdue · {overdue.length}
          </h2>
          <p className="mt-1 text-[13px] text-[var(--w-muted)]">
            The next action date has passed on these. Do them first.
          </p>
          <ul className="mt-3 grid gap-2.5">
            {overdue.map((lead) => (
              <LeadRow key={lead.id} lead={lead} me={me} onStage={setStage} onClaim={claim} overdue />
            ))}
          </ul>
        </section>
      )}

      {/* ---- the list ---------------------------------------------------- */}
      <section className="mt-8">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["today", "In play"],
              ["mine", "Mine"],
              ["all", "Everything"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={`min-h-[40px] rounded-[10px] px-3.5 text-[13.5px] font-bold transition-colors ${
                filter === value
                  ? "bg-[var(--w-rail)] text-white"
                  : "border border-[var(--w-line-strong)] text-[var(--w-muted)] hover:bg-[var(--chip)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="mt-4 rounded-[16px] border border-[var(--w-line-strong)] bg-[var(--w-raised)] px-6 py-12 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-[13px] bg-[var(--w-violet-soft)] text-[var(--w-violet)]">
              <Target size={21} />
            </span>
            <h3
              className="mt-4 text-[19px] font-extrabold tracking-[-0.02em] text-[var(--w-ink-strong)]"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              {leads.length === 0 ? "Nothing in the pipeline yet" : "Nothing here"}
            </h3>
            <p className="mx-auto mt-2 max-w-[44ch] text-[14px] leading-[1.6] text-[var(--w-muted)]">
              {leads.length === 0
                ? "Add the first company. One real conversation beats fifty names on a list."
                : "Try another filter."}
            </p>
          </div>
        ) : (
          <ul className="mt-4 grid gap-2.5">
            {visible.map((lead) => (
              <LeadRow key={lead.id} lead={lead} me={me} onStage={setStage} onClaim={claim} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function LeadRow({
  lead,
  me,
  onStage,
  onClaim,
  overdue = false,
}: {
  lead: Lead;
  me: string | null;
  onStage: (lead: Lead, stage: OutreachStage) => void;
  onClaim: (lead: Lead) => void;
  overdue?: boolean;
}) {
  const mine = lead.owner_id === me;
  const unowned = !lead.owner_id;
  const when = dayLabel(lead.next_action_at);

  return (
    <li
      className={`rounded-[13px] border bg-[var(--w-raised)] p-4 ${
        overdue ? "border-[var(--bad-line)]" : "border-[var(--w-line-strong)]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Building2 size={15} className="shrink-0 text-[var(--w-faint)]" />
            <span className="truncate text-[15px] font-extrabold text-[var(--w-ink-strong)]">
              {lead.company_name}
            </span>
            {lead.value_estimate != null && (
              <span className="shrink-0 rounded-full bg-[var(--chip)] px-2 py-0.5 text-[11px] font-bold text-[var(--w-muted)]">
                ~₹{lead.value_estimate.toLocaleString("en-IN")}
              </span>
            )}
            {when && (
              <span
                className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  overdue
                    ? "bg-[var(--bad-soft)] text-[var(--bad)]"
                    : "bg-[var(--w-orange-soft)] text-[var(--w-orange-ink)]"
                }`}
              >
                <CalendarClock size={11} /> {when}
              </span>
            )}
          </div>

          {(lead.contact_name || lead.contact_email || lead.contact_phone) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12.5px] text-[var(--w-muted)]">
              {lead.contact_name && <span className="font-semibold">{lead.contact_name}</span>}
              {lead.contact_email && (
                <a
                  href={`mailto:${lead.contact_email}`}
                  className="inline-flex items-center gap-1 hover:text-[var(--w-violet)]"
                >
                  <Mail size={12} /> {lead.contact_email}
                </a>
              )}
              {lead.contact_phone && (
                <a
                  href={`tel:${lead.contact_phone}`}
                  className="inline-flex items-center gap-1 hover:text-[var(--w-violet)]"
                >
                  <Phone size={12} /> {lead.contact_phone}
                </a>
              )}
            </div>
          )}

          {lead.notes && (
            <p className="mt-1.5 line-clamp-2 max-w-[70ch] text-[12.5px] leading-[1.55] text-[var(--w-muted)]">
              {lead.notes}
            </p>
          )}

          <p className="mt-1.5 text-[11.5px] text-[var(--w-faint)]">
            {unowned ? "Unclaimed" : mine ? "Yours" : `${lead.owner?.name || "A teammate"}`}
            {lead.source ? ` · ${lead.source}` : ""}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {unowned && (
            <button
              onClick={() => onClaim(lead)}
              className="min-h-[38px] rounded-[9px] border border-[var(--w-line-strong)] px-3 text-[12.5px] font-bold text-[var(--w-ink)] hover:bg-[var(--chip)]"
            >
              Claim
            </button>
          )}
          {/* Only the owner can move a stage, which is what RLS enforces anyway —
              disabling it here just avoids an error the person cannot act on. */}
          <label className="sr-only" htmlFor={`stage-${lead.id}`}>
            Stage for {lead.company_name}
          </label>
          <select
            id={`stage-${lead.id}`}
            value={lead.stage}
            disabled={!mine && !unowned}
            onChange={(e) => onStage(lead, e.target.value as OutreachStage)}
            className="min-h-[38px] rounded-[9px] border border-[var(--w-line-strong)] bg-[var(--w-raised)] px-2.5 text-[12.5px] font-bold text-[var(--w-ink)] disabled:opacity-50"
          >
            {OUTREACH_STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </li>
  );
}
