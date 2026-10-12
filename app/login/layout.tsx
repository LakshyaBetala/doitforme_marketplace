import type { Metadata } from "next";

/**
 * A login page is worth a real title because it is where shared links and
 * password managers land, and "DoItForMe – India's Campus Freelance Network"
 * told a returning student nothing about which screen they were on.
 *
 * It is left indexable to match `app/robots.ts`, which allows `/login`
 * explicitly: it is a legitimate entry point people search for by name. The
 * description is written for that intent rather than for acquisition.
 */
export const metadata: Metadata = {
  title: "Log in",
  description:
    "Log in to DoItForMe to post a task, apply for work, or track a gig you have in progress. Sign in with a one-time code sent to your email.",
  alternates: { canonical: "/login" },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
