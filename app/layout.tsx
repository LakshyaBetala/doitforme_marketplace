
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Analytics } from '@vercel/analytics/next';
import { Toaster } from 'sonner';
import RealtimeListener from "@/components/RealtimeListener";
import NotificationManager from "@/components/NotificationManager"; // Request notification permission

export const metadata: Metadata = {
  title: "DoItForMe - Students Helping Students",
  description: "India’s first Gen-Z student marketplace. Outsource tasks. Earn from free time.",
  keywords: [
    "student freelance", "gig economy", "university jobs", "campus tasks", "student marketplace",
    "college community", "freelance for students", "peer-to-peer services", "find freelance work"
  ],
  authors: [{ name: "DoItForMe Team", url: "https://www.doitforme.in" }],
  creator: "DoItForMe",
  publisher: "DoItForMe",
  formatDetection: { email: false, address: false, telephone: false },
  icons: { icon: "/Doitforme_logo.png", shortcut: "/Doitforme_logo.png", apple: "/Doitforme_logo.png" },
  openGraph: {
    title: "DoItForMe - Students Helping Students",
    description: "India’s first Gen-Z student marketplace. Outsource tasks. Earn from free time.",
    url: "https://www.doitforme.in",
    siteName: "DoItForMe",
    images: [{ url: "/Doitforme_logo.png", width: 800, height: 600, alt: "DoItForMe Logo" }],
    type: "website",
    locale: "en_IN"
  },
  twitter: {
    card: "summary_large_image",
    title: "DoItForMe - Students Helping Students",
    description: "India’s first Gen-Z student marketplace. Outsource tasks. Earn from free time.",
    images: ["/Doitforme_logo.png"],
    creator: "@doitforme" // Optional, adjust if real handle exists
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://www.doitforme.in'),
  appleWebApp: {
    capable: true,
    title: "DoItForMe",
    statusBarStyle: "black-translucent"
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-video-preview": -1, "max-image-preview": "large", "max-snippet": -1 }
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
    "sameAs": ["https://www.instagram.com/doitforme.in/", "https://www.linkedin.com/company/doitforme1/"]
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