import type { Metadata } from "next";
import PrivacyContent from "./PrivacyContent";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.doitforme.in';

export const metadata: Metadata = {
  title: "Privacy Policy – DoItForMe Student Platform",
  description:
    "DoItForMe Privacy Policy. Learn how we collect, use, and protect your personal data including student ID verification, payment information, and communication data. PCI-DSS compliant via Cashfree.",
  alternates: { canonical: `${BASE_URL}/privacy-policy` },
  openGraph: {
    title: "Privacy Policy – DoItForMe",
    description: "How DoItForMe handles your data — student IDs, payments, and personal information. Transparent and secure.",
    url: `${BASE_URL}/privacy-policy`,
    siteName: "DoItForMe",
    type: "website",
    locale: "en_IN",
  },
};

export default function PrivacyPolicyPage() {
  return <PrivacyContent />;
}