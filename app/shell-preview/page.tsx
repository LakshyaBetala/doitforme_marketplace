import AppShell from "@/components/shell/AppShell";
import "../workspace-theme.css";
import { notFound } from "next/navigation";

/**
 * TEMPORARY. Delete once Supabase is restored.
 *
 * The workspace shell can only be reached behind an auth gate, and Supabase
 * Auth is answering 402, so there is no way to sign in and look at it. This
 * renders the same shell with sample props so the layout can actually be
 * reviewed rather than assumed correct.
 *
 * Refuses to exist in production — a route that fakes a signed-in frame is not
 * something to leave reachable.
 */
export default function ShellPreview() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <AppShell name="Alex Kumar" role="STUDENT">
      <p className="text-[13px] font-bold text-[var(--w-faint)]">YOUR WORKSPACE · TODAY</p>
      <h1
        className="mt-2 text-[34px] font-extrabold tracking-[-0.03em] text-[var(--w-ink-strong)]"
        style={{ fontFamily: "var(--font-display), sans-serif" }}
      >
        Hey, Alex
      </h1>
      <p className="mt-2 text-[15px] text-[var(--w-muted)]">
        Good to see you. Let&apos;s make something happen today.
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
    </AppShell>
  );
}
