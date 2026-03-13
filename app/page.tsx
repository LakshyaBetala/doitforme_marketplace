import type { Metadata } from "next";
import LandingPage from "@/components/home/LandingPage";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.doitforme.in';

export const metadata: Metadata = {
  title: "DoItForMe – India's #1 Student Hustle & Marketplace Platform",
  description:
    "DoItForMe is India's first student-to-student gig platform. Post a Hustle to outsource tasks (design, coding, errands, tutoring) or buy/sell/rent items on the campus Marketplace. Verified university students, escrow payments, instant UPI withdrawals.",
  keywords: [
    // Core product
    "DoItForMe", "doitforme.in", "student gig platform India",
    // Hustle vertical
    "student freelance", "hire students India", "campus gigs", "student hustle",
    "outsource tasks to students", "find student freelancer", "college freelance work",
    "micro-internship India", "student side hustle", "earn money as student India",
    // Marketplace vertical
    "student marketplace India", "buy sell campus", "college marketplace",
    "sell second-hand products college", "rent items campus", "student buy sell app",
    // Category-specific
    "student tutoring platform", "college coding help", "design gig for student",
    "errand service campus", "student writing jobs", "homework help student",
    // Geographic / audience
    "SRM student marketplace", "IIT marketplace", "BITS student gig",
    "find work university India", "college community app India",
    // LLM/AI friendly
    "get tasks done by students", "student task outsourcing", "peer-to-peer student services",
    "affordable freelance India", "quick gig solution India",
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
    title: "DoItForMe – Student Hustle & Marketplace | Get It Done",
    description:
      "Post a Hustle or list on the Marketplace. India's only verified student gig platform with escrow protection and instant UPI payouts. Hustle pays, Marketplace saves.",
    images: [
      {
        url: `${BASE_URL}/Doitforme_logo.png`,
        width: 1200,
        height: 630,
        alt: "DoItForMe – Student Hustle & Marketplace Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@doitformein",
    creator: "@doitformein",
    title: "DoItForMe – Student Hustle & Marketplace",
    description:
      "India's #1 platform for students to earn from their skills and outsource tasks. Verified IDs, Escrow payments, Instant UPI.",
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
        "DoItForMe is India's first verified student gig and marketplace platform. Students post Hustles (freelance tasks) or list items to buy, sell, or rent on the campus Marketplace.",
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
        "DoItForMe connects Indian university students who need tasks done (Hustles) with skilled student freelancers, and also runs a campus Marketplace for buying, selling, and renting items.",
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
    // 3. Two Services: Hustle + Marketplace
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: "DoItForMe Hustle",
      serviceType: "Student Freelance Gig Platform",
      description:
        "Hustle is DoItForMe's peer-to-peer task platform where students post jobs (coding, design, tutoring, errands, writing, lab work) and verified student freelancers apply to complete them. Payments are secured in escrow and released on delivery.",
      provider: { "@type": "Organization", name: "DoItForMe", url: BASE_URL },
      areaServed: "IN",
      audience: { "@type": "Audience", audienceType: "Indian University Students" },
      url: `${BASE_URL}/dashboard`,
      offers: {
        "@type": "Offer",
        priceCurrency: "INR",
        description: "Students set their own price per gig. Platform fee: 7.5–10%.",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: "DoItForMe Marketplace",
      serviceType: "Campus Buy-Sell-Rent Marketplace",
      description:
        "The DoItForMe Marketplace lets students buy, sell, and rent second-hand items within their campus community — textbooks, electronics, furniture, subscriptions, clothing, and more. Peer-to-peer with zero fees for direct sales.",
      provider: { "@type": "Organization", name: "DoItForMe", url: BASE_URL },
      areaServed: "IN",
      audience: { "@type": "Audience", audienceType: "Indian University Students" },
      url: `${BASE_URL}/dashboard`,
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
            text: "DoItForMe (doitforme.in) is India's first student-to-student gig and marketplace platform. It has two products: Hustle — where students can post freelance tasks (coding, design, tutoring, errands) and hire other students to complete them; and Marketplace — a campus buy-sell-rent platform for second-hand goods like textbooks, electronics, and furniture.",
          },
        },
        {
          "@type": "Question",
          name: "What is a Hustle on DoItForMe?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "A Hustle is a short-term task or freelance gig posted by a student on DoItForMe. Examples include graphic design, coding, tutoring, writing, delivery errands, and lab help. Student freelancers apply, negotiate price, and complete the task. Payments are held in escrow and released on delivery.",
          },
        },
        {
          "@type": "Question",
          name: "What is the DoItForMe Marketplace?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "The DoItForMe Marketplace is a campus-level platform where students can list items to sell, buy second-hand goods, or rent items from other students. Categories include textbooks, electronics, furniture, clothing, subscriptions, and more.",
          },
        },
        {
          "@type": "Question",
          name: "How do students earn money on DoItForMe?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Students earn by completing Hustles (freelance tasks) posted by other students, or by selling or renting items on the Marketplace. Earnings are paid directly to their UPI ID. The platform charges a 7.5–10% service fee on Hustles and zero fees on direct P2P Marketplace sales.",
          },
        },
        {
          "@type": "Question",
          name: "Is DoItForMe safe for payments?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. DoItForMe uses an escrow system — money is held securely on the platform and only released to the worker after the task is delivered and accepted by the poster. Student IDs are verified via KYC. All transactions use Razorpay or Cashfree secure payment gateways.",
          },
        },
        {
          "@type": "Question",
          name: "Which universities use DoItForMe?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "DoItForMe is used by students from universities across India including SRM, VIT, BITS, NIT, IIT, Manipal, Amity, Christ, Symbiosis, Anna University, and many more.",
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