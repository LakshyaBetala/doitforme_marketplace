import type { Metadata } from "next";
import LandingPage from "@/components/home/LandingPage";

export const metadata: Metadata = {
  title: "DoItForMe | India's #1 Verified Student Gig Marketplace",
  description: "Connect with ambitious university students for freelance gigs, errands, and micro-internships. Secure Escrow payments and instant UPI withdrawals.",
  keywords: [
    "Student Freelance India",
    "Hire Students",
    "DoItForMe",
    "College Gigs",
    "Pocket Money App",
    "Outsource Tasks"
  ],
  openGraph: {
    title: "DoItForMe | Get It Done by Students",
    description: "The safest marketplace for student gigs. Verified IDs and secure payments.",
    images: ["/logo1.png"],
  }
};

export default function Home() {
  return <LandingPage />;
}
