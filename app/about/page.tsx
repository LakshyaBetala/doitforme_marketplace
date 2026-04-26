import type { Metadata } from "next";
import AboutContent from "./AboutContent";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.doitforme.in';

export const metadata: Metadata = {
  title: "About DoItForMe – India's Campus Freelance Network",
  description:
    "Learn about DoItForMe, India's first student-to-student gig platform. Built by students, for students — outsource tasks, earn money, and hustle on campus with escrow-protected payments.",
  alternates: { canonical: `${BASE_URL}/about` },
  openGraph: {
    title: "About DoItForMe – India's Campus Freelance Network",
    description:
      "DoItForMe empowers Indian university students to earn money and outsource tasks. Verified IDs, escrow payments, instant UPI.",
    url: `${BASE_URL}/about`,
    siteName: "DoItForMe",
    type: "website",
    locale: "en_IN",
  },
};

export default function AboutPage() {
  return <AboutContent />;
}