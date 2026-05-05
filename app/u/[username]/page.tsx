import { notFound } from "next/navigation";
import Link from "next/link";
import { Star, ShieldCheck, Briefcase, GraduationCap, ExternalLink, Calendar, MapPin } from "lucide-react";
import { supabaseServer } from "@/lib/supabaseServer";
import Avatar from "@/components/ui/Avatar";
import StatusBadge from "@/components/ui/StatusBadge";

/**
 * Public profile page — /u/[username]
 *
 * Surfaces only fields safe for public consumption. Sensitive fields
 * (phone, email, upi_id, id_card_url, telegram_chat_id, points_balance,
 * referral_code) MUST NEVER be selected here.
 */

type PublicUser = {
  id: string;
  username: string | null;
  display_name: string | null;
  name: string | null;
  avatar_url: string | null;
  bio: string | null;
  skills: string[] | null;
  portfolio_links: string[] | null;
  experience: string | null;
  year_of_study: number | null;
  branch: string | null;
  college: string | null;
  rating: number | null;
  rating_count: number | null;
  jobs_completed: number | null;
  kyc_verified: boolean | null;
  is_verified_company: boolean | null;
  preferences: string[] | null;
  created_at: string | null;
};

type PublicGig = {
  id: string;
  title: string;
  price: number | null;
  status: string | null;
  listing_type: string | null;
  market_type: string | null;
  created_at: string | null;
};

const PUBLIC_FIELDS = [
  "id", "username", "display_name", "name", "avatar_url", "bio",
  "skills", "portfolio_links", "experience", "year_of_study", "branch", "college",
  "rating", "rating_count", "jobs_completed", "kyc_verified", "is_verified_company",
  "preferences", "created_at",
].join(", ");

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(username);
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("users")
    .select("display_name, name, bio")
    .eq(isUuid ? "id" : "username", username)
    .maybeSingle();
  if (!data) return { title: `@${username}` };
  const name = data.display_name || data.name || (isUuid ? "Profile" : `@${username}`);
  return {
    title: `${name} — DoItForMe`,
    description: data.bio || `${name} on DoItForMe — India's campus freelance network.`,
  };
}

function memberSince(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(username);
  const supabase = await supabaseServer();

  const { data: user } = await supabase
    .from("users")
    .select(PUBLIC_FIELDS)
    .eq(isUuid ? "id" : "username", username)
    .maybeSingle<PublicUser>();

  if (!user) notFound();

  // Run public queries in parallel — no escrow/payment data ever leaked.
  const [{ data: gigs }, { data: completedAsWorker }, { data: reviews }] = await Promise.all([
    // Posts the user has created (poster side)
    supabase
      .from("gigs")
      .select("id, title, price, status, listing_type, market_type, created_at")
      .eq("poster_id", user.id)
      .in("status", ["open", "assigned", "delivered", "completed"])
      .order("created_at", { ascending: false })
      .limit(6),
    // Gigs this user completed AS THE WORKER (proof-of-work for hire-side trust)
    supabase
      .from("gigs")
      .select("id, title, price, listing_type, created_at")
      .eq("assigned_worker_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(6),
    // Reviews this user has received — schema-safe nested join via rated_id
    supabase
      .from("ratings")
      .select("id, score, review, created_at, gig_id, rater:users!ratings_rater_id_fkey(name, username, avatar_url)")
      .eq("rated_id", user.id)
      .not("review", "is", null)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const displayName = user.display_name || user.name || `@${user.username}`;
  const subtitle = [user.branch, user.year_of_study ? `Year ${user.year_of_study}` : null]
    .filter(Boolean)
    .join(" · ");
  const ratingNum = user.rating ? Number(user.rating) : 0;
  const showRating = (user.rating_count ?? 0) > 0;

  return (
    <div className="min-h-screen bg-[#0B0B11] text-white">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12 space-y-8">
        {/* HEADER */}
        <header className="bg-[#13131A] border border-white/[0.08] rounded-2xl p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            <Avatar
              src={user.avatar_url}
              fallback={displayName}
              className="w-20 h-20 md:w-24 md:h-24"
              textClassName="text-2xl md:text-3xl"
              sizes="96px"
            />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-white truncate">
                  {displayName}
                </h1>
                {user.kyc_verified && (
                  <span title="KYC verified" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#8825F5]/10 text-[#C9A9FF] border border-[#8825F5]/20 text-[10px] font-medium">
                    <ShieldCheck size={10} /> Verified
                  </span>
                )}
                {user.is_verified_company && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/[0.04] text-white/60 border border-white/[0.08] text-[10px] font-medium">
                    Company
                  </span>
                )}
              </div>
              {user.username && (
                <p className="text-sm text-white/50 mb-3">@{user.username}</p>
              )}
              {(user.college || subtitle) && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/60">
                  {user.college && (
                    <span className="inline-flex items-center gap-1.5">
                      <GraduationCap size={12} className="text-white/40" />
                      {user.college}
                    </span>
                  )}
                  {subtitle && <span>{subtitle}</span>}
                </div>
              )}
              {user.bio && (
                <p className="text-sm text-white/70 mt-4 leading-relaxed max-w-2xl whitespace-pre-line">
                  {user.bio}
                </p>
              )}
            </div>
          </div>

          {/* STATS ROW */}
          <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-white/[0.06]">
            <StatBlock
              icon={<Briefcase size={14} />}
              label="Gigs done"
              value={String(user.jobs_completed ?? 0)}
            />
            <StatBlock
              icon={<Star size={14} className="text-[#C9A9FF]" />}
              label="Rating"
              value={showRating ? ratingNum.toFixed(1) : "—"}
              sub={showRating ? `${user.rating_count} reviews` : "no reviews yet"}
            />
            <StatBlock
              icon={<Calendar size={14} />}
              label="Member since"
              value={memberSince(user.created_at) || "—"}
            />
          </div>
        </header>

        {/* SKILLS */}
        {user.skills && user.skills.length > 0 && (
          <Section title="Skills">
            <div className="flex flex-wrap gap-2">
              {user.skills.map((skill) => (
                <span
                  key={skill}
                  className="px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs text-white/80 font-medium"
                >
                  {skill}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* EXPERIENCE */}
        {user.experience && (
          <Section title="Experience">
            <p className="text-sm text-white/70 leading-relaxed whitespace-pre-line">
              {user.experience}
            </p>
          </Section>
        )}

        {/* PORTFOLIO */}
        {user.portfolio_links && user.portfolio_links.length > 0 && (
          <Section title="Portfolio">
            <ul className="space-y-2">
              {user.portfolio_links.map((url) => (
                <li key={url}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="group inline-flex items-center gap-2 text-sm text-white/80 hover:text-[#C9A9FF] transition-colors break-all"
                  >
                    <ExternalLink size={12} className="text-white/40 group-hover:text-[#C9A9FF] shrink-0" />
                    <span className="underline-offset-2 group-hover:underline">{url}</span>
                  </a>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* INTERESTS */}
        {user.preferences && user.preferences.length > 0 && (
          <Section title="Interests">
            <div className="flex flex-wrap gap-2">
              {user.preferences.map((p) => (
                <span
                  key={p}
                  className="px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs text-white/60 font-medium"
                >
                  {p}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* RECENT POSTS */}
        {gigs && gigs.length > 0 && (
          <Section title="Recent posts">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {gigs.map((g) => (
                <Link
                  key={g.id}
                  href={`/gig/${g.id}`}
                  className="block bg-[#13131A] border border-white/[0.08] hover:border-white/[0.16] rounded-xl p-4 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-[#C9A9FF] transition-colors">
                      {g.title}
                    </h3>
                    {g.status && g.status !== "open" && (
                      <StatusBadge tone="neutral">{g.status}</StatusBadge>
                    )}
                  </div>
                  {g.price != null && (
                    <span className="text-sm font-semibold text-white">₹{g.price}</span>
                  )}
                </Link>
              ))}
            </div>
          </Section>
        )}

        {/* COMPLETED WORK — proof-of-work for the worker side */}
        {completedAsWorker && completedAsWorker.length > 0 && (
          <Section title={`Completed work · ${user.jobs_completed ?? completedAsWorker.length}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {completedAsWorker.map((g) => (
                <Link
                  key={g.id}
                  href={`/gig/${g.id}`}
                  className="block bg-[#13131A] border border-white/[0.08] hover:border-white/[0.16] rounded-xl p-4 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-[#C9A9FF] transition-colors">
                      {g.title}
                    </h3>
                    <StatusBadge tone="success">Completed</StatusBadge>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-white/40">
                    {g.price != null && <span className="text-white/60">₹{g.price}</span>}
                    <span>·</span>
                    <span>{memberSince(g.created_at)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </Section>
        )}

        {/* REVIEWS — written feedback received */}
        {reviews && reviews.length > 0 && (
          <Section title={`Reviews · ${user.rating_count ?? reviews.length}`}>
            <div className="space-y-3">
              {reviews.map((r: any) => {
                const rater = Array.isArray(r.rater) ? r.rater[0] : r.rater;
                const raterName = rater?.name || "Anonymous";
                return (
                  <div
                    key={r.id}
                    className="bg-[#13131A] border border-white/[0.08] rounded-xl p-4"
                  >
                    <div className="flex items-start gap-3 mb-2">
                      <Avatar
                        src={rater?.avatar_url}
                        fallback={raterName}
                        className="w-8 h-8 shrink-0"
                        textClassName="text-xs"
                        sizes="32px"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          {rater?.username ? (
                            <Link
                              href={`/u/${rater.username}`}
                              className="text-sm font-medium text-white hover:text-[#C9A9FF] transition-colors truncate"
                            >
                              {raterName}
                            </Link>
                          ) : (
                            <span className="text-sm font-medium text-white truncate">{raterName}</span>
                          )}
                          <span className="inline-flex items-center gap-0.5 text-[11px] text-[#C9A9FF]">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                size={11}
                                className={i < r.score ? "fill-[#C9A9FF] text-[#C9A9FF]" : "text-white/20"}
                              />
                            ))}
                          </span>
                        </div>
                        <span className="text-[11px] text-white/40">{memberSince(r.created_at)}</span>
                      </div>
                    </div>
                    <p className="text-sm text-white/70 leading-relaxed pl-11">{r.review}</p>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* EMPTY DEPTH FALLBACK — only when there's truly nothing to show */}
        {!user.bio &&
          (!user.skills || user.skills.length === 0) &&
          !user.experience &&
          (!gigs || gigs.length === 0) &&
          (!completedAsWorker || completedAsWorker.length === 0) &&
          (!reviews || reviews.length === 0) && (
            <p className="text-center text-xs text-white/40 py-6">
              This profile hasn&apos;t been filled out yet.
            </p>
          )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-white/40 mb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}

function StatBlock({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] text-white/40 uppercase tracking-tight mb-1">
        <span className="text-white/40">{icon}</span>
        {label}
      </div>
      <div className="text-base font-semibold text-white tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-white/40 mt-0.5">{sub}</div>}
    </div>
  );
}
