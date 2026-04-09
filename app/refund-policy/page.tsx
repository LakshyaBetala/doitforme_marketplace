import type { Metadata } from "next";
import RefundContent from "./RefundContent";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.doitforme.in';

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy – DoItForMe Student Platform",
  description:
    "DoItForMe refund and cancellation policy. 100% escrow refund if you cancel before work starts or if the worker misses the deadline. Disputes resolved within 48 hours.",
  alternates: { canonical: `${BASE_URL}/refund-policy` },
  openGraph: {
    title: "Refund & Cancellation Policy – DoItForMe",
    description: "Escrow-protected refunds, transparent fees, and 48-hour dispute resolution on DoItForMe.",
    url: `${BASE_URL}/refund-policy`,
    siteName: "DoItForMe",
    type: "website",
    locale: "en_IN",
  },
};

export default function RefundPolicyPage() {
  return <RefundContent />;
}