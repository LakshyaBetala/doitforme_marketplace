
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Analytics } from '@vercel/analytics/next';
import { Toaster } from 'sonner';
import RealtimeListener from "@/components/RealtimeListener"; // Helper component for client-side logic

export const metadata: Metadata = {
  title: "DoItForMe - Students Helping Students",
  description: "India’s first Gen-Z student marketplace. Outsource tasks. Earn from free time.",
  icons: { icon: "/sloth.png", shortcut: "/sloth.png", apple: "/sloth.png" },
  openGraph: { title: "DoItForMe", description: "Students Helping Students.", images: ["/sloth.png"], type: "website" },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://www.doitforme.in'),
  appleWebApp: { capable: true, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0B0B11",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "DoItForMe",
    "url": "https://www.doitforme.in",
    "logo": "https://www.doitforme.in/sloth.png",
    "sameAs": ["https://www.instagram.com/doitforme.in/", "https://www.linkedin.com/company/doitforme1/"]
  };

  return (
    <html lang="en" className="selection:bg-[#8825F5] selection:text-white">
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