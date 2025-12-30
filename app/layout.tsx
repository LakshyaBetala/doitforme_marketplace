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
  // Fix for the "metadataBase" warning:
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
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

        {/* --- 🐞 BUG REPORT BUTTON (Bottom Left) --- */}
        {/* This will appear on EVERY page (Dashboard, Home, Login, etc.) */}
        <a
          href="mailto:betala911@gmail.com?subject=Bug Report - DoItForMe Beta&body=Hey team,%0D%0A%0D%0AI found a bug!%0D%0A%0D%0A[Describe what happened]%0D%0A%0D%0A[Please attach a screenshot if possible]"
          className="fixed bottom-6 left-6 z-50 flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full backdrop-blur-md hover:bg-red-500/20 hover:scale-105 transition-all cursor-pointer group shadow-lg shadow-red-900/20 print:hidden"
        >
          <div className="relative">
            {/* Bug Icon */}
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className="animate-pulse"
            >
              <path d="m8 2 1.88 1.88" />
              <path d="M14.12 3.88 16 2" />
              <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
              <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" />
              <path d="M12 20v-9" />
              <path d="M6.53 9C4.6 8.8 3 7.1 3 5" />
              <path d="M6 13H2" />
              <path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
              <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" />
              <path d="M22 13h-4" />
              <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
            </svg>
            {/* Notification Dot */}
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
          </div>
          
          <div className="flex flex-col items-start leading-none">
            <span className="text-sm font-bold text-white group-hover:text-red-100">Report Bug</span>
            <span className="text-[10px] text-red-300 font-mono mt-1">Get cash Credit</span>
          </div>
        </a>

      </body>
    </html>
  );
}