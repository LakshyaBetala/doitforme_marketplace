import type { Metadata } from "next";
import TermsContent from "./TermsContent";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.doitforme.in';

export const metadata: Metadata = {
  title: "Terms & Conditions – DoItForMe Student Platform",
  description:
    "Read DoItForMe's Terms & Conditions. Covers user accounts, KYC verification, escrow payments, platform fees (Free Direct Connect, optional 3% escrow), prohibited activities, and dispute resolution.",
  alternates: { canonical: `${BASE_URL}/terms` },
  openGraph: {
    title: "Terms & Conditions – DoItForMe",
    description: "DoItForMe platform terms covering accounts, payments, fees, and dispute resolution for student gig workers and posters.",
    url: `${BASE_URL}/terms`,
    siteName: "DoItForMe",
    type: "website",
    locale: "en_IN",
  },
};

export default function TermsPage() {
  return <TermsContent />;
}