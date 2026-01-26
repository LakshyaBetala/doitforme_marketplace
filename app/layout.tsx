import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DoItForMe - Students Helping Students",
  description:
    "India’s first Gen-Z student marketplace. Outsource tasks. Earn from free time.",
  
  // --- FIX 1: Explicit Icon Definitions ---
  // This forces devices to use YOUR logo instead of the default favicon.ico
  icons: {
    icon: "/logo.png",       // General favicon
    shortcut: "/logo.png",   // Shortcut icon
    apple: "/logo.png",      // Apple/iOS home screen icon
  },
  
  openGraph: {
    title: "DoItForMe",
    description: "Students Helping Students.",
    images: ["/logo.png"],
    type: "website",
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://www.doitforme.in'),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // --- FIX 2: Google Search "Organization" Schema ---
  // This tells Google: "Hey, this image is THE logo for this brand."
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "DoItForMe",
    "url": "https://www.doitforme.in",
    "logo": "https://www.doitforme.in/logo.png",
    "sameAs": [
      "https://www.instagram.com/doitforme.in/",
      "https://www.linkedin.com/company/doitforme1/"
    ]
  };

  return (
    <html lang="en">
      <body className="bg-[#0B0B11] text-white antialiased relative overflow-x-hidden selection:bg-[#8825F5] selection:text-white">
        
        {/* Inject JSON-LD for Google Search */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        {/* Global Background Texture */}
        <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.03] mix-blend-overlay">
           <svg className="h-full w-full">
             <filter id="noise">
               <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" />
             </filter>
             <rect width="100%" height="100%" filter="url(#noise)" />
           </svg>
        </div>

        <main className="relative z-10 min-h-screen flex flex-col">
          {children}
        </main>

      </body>
    </html>
  );
}