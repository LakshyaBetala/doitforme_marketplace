import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DoItForMe — Students Helping Students",
  description:
    "India’s first Gen-Z student marketplace. Outsource tasks. Earn from free time.",
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "DoItForMe",
    description: "Students Helping Students.",
    images: ["/logo.svg"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* 1. bg-[#0B0B11]: Matches the dark theme of the landing page.
        2. selection:... : Customizes the text highlight color to purple.
        3. overflow-x-hidden: Prevents horizontal scrolling from animations.
      */}
      <body className="bg-[#0B0B11] text-white antialiased relative overflow-x-hidden selection:bg-[#8825F5] selection:text-white">
        
        {/* GLOBAL BACKGROUND NOISE (Texture) */}
        {/* This adds a subtle grain effect to the dark background, popular in Gen-Z designs */}
        <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.03] mix-blend-overlay">
           <svg className="h-full w-full">
             <filter id="noise">
               <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" />
             </filter>
             <rect width="100%" height="100%" filter="url(#noise)" />
           </svg>
        </div>

        {/* MAIN CONTENT WRAPPER */}
        {/* Navbar and Footer are intentionally removed here as they are inside page.tsx */}
        <main className="relative z-10 min-h-screen flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}