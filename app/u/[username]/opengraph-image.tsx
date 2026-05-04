import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

/**
 * OG image for /u/[username] — rendered at edge.
 *
 * When this profile link is shared on WhatsApp / LinkedIn / Twitter,
 * the platform fetches /u/<username>/opengraph-image and shows this
 * branded preview instead of a default screenshot.
 *
 * Constraints:
 *  - Edge runtime: cannot use the SSR cookie client; uses anon-key client only.
 *  - Selects ONLY public-safe fields. Never touch phone/email/upi.
 */
export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({
  params,
}: {
  params: { username: string };
}) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: user } = await supabase
    .from("users")
    .select("display_name, name, college, rating, rating_count, jobs_completed, kyc_verified")
    .eq("username", params.username)
    .maybeSingle();

  const displayName = user?.display_name || user?.name || `@${params.username}`;
  const stat = (label: string, value: string) => ({ label, value });
  const stats = [
    stat("Gigs done", String(user?.jobs_completed ?? 0)),
    stat(
      "Rating",
      (user?.rating_count ?? 0) > 0 ? Number(user?.rating).toFixed(1) : "—"
    ),
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0B0B11",
          color: "white",
          padding: "72px",
          fontFamily: "Inter, system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* subtle brand purple ambient */}
        <div
          style={{
            position: "absolute",
            top: -200,
            right: -200,
            width: 600,
            height: 600,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(136,37,245,0.25) 0%, rgba(136,37,245,0) 60%)",
          }}
        />

        {/* Top: brand mark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 22,
            color: "rgba(255,255,255,0.5)",
            letterSpacing: "-0.01em",
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 4,
              background: "#8825F5",
            }}
          />
          DoItForMe
        </div>

        {/* Middle: name + handle */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: "auto",
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 84,
              fontWeight: 600,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              maxWidth: 1000,
            }}
          >
            {displayName}
          </div>
          <div style={{ display: "flex", gap: 20, alignItems: "center", color: "rgba(255,255,255,0.55)", fontSize: 28 }}>
            <span>@{params.username}</span>
            {user?.college && (
              <>
                <span style={{ color: "rgba(255,255,255,0.25)" }}>·</span>
                <span>{user.college}</span>
              </>
            )}
            {user?.kyc_verified && (
              <>
                <span style={{ color: "rgba(255,255,255,0.25)" }}>·</span>
                <span style={{ color: "#C9A9FF" }}>Verified</span>
              </>
            )}
          </div>
        </div>

        {/* Bottom: stats row */}
        <div
          style={{
            display: "flex",
            gap: 56,
            marginTop: 56,
            paddingTop: 32,
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {stats.map((s) => (
            <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span
                style={{
                  fontSize: 16,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: "rgba(255,255,255,0.4)",
                }}
              >
                {s.label}
              </span>
              <span style={{ fontSize: 44, fontWeight: 600, letterSpacing: "-0.02em" }}>
                {s.value}
              </span>
            </div>
          ))}
          <div style={{ marginLeft: "auto", alignSelf: "flex-end", color: "rgba(255,255,255,0.4)", fontSize: 22 }}>
            doitforme.in/u/{params.username}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
