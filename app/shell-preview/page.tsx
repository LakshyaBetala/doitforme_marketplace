import AppShell from "@/components/shell/AppShell";
import "../workspace-theme.css";
import { notFound } from "next/navigation";
import { workflowFor } from "@/lib/innerCircle";

/**
 * TEMPORARY. Delete once Supabase is restored.
 *
 * Every signed-in surface is behind an auth gate and Supabase Auth is answering
 * 402, so there is no way to sign in and look at any of this. This renders the
 * shell with sample props so the layout can be reviewed rather than assumed
 * correct, and prints the derived workflow so the step logic can be eyeballed
 * next to its unit tests.
 *
 * Refuses to exist in production — a route that fakes a signed-in frame is not
 * something to leave reachable.
 */
export default function ShellPreview() {
  if (process.env.NODE_ENV === "production") notFound();

  // A mid-flight brief: funded, delivered, waiting on the client.
  const steps = workflowFor({
    assigned_worker_id: "w",
    payment_status: "HELD",
    status: "delivered",
  });

  return (
    <AppShell name="Alex Kumar" role="STUDENT" isElite innerCircleRole="OUTREACH">
      <p className="text-[13px] font-bold text-[var(--w-faint)]">SHELL PREVIEW (DEV ONLY)</p>
      <h1
        className="mt-2 text-[34px] font-extrabold tracking-[-0.03em] text-[var(--w-ink-strong)]"
        style={{ fontFamily: "var(--font-display), sans-serif" }}
      >
        Hey, Alex
      </h1>
      <p className="mt-2 text-[15px] text-[var(--w-muted)]">
        Rendered with isElite + OUTREACH, so the sidebar should show exactly one
        Inner&nbsp;Circle entry plus an Outreach entry, and no Wallet anywhere.
      </p>

      <section className="mt-7 overflow-hidden rounded-[16px] bg-[linear-gradient(115deg,#351144_0%,#5b1479_63%,#8324af_100%)] p-7 sm:p-9">
        <p className="text-[13px] font-bold text-[#ffd28c]">Made for your next move</p>
        <h2
          className="mt-2 max-w-[18ch] text-[28px] font-extrabold leading-[1.08] tracking-[-0.03em] text-white sm:text-[34px]"
          style={{ fontFamily: "var(--font-display), sans-serif" }}
        >
          Find work that fits you.
        </h2>
        <button className="mt-6 min-h-[48px] rounded-[11px] bg-[var(--w-orange)] px-6 text-[15px] font-bold text-[#371448]">
          Explore projects
        </button>
      </section>

      <div className="mt-8 grid gap-5 sm:grid-cols-3">
        {[
          ["Open applications", "3"],
          ["Work in progress", "1"],
          ["Earned this month", "₹2,400"],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-[16px] border border-[var(--w-line-strong)] bg-[var(--w-raised)] p-5"
          >
            <p className="text-[13px] text-[var(--w-muted)]">{label}</p>
            <p
              className="mt-1.5 text-[26px] font-extrabold tracking-[-0.02em] text-[var(--w-ink-strong)]"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* The derived tech workflow, so the step states are visible beside the
          unit tests that pin them. */}
      <section className="mt-8 rounded-[16px] border border-[var(--w-line-strong)] bg-[var(--w-raised)] p-6">
        <h2 className="text-[15px] font-extrabold text-[var(--w-ink-strong)]">
          Derived workflow — funded, delivered, awaiting review
        </h2>
        <ol className="mt-3 grid gap-1.5">
          {steps.map((s) => (
            <li key={s.key} className="text-[13.5px] text-[var(--w-muted)]">
              <code className="font-bold text-[var(--w-ink-strong)]">{s.state.padEnd(8)}</code>{" "}
              {s.title} <span className="text-[var(--w-faint)]">· {s.owner}</span>
            </li>
          ))}
        </ol>
      </section>
    </AppShell>
  );
}
