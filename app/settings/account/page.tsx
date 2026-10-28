"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Download, Loader2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

/**
 * Account settings, which for now means the one thing the App Store requires:
 * deleting your account from inside the app (guideline 5.1.1(v)). The previous
 * answer was "email support", which is the thing that guideline exists to
 * reject.
 *
 * Deliberately not a one-tap button. It destroys the auth identity and the
 * uploaded ID, so it asks for the word DELETE to be typed — the same bar the
 * operator script sets with its --apply flag.
 */
export default function AccountSettingsPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const armed = confirm.trim().toUpperCase() === "DELETE";

  const deleteAccount = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error || "Could not delete the account. Please try again.");
        setBusy(false);
        return;
      }
      // The auth identity is gone server-side; clear the local session too or
      // the browser keeps a cookie for a user that no longer exists.
      setDone(true);
      await supabase.auth.signOut().catch(() => {});
      router.replace("/");
    } catch {
      setError("Could not reach the server. Please try again.");
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-10">
        <h1 className="text-[22px] font-extrabold tracking-tight text-[var(--fg)]">Account deleted</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--fg-muted)]">
          Your personal details and uploaded documents have been erased. Taking you home.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[680px] px-4 py-6 md:py-8">
      <h1 className="font-[family-name:var(--font-display)] text-[24px] font-extrabold tracking-tight text-[var(--fg)]">
        Account
      </h1>
      <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--fg-muted)]">
        Your sign-in, your data, and how to leave.
      </p>

      <Card className="mt-6" padded>
        <h2 className="text-[15px] font-bold tracking-tight text-[var(--fg)]">Your data</h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--fg-muted)]">
          Your profile, skills and links are on your{" "}
          <Link href="/profile" className="font-semibold text-[var(--accent-ink)] underline underline-offset-2">
            profile page
          </Link>
          . Earnings and payout history are under{" "}
          <Link href="/payouts" className="font-semibold text-[var(--accent-ink)] underline underline-offset-2">
            Payouts
          </Link>
          .
        </p>
        <p className="mt-3 flex items-start gap-2 text-[13px] leading-relaxed text-[var(--fg-faint)]">
          <Download size={15} className="mt-0.5 shrink-0" />
          <span>
            Want a copy of everything we hold on you before you go? Email{" "}
            <a href="mailto:doitforme.in@gmail.com" className="font-semibold text-[var(--accent-ink)]">
              doitforme.in@gmail.com
            </a>{" "}
            and we will send it.
          </span>
        </p>
      </Card>

      {/* `!` is load-bearing: Card already sets border-[var(--line)], and with
          two arbitrary-value utilities for the same property the winner is
          decided by position in the generated stylesheet, not by position in
          this string — so a plain border-[var(--bad-line)] here is a coin flip. */}
      <Card className="mt-4 !border-[var(--bad-line)]" padded>
        <h2 className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-[var(--bad)]">
          <AlertTriangle size={16} />
          Delete my account
        </h2>

        <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--fg-muted)]">
          This cannot be undone. We erase your name, email, phone, college, UPI id, your student ID
          and your CV, and we delete your sign-in, so you will not be able to log back in.
        </p>

        <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--fg-muted)]">
          Two things stay, and it is worth knowing why. Gigs, messages and ratings that involve{" "}
          <span className="font-semibold text-[var(--fg)]">other people</span> keep their records —
          your erasure is not consent to delete someone else&apos;s history — and they will show you
          as &ldquo;Deleted user&rdquo;. Payment and escrow records are kept because Indian tax and
          payment-gateway rules require it.
        </p>

        <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--fg-muted)]">
          If you have money in flight — a payout owed to you, or a gig you have paid for that nobody
          has delivered — this will stop and tell you. Settling it first is what keeps the other side
          from being stranded with no counterparty.
        </p>

        <label htmlFor="confirm" className="mt-5 block text-[12.5px] font-bold text-[var(--fg)]">
          Type DELETE to confirm
        </label>
        <input
          id="confirm"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="DELETE"
          aria-describedby={error ? "delete-error" : undefined}
          className="mt-1.5 h-11 w-full max-w-[260px] rounded-[10px] border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-[14px] font-semibold tracking-widest text-[var(--fg)] outline-none focus:border-[var(--bad)]"
        />

        {error && (
          <p
            id="delete-error"
            role="alert"
            className="mt-3 rounded-[10px] border border-[var(--bad-line)] bg-[var(--bad-soft)] px-3 py-2 text-[13px] font-medium leading-relaxed text-[var(--bad)]"
          >
            {error}
          </p>
        )}

        <div className="mt-4">
          <Button variant="destructive" onClick={deleteAccount} disabled={!armed || busy}>
            {busy ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Deleting
              </>
            ) : (
              "Delete my account"
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
