import type { Metadata } from "next";

/**
 * `/verify` is a transactional step in the OTP flow, not a destination.
 *
 * It is marked `noindex` even though `app/robots.ts` allows the path: robots
 * rules ask a crawler not to FETCH a URL, while this tag asks it not to LIST
 * one, and the two are not substitutes. A page reached mid-sign-in has nothing
 * useful in a search result, and indexing it invites someone to arrive here
 * with no pending code and conclude the product is broken.
 */
export const metadata: Metadata = {
  title: "Verify your email",
  description: "Enter the one-time code sent to your email to finish signing in.",
  robots: { index: false, follow: true },
};

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
