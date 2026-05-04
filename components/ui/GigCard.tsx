import Image from "next/image";
import Link from "next/link";
import { MapPin, Briefcase, ShoppingBag, Building2, IndianRupee } from "lucide-react";
import StatusBadge, { statusToTone, humanizeStatus } from "./StatusBadge";

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
  highlight_expires_at?: string | null;
  users?: { college?: string | null } | null;
};

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

function TypePill({ listing_type, market_type }: { listing_type?: string | null; market_type?: string | null }) {
  if (listing_type === "MARKET") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.04] text-white/60 border border-white/[0.08] text-[10px] font-medium tracking-tight uppercase">
        <ShoppingBag size={10} />
        {market_type === "REQUEST" ? "Looking for" : market_type || "Market"}
      </span>
    );
  }
  if (listing_type === "COMPANY_TASK") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#8825F5]/10 text-[#C9A9FF] border border-[#8825F5]/20 text-[10px] font-medium tracking-tight uppercase">
        <Building2 size={10} />
        Company
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#8825F5]/10 text-[#C9A9FF] border border-[#8825F5]/20 text-[10px] font-medium tracking-tight uppercase">
      <Briefcase size={10} />
      Hustle
    </span>
  );
}

export default function GigCard({ gig, imageUrl, variant = "detailed", className = "" }: GigCardProps) {
  const isMarket = gig.listing_type === "MARKET";
  const isHighlighted = !!(gig.is_highlighted && gig.highlight_expires_at && new Date(gig.highlight_expires_at) > new Date());
  const showStatus = gig.status && gig.status.toLowerCase() !== "open";

  const ringClass = isHighlighted
    ? "border-[#8825F5]/40 ring-1 ring-[#8825F5]/20"
    : "border-white/[0.08] hover:border-white/[0.16]";

  if (variant === "compact") {
    return (
      <Link href={`/gig/${gig.id}`} className={`block group ${className}`}>
        <div className={`bg-[#13131A] rounded-2xl overflow-hidden border transition-colors ${ringClass}`}>
          <div className="w-full aspect-square bg-[#0B0B11] relative overflow-hidden">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={gig.title}
                fill
                sizes="(max-width: 768px) 50vw, 33vw"
                className="object-cover group-hover:scale-[1.03] transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/20">
                {isMarket ? <ShoppingBag size={28} /> : <Briefcase size={28} />}
              </div>
            )}
            <div className="absolute top-2 left-2 z-10">
              <TypePill listing_type={gig.listing_type} market_type={gig.market_type} />
            </div>
            {gig.price != null && gig.market_type !== "REQUEST" && (
              <div className="absolute top-2 right-2 z-10 inline-flex items-center px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-semibold text-white">
                <IndianRupee size={10} className="mr-0.5" />
                {gig.price}
              </div>
            )}
          </div>
          <div className="p-3">
            <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2 mb-2 group-hover:text-[#C9A9FF] transition-colors">
              {gig.title}
            </h3>
            <div className="flex items-center justify-between text-[11px] text-white/50">
              <span className="flex items-center gap-1 truncate max-w-[60%]">
                <MapPin size={10} /> {gig.location || gig.users?.college || "Campus"}
              </span>
              <span>{timeAgo(gig.created_at)}</span>
            </div>
            {showStatus && (
              <div className="mt-2">
                <StatusBadge tone={statusToTone(gig.status)}>{humanizeStatus(gig.status)}</StatusBadge>
              </div>
            )}
          </div>
        </div>
      </Link>
    );
  }

  // detailed variant
  return (
    <Link href={`/gig/${gig.id}`} className={`block group ${className}`}>
      <div className={`bg-[#13131A] rounded-2xl p-5 md:p-6 border transition-colors flex flex-col h-full ${ringClass}`}>
        <div className="flex items-center justify-between mb-3">
          <TypePill listing_type={gig.listing_type} market_type={gig.market_type} />
          {isHighlighted && (
            <span className="text-[10px] font-medium tracking-tight text-[#C9A9FF] uppercase">Featured</span>
          )}
        </div>
        <h3 className="font-semibold text-white text-base leading-snug line-clamp-2 mb-3 group-hover:text-[#C9A9FF] transition-colors">
          {gig.title}
        </h3>
        <div className="flex items-baseline gap-1 mb-auto">
          {gig.price != null ? (
            <>
              <span className="text-xl font-semibold text-white tracking-tight">₹{gig.price}</span>
              {isMarket && gig.market_type === "RENT" && <span className="text-xs text-white/40">/day</span>}
            </>
          ) : (
            <span className="text-xs text-white/40">Open offer</span>
          )}
        </div>
        <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] text-white/50">
            <MapPin size={11} /> {gig.is_physical ? "Physical" : "Online"}
            {gig.users?.college && <span className="text-white/30">· {gig.users.college}</span>}
          </span>
          <div className="flex items-center gap-2">
            {showStatus && <StatusBadge tone={statusToTone(gig.status)}>{humanizeStatus(gig.status)}</StatusBadge>}
            <span className="text-[11px] text-white/40">{timeAgo(gig.created_at)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
