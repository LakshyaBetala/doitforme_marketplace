import type { Metadata } from "next";
import ContactContent from "./ContactContent";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.doitforme.in';

export const metadata: Metadata = {
  title: "Contact Us – DoItForMe Student Platform Support",
  description:
    "Get in touch with DoItForMe support for help with tasks, payments, disputes, or general queries. Email doitforme.in@gmail.com or call +91 93441 10272. Based in Chennai, India.",
  alternates: { canonical: `${BASE_URL}/contact` },
  openGraph: {
    title: "Contact DoItForMe – Student Platform Support",
    description:
      "Need help? Reach out to DoItForMe via email or phone. We resolve queries within 24 hours.",
    url: `${BASE_URL}/contact`,
    siteName: "DoItForMe",
    type: "website",
    locale: "en_IN",
  },
};

export default function ContactPage() {
  return <ContactContent />;
}