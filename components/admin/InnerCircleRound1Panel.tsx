"use client";

// Admin panel for the Inner Circle · Round 1 queue.
//
// Lives in a separate component rather than inline in app/admin/page.tsx so
// the admin file stays scannable — that file is already 1000+ lines handling
// seven other tabs. All data comes from /api/admin/inner-circle-round1/*;
// authorization is enforced server-side (isAdminEmail), so the component is
// only responsible for rendering and operator actions.

import { useCallback, useEffect, useMemo, useState } from "react";

type Status =
  | "invited"
  | "started"
  | "submitted"
  | "expired"
  | "advanced"
  | "rejected"
  | "switched_to_tech";

interface Candidate {
  id: number;
  cohort: string;
  email: string;
  name: string | null;
  phone: string | null;
  college: string | null;
  invited_at: number;
  started_at: number | null;
  deadline_at: number | null;
  campaign_closes_at: number;
  status: Status;
  submission_url: string | null;
  submitted_at: number | null;
  score: number | null;
  admin_note: string | null;
  decided_at: number | null;
  decided_by: string | null;
}

interface ListResponse {
  cohort: string;
  candidates: Candidate[];
  breakdown: { status: string; n: number }[];
  total: number;
}

interface FunnelResponse {
  cohort: string;
  byStatus: Record<string, number>;
  byEventUnique: Record<string, number>;
  byEventRaw: Record<string, number>;
  funnel: { step: string; count: number; hint: string }[];
}

const STATUS_FILTERS: { value: Status; label: string }[] = [
  { value: "invited", label: "Invited" },
  { value: "started", label: "Started" },
  { value: "submitted", label: "Submitted" },
  { value: "expired", label: "Expired" },
  { value: "advanced", label: "Advanced" },
  { value: "rejected", label: "Rejected" },
  { value: "switched_to_tech", label: "Switched → Tech" },
];

export default function InnerCircleRound1Panel() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [funnel, setFunnel] = useState<FunnelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string>("");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<Status>>(new Set());
  const [needsDecision, setNeedsDecision] = useState(false);

  const [decisionNote, setDecisionNote] = useState<Record<number, string>>({});
  const [decisionScore, setDecisionScore] = useState<Record<number, string>>({});
  const [decisionBusy, setDecisionBusy] = useState<number | null>(null);
  const [decisionError, setDecisionError] = useState<string>("");

  const refresh = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedStatuses.size) params.set("status", Array.from(selectedStatuses).join(","));
      if (needsDecision) params.set("needsDecision", "1");
      const [listR, funnelR] = await Promise.all([
        fetch(`/api/admin/inner-circle-round1/list?${params.toString()}`),
        fetch(`/api/admin/inner-circle-round1/funnel`),
      ]);
      if (listR.ok) setData((await listR.json()) as ListResponse);
      if (funnelR.ok) setFunnel((await funnelR.json()) as FunnelResponse);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, [selectedStatuses, needsDecision]);

  useEffect(() => { refresh(); }, [refresh]);

  const sendBatch = async (limit: number, dryRun: boolean, createOnly = false) => {
    setSending(true);
    setSendResult("");
    try {
      const r = await fetch("/api/admin/inner-circle-round1/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit, dryRun, createOnly }),
      });
      const d = await r.json();
      if (!r.ok) {
        setSendResult(`Error: ${d.error || "failed"}`);
      } else if (d.dryRun) {
        setSendResult(`Dry run: would invite ${d.wouldInvite}${d.sample?.length ? ` (sample: ${d.sample.slice(0, 3).join(", ")})` : ""}`);
      } else if (d.createOnly) {
        setSendResult(
          `Created ${d.invited} candidate rows (no email sent). Click "Download CSV" to mail-merge.`
        );
      } else {
        setSendResult(
          `Attempted ${d.attempted}, created ${d.invited}, email failed ${d.emailFailed}` +
          (d.errors?.length ? ` — first error: ${d.errors[0]}` : "")
        );
      }
      await refresh();
    } catch (e) {
      setSendResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSending(false);
    }
  };

  const downloadCsv = (statuses: string[]) => {
    const qs = new URLSearchParams({ status: statuses.join(",") });
    // Simple navigation triggers the attachment download via the route's
    // Content-Disposition header. No fetch needed, no blob plumbing.
    window.location.href = `/api/admin/inner-circle-round1/export-invites?${qs.toString()}`;
  };

  const decide = async (id: number, action: "advance" | "reject") => {
    const note = (decisionNote[id] || "").trim();
    if (!note) {
      setDecisionError("A note is required — this is what the candidate reads.");
      return;
    }
    setDecisionBusy(id);
    setDecisionError("");
    try {
      const r = await fetch("/api/admin/inner-circle-round1/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: id,
          action,
          note,
          score: decisionScore[id] ? Number(decisionScore[id]) : undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setDecisionError(d.error || "Failed to record decision.");
        return;
      }
      setDecisionNote((m) => ({ ...m, [id]: "" }));
      setDecisionScore((m) => ({ ...m, [id]: "" }));
      await refresh();
    } catch (e) {
      setDecisionError(e instanceof Error ? e.message : String(e));
    } finally {
      setDecisionBusy(null);
    }
  };

  const breakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of data?.breakdown || []) map.set(b.status, b.n);
    return map;
  }, [data?.breakdown]);

  const toggleStatus = (s: Status) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Status breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {STATUS_FILTERS.map((f) => (
          <div key={f.value} className="rounded-lg border border-white/10 bg-black/30 p-3">
            <div className="text-[10px] uppercase tracking-wider text-white/40">{f.label}</div>
            <div className="mt-1 text-2xl font-semibold text-white tabular-nums">{breakdown.get(f.value) ?? 0}</div>
          </div>
        ))}
      </div>

      {/* Funnel */}
      {funnel && funnel.funnel.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-black/30 p-4">
          <div className="flex items-baseline justify-between mb-3">
            <div className="text-[11px] uppercase tracking-wider text-white/50">Conversion funnel</div>
            <div className="text-[10px] text-white/35">unique candidates per stage</div>
          </div>
          <div className="space-y-1.5">
            {(() => {
              const top = Math.max(1, ...funnel.funnel.map((s) => s.count));
              return funnel.funnel.map((s, i) => {
                const prev = i === 0 ? s.count : funnel.funnel[i - 1].count || 1;
                const dropPct = i === 0 ? 100 : (s.count / Math.max(1, prev)) * 100;
                const widthPct = (s.count / top) * 100;
                return (
                  <div key={s.step} className="flex items-center gap-3">
                    <div className="w-40 shrink-0 text-xs text-white/70">{s.step}</div>
                    <div className="flex-1 relative h-6 rounded bg-white/[0.03] overflow-hidden">
                      <div
                        className="h-full bg-[#8825F5]/40"
                        style={{ width: `${widthPct}%` }}
                      />
                      <div className="absolute inset-0 flex items-center justify-between px-2 text-[11px]">
                        <span className="text-white tabular-nums">{s.count}</span>
                        {i > 0 && (
                          <span className="text-white/50 tabular-nums">{Math.round(dropPct)}% of prev</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
          {funnel.byEventRaw && Object.keys(funnel.byEventRaw).length > 0 && (
            <details className="mt-3">
              <summary className="text-[11px] text-white/50 cursor-pointer hover:text-white/70">
                Raw event counts (all events, including repeats)
              </summary>
              <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-[11px] font-mono text-white/60">
                {Object.entries(funnel.byEventRaw)
                  .sort((a, b) => b[1] - a[1])
                  .map(([ev, n]) => (
                    <div key={ev} className="flex justify-between">
                      <span>{ev}</span>
                      <span className="text-white tabular-nums">{n}</span>
                    </div>
                  ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Operator actions */}
      <div className="rounded-lg border border-white/10 bg-black/30 p-4">
        <div className="space-y-3">
          <div className="text-sm text-white/70">
            Cohort: <span className="text-white font-mono">{data?.cohort ?? "—"}</span>
          </div>

          {/* Row 1: automated send via provider */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-white/40 mr-1">Automated send</span>
            <button
              onClick={() => sendBatch(90, true)}
              disabled={sending}
              className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs text-white/85 hover:bg-white/[0.08] disabled:opacity-50"
            >
              Dry run (preview 90)
            </button>
            <button
              onClick={() => sendBatch(90, false)}
              disabled={sending}
              className="rounded-md bg-[#8825F5] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#9633ff] disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send next batch (90)"}
            </button>
            <button
              onClick={() => sendBatch(240, false)}
              disabled={sending}
              className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs text-white/85 hover:bg-white/[0.08] disabled:opacity-50"
            >
              Send 240
            </button>
            <button
              onClick={refresh}
              className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs text-white/85 hover:bg-white/[0.08]"
            >
              Refresh
            </button>
          </div>

          {/* Row 2: manual mail-merge flow */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/[0.06]">
            <span className="text-[10px] uppercase tracking-wider text-white/40 mr-1">Manual (mail-merge)</span>
            <button
              onClick={() => sendBatch(1500, false, true)}
              disabled={sending}
              className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs text-white/85 hover:bg-white/[0.08] disabled:opacity-50"
              title="Generate D1 rows + tokens for every uninvited candidate, without sending any email"
            >
              Generate all pending rows (no email)
            </button>
            <button
              onClick={() => downloadCsv(["invited"])}
              className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs text-white/85 hover:bg-white/[0.08]"
              title="Download CSV of candidates with invite URLs — ready for Gmail mail-merge"
            >
              Download CSV · uninvited
            </button>
            <button
              onClick={() => downloadCsv(["invited", "started", "submitted", "expired", "advanced", "rejected", "switched_to_tech"])}
              className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs text-white/85 hover:bg-white/[0.08]"
              title="Download CSV of every candidate across all statuses"
            >
              Download CSV · all
            </button>
          </div>
        </div>
        {sendResult && <p className="mt-3 text-xs text-white/60">{sendResult}</p>}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-white/40 mr-1">Filter:</span>
        {STATUS_FILTERS.map((f) => {
          const on = selectedStatuses.has(f.value);
          return (
            <button
              key={f.value}
              onClick={() => toggleStatus(f.value)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                on
                  ? "border-[#8825F5] bg-[#8825F5]/15 text-white"
                  : "border-white/10 bg-white/[0.02] text-white/60 hover:bg-white/[0.05]"
              }`}
            >
              {f.label} ({breakdown.get(f.value) ?? 0})
            </button>
          );
        })}
        <label className="ml-2 flex items-center gap-1.5 text-xs text-white/70">
          <input type="checkbox" checked={needsDecision} onChange={(e) => setNeedsDecision(e.target.checked)} />
          Needs decision
        </label>
      </div>

      {/* Table */}
      {loading ? (
        <div className="rounded-lg border border-white/10 bg-black/30 p-8 text-center text-sm text-white/50">
          Loading…
        </div>
      ) : !data || data.candidates.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-black/30 p-8 text-center text-sm text-white/50">
          No candidates match the current filter.
        </div>
      ) : (
        <div className="rounded-lg border border-white/10 bg-black/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-white/[0.02] text-white/50">
                <tr>
                  <th className="px-3 py-2 font-medium">Candidate</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Started → Deadline</th>
                  <th className="px-3 py-2 font-medium">Submission</th>
                  <th className="px-3 py-2 font-medium">Decision</th>
                </tr>
              </thead>
              <tbody>
                {data.candidates.map((c) => (
                  <tr key={c.id} className="border-t border-white/5 align-top">
                    <td className="px-3 py-3 text-white/85">
                      <div className="font-medium text-white">{c.name || "—"}</div>
                      <div className="text-[11px] text-white/50">{c.email}</div>
                      <div className="text-[11px] text-white/40">{c.college || ""} {c.phone ? `· ${c.phone}` : ""}</div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] ${statusToClass(c.status)}`}>
                        {humanStatus(c.status)}
                      </span>
                      {c.decided_at && (
                        <div className="mt-1 text-[10px] text-white/40">
                          by {c.decided_by || "—"} on {fmtDate(c.decided_at)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-[11px] text-white/60 tabular-nums">
                      {c.started_at ? fmtDate(c.started_at) : "—"}
                      <div className="text-white/40">{c.deadline_at ? `↳ ${fmtDate(c.deadline_at)}` : ""}</div>
                    </td>
                    <td className="px-3 py-3 text-[11px]">
                      {c.submission_url ? (
                        <a href={c.submission_url} target="_blank" rel="noreferrer" className="text-[#C9A9FF] underline break-all">
                          Open sheet ↗
                        </a>
                      ) : (
                        <span className="text-white/40">—</span>
                      )}
                      {c.submitted_at && <div className="text-white/40">{fmtDate(c.submitted_at)}</div>}
                    </td>
                    <td className="px-3 py-3">
                      {c.status === "submitted" ? (
                        <div className="space-y-1.5 min-w-[260px]">
                          <textarea
                            value={decisionNote[c.id] || ""}
                            onChange={(e) => setDecisionNote((m) => ({ ...m, [c.id]: e.target.value }))}
                            placeholder="Decision note — this is what the candidate reads."
                            className="w-full h-16 rounded border border-white/10 bg-black/40 p-1.5 text-[11px] text-white placeholder:text-white/30"
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={decisionScore[c.id] || ""}
                              onChange={(e) => setDecisionScore((m) => ({ ...m, [c.id]: e.target.value }))}
                              placeholder="Score"
                              className="w-16 rounded border border-white/10 bg-black/40 p-1 text-[11px] text-white placeholder:text-white/30"
                            />
                            <button
                              onClick={() => decide(c.id, "advance")}
                              disabled={decisionBusy === c.id}
                              className="rounded-md bg-emerald-500/80 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                            >
                              Advance
                            </button>
                            <button
                              onClick={() => decide(c.id, "reject")}
                              disabled={decisionBusy === c.id}
                              className="rounded-md bg-rose-500/80 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ) : c.admin_note ? (
                        <div className="text-[11px] text-white/70 max-w-[260px]">
                          <div className="text-white/40">Note:</div>
                          <div>{c.admin_note}</div>
                          {c.score != null && <div className="mt-0.5 text-white/40">Score: {c.score}</div>}
                        </div>
                      ) : (
                        <span className="text-white/40 text-[11px]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {decisionError && <div className="border-t border-rose-500/40 bg-rose-500/5 px-3 py-2 text-xs text-rose-300">{decisionError}</div>}
        </div>
      )}
    </div>
  );
}

function fmtDate(sec: number): string {
  return new Date(sec * 1000).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function humanStatus(s: Status): string {
  switch (s) {
    case "invited": return "Invited";
    case "started": return "Started";
    case "submitted": return "Submitted";
    case "expired": return "Expired";
    case "advanced": return "Advanced";
    case "rejected": return "Rejected";
    case "switched_to_tech": return "→ Tech";
  }
}

function statusToClass(s: Status): string {
  switch (s) {
    case "invited": return "bg-white/5 text-white/70";
    case "started": return "bg-amber-500/15 text-amber-200";
    case "submitted": return "bg-sky-500/15 text-sky-200";
    case "expired": return "bg-white/5 text-white/50";
    case "advanced": return "bg-emerald-500/15 text-emerald-200";
    case "rejected": return "bg-rose-500/15 text-rose-200";
    case "switched_to_tech": return "bg-indigo-500/15 text-indigo-200";
  }
}
