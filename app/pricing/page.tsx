import type { Metadata } from "next";
import PricingContent from "./PricingContent";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.doitforme.in';

export const metadata: Metadata = {
  title: "Pricing – Student Gig Platform Fees",
  description:
    "DoItForMe pricing is simple: free to post and free to apply. One platform fee — 5% on student listings, 10% on company tasks — taken from the payout, plus a 2% payment gateway fee. No hidden charges.",
  alternates: { canonical: `${BASE_URL}/pricing` },
  openGraph: {
    title: "DoItForMe Pricing – 5% Student, 10% Company",
    description:
      "Free to post and free to apply. 5% on student listings, 10% on company tasks, taken from the payout. See our simple, student-friendly pricing.",
    url: `${BASE_URL}/pricing`,
    siteName: "DoItForMe",
    type: "website",
    locale: "en_IN",
  },
};

export default function PricingPage() {
  return <PricingContent />;
}