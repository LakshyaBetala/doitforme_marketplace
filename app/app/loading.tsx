/**
 * Skeleton shown while any /app tab fetches.
 *
 * WHY THIS IS THE DIFFERENCE BETWEEN AN APP AND A WEBSITE. Every screen here is
 * a server component that awaits Supabase, so without a loading boundary a tab
 * switch shows NOTHING until the round-trip finishes — on mobile data that is
 * the blank-white pause that says "web page" louder than any styling. Next uses
 * the nearest loading.tsx as the Suspense fallback, so this one file covers
 * every tab (Today, Briefs, Earnings, Leads, Projects, Team, Me) during
 * navigation. The layout — header and tab bar — stays put; only this inner
 * region swaps, which is exactly how a native screen transition reads.
 *
 * Shapes match the real content (two stat tiles, a list of cards) so the jump
 * when data lands is a fill, not a reflow.
 */
function Bar({ w, h = 14 }: { w: string; h?: number }) {
  return (
    <div
      className="animate-pulse rounded-md bg-[var(--a-surface-2)]"
      style={{ width: w, height: h }}
    />
  );
}

export default function Loading() {
  return (
    <div className="mt-5" aria-busy="true" aria-label="Loading">
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-[var(--a-r-card)] border border-[var(--a-line)] bg-[var(--a-surface)] p-4">
            <Bar w="55%" h={10} />
            <div className="mt-3"><Bar w="70%" h={26} /></div>
            <div className="mt-3"><Bar w="45%" h={10} /></div>
          </div>
        ))}
      </div>

      <div className="mt-7"><Bar w="35%" h={12} /></div>
      <div className="mt-3 space-y-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-[var(--a-r-card)] border border-[var(--a-line)] bg-[var(--a-surface)] p-4">
            <div className="flex items-start justify-between gap-3">
              <Bar w="60%" />
              <Bar w="56px" h={22} />
            </div>
            <div className="mt-3"><Bar w="40%" h={12} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
