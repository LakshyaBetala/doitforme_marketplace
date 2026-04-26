import type { Metadata } from "next";
import LandingPage from "@/components/home/LandingPage";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.doitforme.in';

export const metadata: Metadata = {
  title: "DoItForMe – India's Campus Freelance Network",
  description:
    "DoItForMe is India's campus freelance network. 700+ verified students earning by completing real tasks for peers and companies. Escrow-protected, instant UPI payouts.",
  keywords: [
    "DoItForMe", "doitforme.in", "campus freelance India",
    "student freelance network", "hire student talent India",
    "student gigs India", "campus gig platform",
    "earn from skills student", "student work India",
    "secure campus marketplace", "student freelance tasks",
    "college freelance India", "student earn UPI",
  ],
  authors: [{ name: "DoItForMe", url: BASE_URL }],
  creator: "DoItForMe",
  publisher: "DoItForMe",
  metadataBase: new URL(BASE_URL),
  alternates: { canonical: BASE_URL },
  icons: {
    icon: "/Doitforme_logo.png",
    apple: "/Doitforme_logo.png",
    shortcut: "/Doitforme_logo.png",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: BASE_URL,
    siteName: "DoItForMe",
    title: "DoItForMe – India's Campus Freelance Network",
    description:
      "700+ verified students. Real tasks. Instant UPI payouts. India's campus freelance network.",
    images: [
      {
        url: `${BASE_URL}/Doitforme_logo.png`,
        width: 1200,
        height: 630,
        alt: "DoItForMe – India's Campus Freelance Network",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@doitformein",
    creator: "@doitformein",
    title: "DoItForMe – India's Campus Freelance Network",
    description:
      "700+ verified students earning by completing real tasks. Escrow-protected. Instant UPI payouts. doitforme.in",
    images: [`${BASE_URL}/Doitforme_logo.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function Home() {
  const jsonLd = [
    // 1. WebSite with SearchAction (enables Google sitelinks search box)
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
       name: "DoItForMe",
      url: BASE_URL,
      description:
        "DoItForMe is India's campus freelance network. 700+ verified students completing real tasks for peers and companies.",
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${BASE_URL}/dashboard?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    // 2. Organization
    {
      "@context": "https://schema.org",
      "@type": "Organization",
       name: "DoItForMe",
      url: BASE_URL,
      logo: `${BASE_URL}/Doitforme_logo.png`,
      description:
        "DoItForMe is India's campus freelance network connecting verified students with peers and companies for real tasks.",
      foundingDate: "2025",
      areaServed: "IN",
      audience: { "@type": "Audience", audienceType: "University Students, India" },
      sameAs: [
        "https://www.instagram.com/doitforme.in/",
        "https://www.linkedin.com/company/doitforme1/",
      ],
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "doitforme.in@gmail.com",
        areaServed: "IN",
        availableLanguage: ["English", "Hindi"],
      },
    },
    // 3. Service: Hustle
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: "DoItForMe Hustle",
      serviceType: "Campus Freelance Platform",
      description:
        "DoItForMe is a secure ecosystem where Clients (Students and Companies) outsource gigs to verified student hustlers. Payments are held in a 3% protected escrow and released upon completion.",
      provider: { "@type": "Organization", name: "DoItForMe", url: BASE_URL },
      areaServed: "IN",
      audience: { "@type": "Audience", audienceType: "Students & Organizations" },
      url: `${BASE_URL}/dashboard`,
      offers: {
        "@type": "Offer",
        priceCurrency: "INR",
        description: "Free Direct Connect. Standard 3% escrow protection for secure gigs ₹500 and above.",
      },
    },
    // 4. FAQPage — helps LLMs and Google directly answer queries about DoItForMe
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is DoItForMe?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "DoItForMe (doitforme.in) is India's first student-to-student gig platform where students can post gigs (coding, design, tutoring, errands) and hire other students to complete them.",
          },
        },
        {
          "@type": "Question",
          name: "What is a Hustle on DoItForMe?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "A Hustle is a short-term task or gig posted by a student on DoItForMe. Examples include graphic design, coding, tutoring, writing, delivery errands, and lab help. Student hustlers apply, negotiate price, and complete the task. Payments are held in escrow and released on delivery.",
          },
        },
        {
          "@type": "Question",
          name: "How do students earn money on DoItForMe?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Students earn by completing technical tasks and gigs posted by other students or companies. Earnings are paid directly to their UPI ID. The platform is free to use with Direct Connect, while a 3% escrow fee applies for protected gigs ₹500 and above.",
          },
        },
        {
          "@type": "Question",
          name: "Is DoItForMe safe for gigs?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. DoItForMe uses a 3% protected escrow system — funds are held securely and only released to the hustler after the gig is delivered and accepted by the Client. All hustlers are student ID verified.",
          },
        },
        {
          "@type": "Question",
          name: "Which universities are on DoItForMe?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "DoItForMe is available for students across all major Indian universities including SRM, VIT, BITS, NITs, IITs, Manipal, and many more, fostering an inclusive gig economy.",
          },
        },
      ],
    },
  ];

  return (
    <>
      {jsonLd.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <LandingPage />
    </>
  );
}