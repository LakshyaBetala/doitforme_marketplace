
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Analytics } from '@vercel/analytics/next';
import { Toaster } from 'sonner';
import RealtimeListener from "@/components/RealtimeListener";
import NotificationManager from "@/components/NotificationManager";
import { SpeedInsights } from "@vercel/speed-insights/next"// Request notification permission

export const metadata: Metadata = {
  title: {
    default: "DoItForMe – India's Campus Freelance Network",
    template: "%s | DoItForMe",
  },
  description:
    "DoItForMe is India's campus freelance network. 700+ verified students earning by completing real tasks for peers and companies. Escrow-protected, instant UPI payouts.",
  keywords: [
    "DoItForMe", "doitforme.in", "student gig network India",
    "campus freelance India", "student freelance network India", "hire student hustlers",
    "hire university talent India", "student hustle economy", "college task outsourcing",
    "campus gig marketplace",
    "earn from skills student", "outsourced student work",
    "secure student marketplace", "technical gigs for students India",
    "college coding gigs", "student graphic design", "student content writing",
  ],
  authors: [{ name: "DoItForMe Team", url: "https://www.doitforme.in" }],
  creator: "DoItForMe",
  publisher: "DoItForMe",
  formatDetection: { email: false, address: false, telephone: false },
  icons: { icon: "/Doitforme_logo.png", shortcut: "/Doitforme_logo.png", apple: "/Doitforme_logo.png" },
  openGraph: {
    title: "DoItForMe – India's Campus Freelance Network",
    description:
      "700+ verified students. Real tasks. Instant UPI payouts. India's campus freelance network.",
    url: "https://www.doitforme.in",
    siteName: "DoItForMe",
    images: [{ url: "/Doitforme_logo.png", width: 1200, height: 630, alt: "DoItForMe – India's Campus Freelance Network" }],
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "DoItForMe – India's Campus Freelance Network",
    description:
      "700+ verified students earning by completing real tasks. Escrow-protected. Instant UPI payouts.",
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
    "description": "DoItForMe is India's campus freelance network. 700+ verified students earning by completing real tasks for peers and companies.",
    "foundingDate": "2024",
    "areaServed": "IN",
    "sameAs": ["https://www.instagram.com/doitforme.in/", "https://www.linkedin.com/company/doitforme1/"],
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "DoItForMe Solutions",
      "itemListElement": [
        { "@type": "OfferCatalog", "name": "Student Gigs", "description": "Technical and creative tasks including coding, design, and research. Secured by 3% Escrow protection." }
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