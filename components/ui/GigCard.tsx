import Image from "next/image";
import Link from "next/link";
import { MapPin, Briefcase, ShoppingBag, Building2, Users, Sparkles, Zap } from "lucide-react";
import StatusBadge, { statusToTone, humanizeStatus } from "./StatusBadge";
import { isServiceAdvert, responderNoun } from "@/lib/gigRoles";

/**
 * Canonical gig card. Renders any gigs row regardless of listing_type.
 *
 * Visual rules:
 *  - One surface treatment for all listing_types — type is a small pill, not a hue change.
 *  - HUSTLE = info tone, MARKET = neutral, COMPANY_TASK = info w/ building icon.
 *  - Highlighted gigs get a brand-purple ring, not a glow halo.
 *  - Status pill shown only when status is set and not 'open' (open is the implicit default).
 */
type Gig = {
  id: string;
  title: string;
  price: number | null;
  status?: string | null;
  listing_type?: "HUSTLE" | "MARKET" | "COMPANY_TASK" | string | null;
  market_type?: string | null;
  location?: string | null;
  is_physical?: boolean | null;
  images?: string[] | null;
  created_at?: string | null;
  is_highlighted?: boolean | null;
  is_featured?: boolean | null;
  highlight_expires_at?: string | null;
  applicant_count?: number | null;
  max_workers?: number | null;
  users?: { college?: string | null } | null;
  company_id?: string | null;
  companies?: { name?: string | null } | null;
};

/**
 * Who is behind the listing. A COMPANY_TASK is posted by a business, so the
 * poster's own campus is meaningless (and misleading) there — show the company
 * instead. Student listings keep showing the campus.
 */
function posterLabel(gig: Gig): string | null {
  if (gig.listing_type === "COMPANY_TASK" || gig.company_id) {
    return gig.companies?.name || "Company";
  }
  return gig.users?.college || null;
}

type GigCardProps = {
  gig: Gig;
  /** Public storage URL for the first image (caller resolves it; primitive stays storage-agnostic). */
  imageUrl?: string | null;
  /** Layout: "compact" = image+title only (feed grid), "detailed" = with metadata footer (dashboard list). */
  variant?: "compact" | "detailed";
  className?: string;
};

function timeAgo(dateString?: string | null) {
  if (!dateString) return "";
  const safe = dateString.endsWith("Z") || dateString.includes("+") ? dateString : `${dateString}Z`;
  const seconds = Math.floor((Date.now() - new Date(safe).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function TypePill({ listing_type, market_type, isPriority }: { listing_type?: string | null; market_type?: string | null; isPriority?: boolean }) {
  // A Pro company's task is the highest-intent listing on the platform: a real
  // business, real budget, and a cap of 50 applicants instead of 10. It gets the
  // one loud label so students can spot paid company work at a glance.
  if (listing_type === "COMPANY_TASK" && isPriority) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent)] text-[var(--on-accent)] border border-[var(--accent)] text-[10px] font-semibold tracking-tight uppercase">
        <Zap size={10} />
        Priority
      </span>
    );
  }
  if (listing_type === "MARKET") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--chip)] text-[var(--fg-muted)] border border-[var(--line)] text-[10px] font-medium tracking-tight uppercase">
        <ShoppingBag size={10} />
        {market_type === "REQUEST" ? "Looking for" : market_type || "Market"}
      </span>
    );
  }
  // SERVICE = someone advertising their own skills. Neutral tone on purpose:
  // purple is reserved for demand (Hustle/Company), so a buyer scanning the
  // page can tell "work available" from "person available" at a glance.
  if (listing_type === "SERVICE") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--chip)] text-[var(--fg-muted)] border border-[var(--line)] text-[10px] font-medium tracking-tight uppercase">
        <Sparkles size={10} />
        Offering
      </span>
    );
  }
  if (listing_type === "COMPANY_TASK") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent-ink)] border border-[var(--accent-line)] text-[10px] font-medium tracking-tight uppercase">
        <Building2 size={10} />
        Company
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent-ink)] border border-[var(--accent-line)] text-[10px] font-medium tracking-tight uppercase">
      <Briefcase size={10} />
      Hustle
    </span>
  );
}

export default function GigCard({ gig, imageUrl, variant = "detailed", className = "" }: GigCardProps) {
  const isMarket = gig.listing_type === "MARKET";
  const isAdvert = isServiceAdvert(gig);
  const isHighlighted = !!gig.is_featured || !!(gig.is_highlighted && gig.highlight_expires_at && new Date(gig.highlight_expires_at) > new Date());
  const showStatus = gig.status && gig.status.toLowerCase() !== "open";
  const responderCount = gig.applicant_count ?? 0;
  // "3 hiring" is a fact about a task: three people want the job. On a service
  // advert the same number means three people want to BUY, so the word has to
  // flip with the listing — calling a prospective customer an applicant is what
  // pointed this whole flow backwards. See lib/gigRoles.ts.
  const responderLabel =
    !isMarket && responderCount > 0
      ? isAdvert
        ? `${responderCount} ${responderNoun(gig, responderCount)}`
        : `${responderCount} hiring`
      : null;

  const ringClass = isHighlighted
    ? "border-[var(--accent-line)] ring-1 ring-[var(--accent-soft)]"
    : "border-[var(--line)] hover:border-[var(--line-strong)]";

  if (variant === "compact") {
    // THE MEDIA BOX ONLY EXISTS WHEN THERE IS MEDIA.
    //
    // This used to render `aspect-square` unconditionally, with a 28px briefcase
    // centred in it when the gig had no photo. Most gigs have no photo — this is
    // a task board, not a gallery — so the common case was a card whose top 350px
    // on a phone (and ~640px in a three-column desktop grid) was empty cream with
    // a small grey icon in the middle. Three cards filled a phone screen with
    // almost no information on it.
    //
    // With no image the card becomes text-first and about a third of the height,
    // which is what makes the feed scannable. With an image, nothing changes.
    const hasMedia = Boolean(imageUrl);
    const priceChip =
      gig.price != null && gig.market_type !== "REQUEST" ? (
        <span className="inline-flex shrink-0 items-baseline text-[13.5px] font-bold tabular-nums text-[var(--fg)]">
          ₹{gig.price}
          {isMarket && gig.market_type === "RENT" && (
            <span className="ml-0.5 text-[10px] font-semibold text-[var(--fg-faint)]">/day</span>
          )}
        </span>
      ) : null;

    return (
      <Link href={`/gig/${gig.id}`} className={`block group h-full ${className}`}>
        <div
          className={`flex h-full flex-col overflow-hidden rounded-2xl bg-[var(--surface)] border transition-colors ${ringClass}`}
        >
          {hasMedia && (
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--chip)]">
              <Image
                src={imageUrl!}
                alt={gig.title}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
              {/* The dark scrim is right over a photograph and wrong over a flat
                  placeholder, which is the other reason the no-image card does
                  not keep it — the price moves inline below instead. */}
              <span className="absolute right-2 top-2 z-10 inline-flex items-center rounded-full border border-white/20 bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-md">
                {gig.price != null && gig.market_type !== "REQUEST" ? `₹${gig.price}` : "Open offer"}
              </span>
            </div>
          )}

          <div className="flex flex-1 flex-col p-3.5">
            <div className="flex items-start justify-between gap-2">
              <TypePill
                listing_type={gig.listing_type}
                market_type={gig.market_type}
                isPriority={isHighlighted}
              />
              {!hasMedia && priceChip}
            </div>

            <h3 className="mt-2.5 line-clamp-2 text-[14.5px] font-semibold leading-snug text-[var(--fg)] transition-colors group-hover:text-[var(--accent-ink)]">
              {gig.title}
            </h3>

            {/* mt-auto pins the meta row to the bottom so cards in a grid line up
                along their footer even when titles wrap to different heights. */}
            <div className="mt-auto pt-2.5">
              <div className="flex items-center justify-between gap-2 text-[11.5px] text-[var(--fg-muted)]">
                <span className="flex min-w-0 items-center gap-1 truncate">
                  <MapPin size={11} className="shrink-0" />
                  <span className="truncate">{gig.location || posterLabel(gig) || "Campus"}</span>
                </span>
                <span className="shrink-0">{timeAgo(gig.created_at)}</span>
              </div>

              {(responderLabel || showStatus) && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {responderLabel && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--accent-line)] bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent-ink)]">
                      <Users size={10} /> {responderLabel}
                    </span>
                  )}
                  {showStatus && (
                    <StatusBadge tone={statusToTone(gig.status)}>
                      {humanizeStatus(gig.status)}
                    </StatusBadge>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // detailed variant — one surface treatment for every listing_type.
  // COMPANY_TASK is distinguished only by its pill + a hairline purple ring, never a hue change.
  const isCompany = gig.listing_type === "COMPANY_TASK";
  const detailedRing = isHighlighted || isCompany
    ? "border-[var(--accent-line)] hover:border-[var(--accent)]"
    : "border-[var(--line)] hover:border-[var(--line-strong)]";

  return (
    <Link href={`/gig/${gig.id}`} className={`block group ${className}`}>
      <div className={`bg-[var(--surface)] rounded-2xl p-5 md:p-6 border transition-colors flex flex-col h-full ${detailedRing}`}>
        <div className="flex items-center justify-between mb-3">
          <TypePill listing_type={gig.listing_type} market_type={gig.market_type} isPriority={isHighlighted} />
          {isHighlighted && (
            <span className="text-[10px] font-medium tracking-tight text-[var(--accent-ink)] uppercase">Featured</span>
          )}
        </div>
        <h3 className="font-semibold text-[var(--fg)] text-base leading-snug line-clamp-2 mb-3 group-hover:text-[var(--accent-ink)] transition-colors">
          {gig.title}
        </h3>
        <div className="flex items-baseline gap-1 mb-auto">
          {gig.price != null ? (
            <>
              {/* An advert quotes a starting rate, not a fixed budget — the
                  final figure is agreed per job. Saying "from" is the
                  difference between a price and a quote. */}
              {isAdvert && <span className="text-xs text-[var(--fg-faint)] mr-1">from</span>}
              <span className="text-xl font-semibold text-[var(--fg)] tracking-tight">₹{gig.price}</span>
              {isMarket && gig.market_type === "RENT" && <span className="text-xs text-[var(--fg-faint)]">/day</span>}
            </>
          ) : (
            <span className="text-xs text-[var(--fg-faint)]">Open offer</span>
          )}
        </div>
        <div className="mt-5 pt-4 border-t border-[var(--line)] flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] text-[var(--fg-muted)]">
            <MapPin size={11} /> {gig.is_physical ? (isCompany ? "On-site" : "Physical") : "Remote"}
            {posterLabel(gig) && <span className="text-[var(--fg-faint)]">· {posterLabel(gig)}</span>}
          </span>
          <div className="flex items-center gap-2">
            {responderLabel && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--accent-ink)] bg-[var(--accent-soft)] border border-[var(--accent-line)] px-2 py-0.5 rounded-full">
                <Users size={10} /> {responderLabel}
              </span>
            )}
            {showStatus && <StatusBadge tone={statusToTone(gig.status)}>{humanizeStatus(gig.status)}</StatusBadge>}
            <span className="text-[11px] text-[var(--fg-faint)]">{timeAgo(gig.created_at)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
