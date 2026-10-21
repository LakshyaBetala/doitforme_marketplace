import Link from "next/link";
import Image from "next/image";

/**
 * The top bar for every public page that is not the landing page (which has its
 * own, with scroll-to-section behaviour). Before this, /talent, /pricing,
 * /about, /contact and the legal pages each ended at a lone "Back" link, so
 * someone arriving from a search result had no way to reach the rest of the
 * site except the browser's back button.
 *
 * A server component with plain links — no state, so it adds nothing to the
 * client bundle.
 */
const LINKS = [
  { href: "/talent", label: "Talent" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Support" },
];

export default function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--background)]">
      <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between px-5 md:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="relative h-8 w-8">
            <Image src="/logo.png" alt="" fill className="object-contain" sizes="32px" />
          </span>
          <span
            className="text-[19px] font-bold tracking-tight text-[var(--fg)]"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            DoItForMe
          </span>
        </Link>

        <nav aria-label="Site" className="hidden items-center gap-7 text-[15px] font-medium text-[var(--fg-muted)] md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-[var(--fg)]">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <Link
            href="/login"
            className="inline-flex min-h-[44px] items-center px-3.5 text-[15px] font-semibold text-[var(--fg)] transition-opacity hover:opacity-80"
          >
            Log in
          </Link>
          <Link
            href="/company/onboarding"
            className="hidden min-h-[44px] items-center rounded-full border border-[var(--line-strong)] bg-[var(--chip)] px-5 text-[15px] font-semibold text-[var(--fg)] transition-colors hover:bg-[var(--chip-strong)] sm:inline-flex"
          >
            Get work done
          </Link>
        </div>
      </div>
    </header>
  );
}
