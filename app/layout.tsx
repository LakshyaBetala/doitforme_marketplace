
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Analytics } from '@vercel/analytics/next';
import { Toaster } from 'sonner';
import RealtimeListener from "@/components/RealtimeListener";
import NotificationManager from "@/components/NotificationManager";
import { SpeedInsights } from "@vercel/speed-insights/next"// Request notification permission

export const metadata: Metadata = {
  title: {
    default: "DoItForMe – Student Hustle Platform | India",
    template: "%s | DoItForMe",
  },
  description:
    "DoItForMe is India's first student-to-student platform. Post tasks (coding, design, tutoring, errands) to verified student freelancers. Escrow-protected payments, instant UPI payouts.",
  keywords: [
    "DoItForMe", "doitforme.in",
    "student hustle platform", "student freelance India", "campus gig platform",
    "hire student freelancer", "outsource task student", "earn money student India",
    "student gig India", "college task outsourcing", "campus freelance work",
    "peer-to-peer student services", "college task app", "student side hustle India",
    "affordable gig India", "instant upi payout freelance", "escrow payment student gig",
    "student tutoring app", "campus coding help", "student errand service",
  ],
  authors: [{ name: "DoItForMe Team", url: "https://www.doitforme.in" }],
  creator: "DoItForMe",
  publisher: "DoItForMe",
  formatDetection: { email: false, address: false, telephone: false },
  icons: { icon: "/Doitforme_logo.png", shortcut: "/Doitforme_logo.png", apple: "/Doitforme_logo.png" },
  openGraph: {
    title: "DoItForMe – Student Hustle Platform",
    description:
      "Post a Hustle to outsource tasks to verified student freelancers. India's #1 student gig platform.",
    url: "https://www.doitforme.in",
    siteName: "DoItForMe",
    images: [{ url: "/Doitforme_logo.png", width: 1200, height: 630, alt: "DoItForMe – Student Hustle Platform" }],
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "DoItForMe – Student Hustle Platform",
    description:
      "Hustle: outsource tasks to student freelancers. Verified IDs, escrow, instant UPI.",
    images: ["/Doitforme_logo.png"],
    creator: "@doitformein",
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://www.doitforme.in'),
  appleWebApp: {
    capable: true,
    title: "DoItForMe",
    statusBarStyle: "black-translucent",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-video-preview": -1, "max-image-preview": "large", "max-snippet": -1 },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0B0B11",
  interactiveWidget: "resizes-content", // Fix for Android keyboard covering inputs
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "DoItForMe",
    "url": "https://www.doitforme.in",
    "logo": "https://www.doitforme.in/Doitforme_logo.png",
    "description": "DoItForMe is India's first verified student gig platform. Hustle lets students outsource & earn from tasks (coding, design, tutoring, errands).",
    "foundingDate": "2024",
    "areaServed": "IN",
    "sameAs": ["https://www.instagram.com/doitforme.in/", "https://www.linkedin.com/company/doitforme1/"],
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "DoItForMe Services",
      "itemListElement": [
        { "@type": "OfferCatalog", "name": "Hustle – Student Freelance Gigs", "description": "Post tasks like coding, design, tutoring, and errands. Verified student freelancers apply, work is escrow-protected." }
      ]
    }
  };

  return (
    <html lang="en" className="selection:bg-[#8825F5] selection:text-white" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-[#0B0B11] text-white antialiased relative overflow-x-hidden min-h-screen flex flex-col">

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        {/* Global Background Texture */}
        <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.03] mix-blend-overlay will-change-transform">
          <svg className="h-full w-full">
            <filter id="noise">
              <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" />
            </filter>
            <rect width="100%" height="100%" filter="url(#noise)" />
          </svg>
        </div>

        {/* Realtime Notification Listener */}
        <RealtimeListener />

        {/* Notification Manager */}
        <NotificationManager />

        {/* Sonner Toaster */}
        <Toaster position="top-center" toastOptions={{
          style: { background: '#1A1A24', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }
        }} />

        <main className="relative z-10 flex-1 flex flex-col w-full">
          {children}
        </main>
        <Analytics />

      </body>
    </html>
  );
}