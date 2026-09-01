import type { Metadata } from "next";
import ShippingContent from "./ShippingContent";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.doitforme.in';

export const metadata: Metadata = {
  title: "Shipping & Delivery Policy – DoItForMe",
  description:
    "How work is delivered on DoItForMe. No physical goods are shipped: digital tasks are delivered on the task page, campus services in person. Deadlines are agreed per task, with a 24-hour review window.",
  alternates: { canonical: `${BASE_URL}/shipping-policy` },
  openGraph: {
    title: "Shipping & Delivery Policy – DoItForMe",
    description: "Service delivery timelines, confirmation, and what happens if a deadline is missed.",
    url: `${BASE_URL}/shipping-policy`,
    siteName: "DoItForMe",
    type: "website",
    locale: "en_IN",
  },
};

export default function ShippingPolicyPage() {
  return <ShippingContent />;
}
