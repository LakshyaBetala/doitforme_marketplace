
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from 'sonner';
import RealtimeListener from "@/components/RealtimeListener";
import AttributionCapture from "@/components/AttributionCapture";
import NotificationManager from "@/components/NotificationManager";
// Request notification permission

export const metadata: Metadata = {
  title: {
    default: "DoItForMe – India's Campus Freelance Network",
    template: "%s | DoItForMe",
  },
  description:
    "DoItForMe is India's campus freelance network. 700+ verified students earning by completing real tasks for peers and companies. Payment held until you approve, instant UPI payouts.",
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
  icons: { icon: "/logo.png", shortcut: "/logo.png", apple: "/logo.png" },
  openGraph: {
    title: "DoItForMe – India's Campus Freelance Network",
    description:
      "700+ verified students. Real tasks. Instant UPI payouts. India's campus freelance network.",
    url: "https://www.doitforme.in",
    siteName: "DoItForMe",
    images: [{ url: "/logo.png", width: 1200, height: 630, alt: "DoItForMe – India's Campus Freelance Network" }],
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "DoItForMe – India's Campus Freelance Network",
    description:
      "700+ verified students earning by completing real tasks. Payment held until you approve. Instant UPI payouts.",
    images: ["/logo.png"],
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
    "logo": "https://www.doitforme.in/logo.png",
    "description": "DoItForMe is India's campus freelance network. 700+ verified students earning by completing real tasks for peers and companies.",
    "foundingDate": "2024",
    "areaServed": "IN",
    "founder": [
      { "@type": "Person", "name": "Lakshya Betala" },
      { "@type": "Person", "name": "Mouriyan Gandhi" }
    ],
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Zinda Sahib Street",
      "addressLocality": "Chennai",
      "addressRegion": "Tamil Nadu",
      "addressCountry": "IN"
    },
    // Support runs on email. The telephone line is declared here because a
    // payment aggregator's website check looks for a reachable business number
    // with stated hours — machine-readable, rather than merchandised to
    // students as a helpline. It is the same number shown on /contact.
    "contactPoint": [
      {
        "@type": "ContactPoint",
        "contactType": "customer support",
        "email": "doitforme.in@gmail.com",
        "availableLanguage": ["en", "ta", "hi"],
        "areaServed": "IN"
      },
      {
        "@type": "ContactPoint",
        "contactType": "billing support",
        "email": "gandhimouriyan1234@gmail.com",
        "telephone": "+91-93441-10272",
        "availableLanguage": ["en", "ta", "hi"],
        "areaServed": "IN",
        "hoursAvailable": {
          "@type": "OpeningHoursSpecification",
          "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
          "opens": "11:00",
          "closes": "17:00"
        }
      }
    ],
    "sameAs": ["https://www.instagram.com/doitforme.in/", "https://www.linkedin.com/company/doitforme1/"],
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "DoItForMe Solutions",
      "itemListElement": [
        { "@type": "OfferCatalog", "name": "Student Gigs", "description": "Technical and creative tasks including coding, design, and research. Payment is held until the work is delivered and approved." }
      ]
    }
  };

  return (
    <html lang="en" className="selection:bg-[#8825F5] selection:text-white" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
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

        {/* Speed Insights and Web Analytics are OFF.
            On Hobby they were the two worst overages — 63K/10K Speed Insights
            events and 56K/50K Web Analytics events — and neither serves a user.
            Re-mount both (and re-add the imports) after moving to a paid plan. */}

        {/* First-touch signup attribution (referrer / UTM -> localStorage) */}
        <AttributionCapture />

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

      </body>
    </html>
  );
}