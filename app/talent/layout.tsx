import type { Metadata } from "next";

/**
 * `/talent` is the only page that renders Supabase data to an ANONYMOUS
 * visitor, which makes it the one public surface search engines can actually
 * index with content on it. It had no title or description of its own, so it
 * inherited the site-wide default and competed with the landing page for the
 * same snippet.
 *
 * The metadata lives in a layout because `page.tsx` is a client component and
 * `export const metadata` is server-only — Next silently ignores it there
 * rather than erroring, which is why the omission was invisible.
 */
export const metadata: Metadata = {
  title: "Browse student talent",
  description:
    "Hire verified student freelancers in India — developers, designers and writers. Payment is held in escrow until you approve the work.",
  alternates: { canonical: "/talent" },
  openGraph: {
    title: "Browse student talent | DoItForMe",
    description:
      "Hire verified student freelancers in India. Payment held in escrow until you approve the work.",
    url: "/talent",
    type: "website",
  },
};

export default function TalentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
