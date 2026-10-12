"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

/**
 * Log out, as a client component.
 *
 * There is no `/api/auth/signout` route in this project — AccountMenu signs out
 * through the browser client — and a <Link> to one would have been a 404 on the
 * only screen in the app where someone goes looking for the exit.
 *
 * `router.replace` rather than push, so the back gesture cannot return to a
 * signed-in screen rendered with a session that no longer exists. It goes to
 * `/login` rather than `/app`, because the app layout would bounce an
 * unauthenticated visitor straight back there anyway and the extra hop shows a
 * flash of the gate.
 */
export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          // supabaseBrowser is a factory, not an instance.
          await supabaseBrowser().auth.signOut();
        } finally {
          router.replace("/login");
        }
      }}
      className="icapp-press flex min-h-[52px] w-full items-center justify-center rounded-[var(--a-r-ctl)] border border-[var(--a-line-strong)] bg-[var(--a-surface)] text-[15px] font-semibold text-[var(--a-fg-muted)] disabled:opacity-60"
    >
      {busy ? "Logging out…" : "Log out"}
    </button>
  );
}
