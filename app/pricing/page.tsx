import type { Metadata } from "next";
import PricingContent from "./PricingContent";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.doitforme.in';

export const metadata: Metadata = {
  title: "Pricing – DoItForMe Student Gig Platform Fees",
  description:
    "DoItForMe pricing is simple and transparent. 0% commission for posters, 10% platform fee for workers (only on withdrawal). No hidden charges. Escrow-protected payments and instant UPI payouts.",
  alternates: { canonical: `${BASE_URL}/pricing` },
  openGraph: {
    title: "DoItForMe Pricing – Transparent Student Platform Fees",
    description:
      "Free to post tasks. Workers keep 90% of earnings. See our simple, student-friendly pricing model.",
    url: `${BASE_URL}/pricing`,
    siteName: "DoItForMe",
    type: "website",
    locale: "en_IN",
  },
};

export default function PricingPage() {
  return <PricingContent />;
}