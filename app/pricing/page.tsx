import type { Metadata } from "next";
import PricingContent from "./PricingContent";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.doitforme.in';

export const metadata: Metadata = {
  title: "Pricing – DoItForMe Student Gig Platform Fees",
  description:
    "DoItForMe pricing is simple: Direct Connect is completely FREE. Optional Escrow Protection for tasks ₹500+ costs just 3%. No hidden charges. Instant UPI payouts.",
  alternates: { canonical: `${BASE_URL}/pricing` },
  openGraph: {
    title: "DoItForMe Pricing – Free Direct Connect, 3% Escrow",
    description:
      "Free to post and complete tasks. Optional 3% escrow protection for larger gigs. See our simple, student-friendly pricing.",
    url: `${BASE_URL}/pricing`,
    siteName: "DoItForMe",
    type: "website",
    locale: "en_IN",
  },
};

export default function PricingPage() {
  return <PricingContent />;
}