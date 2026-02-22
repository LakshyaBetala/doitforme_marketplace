"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, CheckCircle2, ShieldCheck, Zap, Lock,
  DollarSign, ChevronDown, Quote, Star, Wallet, Code2, PenTool, Bike, Users, Mail, Clock,
  Linkedin, Instagram, Briefcase, ShoppingBag as ShoppingBagIcon
} from "lucide-react";

// -------------------------------------------------------
// 1. "VOGUE" PRELOADER (Updated with Asset Awareness)
// -------------------------------------------------------
const words = ["HUSTLE", "EARN", "BUILD", "SCALE", "RELAX"];

const Preloader = ({
  onComplete,
  isAssetReady
}: {
  onComplete: () => void,
  isAssetReady: boolean
}) => {
  const [index, setIndex] = useState(0);
  const [showLogo, setShowLogo] = useState(false);
  const [wordsFinished, setWordsFinished] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => {
        if (prev === words.length - 1) {
          clearInterval(interval);
          setShowLogo(true);
          setWordsFinished(true); // Signal that cycling is done
          return prev;
        }
        return prev + 1;
      });
    }, 200);
    return () => clearInterval(interval);
  }, []);

  // Final trigger: Only exit when words are done AND assets are ready
  useEffect(() => {
    if (wordsFinished && isAssetReady) {
      const timer = setTimeout(onComplete, 1000); // Brief pause on logo
      return () => clearTimeout(timer);
    }
  }, [wordsFinished, isAssetReady, onComplete]);

  return (
    <motion.div
      initial={{ y: 0 }}
      exit={{ y: "-100%", transition: { duration: 0.95, ease: [0.76, 0, 0.24, 1] } }}
      className="fixed inset-0 z-[9999] bg-[#020202] flex items-center justify-center overflow-hidden cursor-wait"
    >
      <AnimatePresence mode="wait">
        {!showLogo ? (
          <motion.h1
            key={index}
            initial={{ opacity: 0, scale: 1.2, filter: "blur(5px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.9, filter: "blur(5px)" }}
            transition={{ duration: 0.15 }}
            style={{ color: '#8825F5' }}
            className="text-6xl md:text-9xl font-black tracking-tighter"
          >
            {words[index]}
          </motion.h1>
        ) : (
          <motion.div
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: "circOut" }}
            className="relative flex flex-col items-center"
          >
            <h1 className="text-5xl md:text-8xl font-black text-white tracking-tighter">
              DoItForMe.
            </h1>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="h-1 bg-gradient-to-r from-brand-purple to-brand-blue mt-4 w-full shadow-[0_0_30px_rgba(136,37,245,0.8)]"
            />
            {/* Subtle indicator if assets are still fetching */}
            {!isAssetReady && (
              <p className="mt-4 text-[10px] text-zinc-600 uppercase tracking-widest animate-pulse">
                Loading Assets...
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// -------------------------------------------------------
// UTILITIES & DATA
// -------------------------------------------------------
const gigsMock = [
  {
    id: 1,
    user: "Aarav P.",
    role: "Engineering",
    title: "Fix Next.js Hydration Error",
    price: "₹500",
    gender: "male",
  },
  {
    id: 2,
    user: "Sneha K.",
    role: "Design",
    title: "Logo for Tech Fest Startup",
    price: "₹1,200",
    gender: "female",
  },
  {
    id: 3,
    user: "Rohan M.",
    role: "Errand",
    title: "Drop Lab Record to Block 4",
    price: "₹150",
    gender: "male",
  },
  {
    id: 4,
    user: "Priya S.",
    role: "Content",
    title: "Write Blog for College Newsletter",
    price: "₹800",
    gender: "female",
  },
  {
    id: 5,
    user: "Arjun D.",
    role: "Dev",
    title: "Build a Discord Bot for Server",
    price: "₹2,000",
    gender: "male",
  },
  {
    id: 6,
    user: "Meera R.",
    role: "Tutoring",
    title: "Teach DSA for Placement Prep",
    price: "₹600",
    gender: "female",
  },
];

const testimonials = [
  { role: "Poster", quote: "Got my assignment printed and delivered in 2 hours!", color: "#8825F5" },
  { role: "Worker", quote: "I made ₹2000 last weekend just helping with Figma designs.", color: "#3B82F6" },
  { role: "Student", quote: "The direct payment flow is so much better than other apps.", color: "#EC4899" },
  { role: "Dev", quote: "Found someone to debug my code instantly.", color: "#10B981" },
  { role: "Artist", quote: "Sold 3 custom sketches for a festival through this.", color: "#EAB308" }
];

const useScrollPosition = () => {
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  return scrollY;
};

// -------------------------------------------------------
// MAIN COMPONENT
// -------------------------------------------------------
export default function LandingPage() {
  const router = useRouter();
  const scrollY = useScrollPosition();

  // State
  const [faqTab, setFaqTab] = useState<"students" | "posters">("students");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [loadingComplete, setLoadingComplete] = useState(false);
  const [isSlothLoading, setIsSlothLoading] = useState(false);
  const [clickPos, setClickPos] = useState({ x: 0, y: 0 });
  const [activeGigIndex, setActiveGigIndex] = useState(0);

  // --- NEW: Preloader and Cooldown Logic ---
  const [isAssetReady, setIsAssetReady] = useState(false);
  const [shouldShowPreloader, setShouldShowPreloader] = useState(true);

  // 1. Session & Cooldown Check (5 mins)
  useEffect(() => {
    const LAST_PRELOAD_TIME = "dfm_last_preload";
    const ONE_HOUR = 2 * 60 * 1000;

    const lastSeen = localStorage.getItem(LAST_PRELOAD_TIME);
    const now = Date.now();

    if (lastSeen && (now - parseInt(lastSeen)) < ONE_HOUR) {
      setShouldShowPreloader(false);
      setLoadingComplete(true);
      setIsAssetReady(true);
    } else {
      localStorage.setItem(LAST_PRELOAD_TIME, now.toString());
    }
  }, []);

  // 2. Asset Preloading (Logo and Sloth)
  useEffect(() => {
    const criticalImages = ["/sloth.png", "/Doitforme_logo.png"];
    let loaded = 0;

    criticalImages.forEach((src) => {
      const img = new window.Image();
      img.src = src;
      img.onload = () => {
        loaded++;
        if (loaded === criticalImages.length) {
          setIsAssetReady(true);
        }
      };
      img.onerror = () => {
        loaded++;
        if (loaded === criticalImages.length) setIsAssetReady(true);
      };
    });
  }, []);

  const activeGig = gigsMock[activeGigIndex];

  // Cycle Gigs
  useEffect(() => {
    if (!loadingComplete) return;
    const interval = setInterval(() => {
      setActiveGigIndex((prev) => (prev + 1) % gigsMock.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [loadingComplete]);

  // Mouse Spotlight
  const mousePos = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
      document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
      document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) element.scrollIntoView({ behavior: "smooth" });
  };

  const toggleFAQ = (i: number) => {
    setOpenFaq(openFaq === i ? null : i);
  };

  const handleLogin = (e: React.MouseEvent) => {
    e.preventDefault();
    setClickPos({ x: e.clientX, y: e.clientY });
    setIsSlothLoading(true);
    setTimeout(() => router.push("/login"), 1200);
  };

  return (
    <div className="min-h-screen bg-[#020202] text-white overflow-x-hidden relative selection:bg-brand-purple selection:text-white font-sans touch-manipulation">

      {/* 1. CURTAIN REVEAL (Updated Logic) */}
      <AnimatePresence>
        {shouldShowPreloader && !loadingComplete && (
          <Preloader
            isAssetReady={isAssetReady}
            onComplete={() => setLoadingComplete(true)}
          />
        )}
      </AnimatePresence>

      {/* 2. SLOTH LOADING */}
      {isSlothLoading && (
        <div
          className="fixed z-[10000] pointer-events-none will-change-transform"
          style={{
            left: clickPos.x,
            top: clickPos.y,
            transform: 'translate(-50%, -20%) translateZ(0)'
          }}
        >
          <div className="relative w-16 h-16 origin-[top_center] animate-[spin_0.4s_linear_infinite]">
            <Image
              src="/sloth.png"
              alt="Loading..."
              fill
              className="object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
            />
          </div>
        </div>
      )}

      {/* --- ATMOSPHERE: LIGHTER BLUE & DEEP PURPLE --- */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.1, 0.15, 0.1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[10%] -left-[10%] w-[60vw] h-[60vw] bg-[#8825F5] rounded-full blur-[150px] opacity-10 will-change-transform"
          style={{ transform: 'translateZ(0)' }}
        />
        <motion.div
          animate={{ scale: [1, 1.25, 1], opacity: [0.08, 0.12, 0.08] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute top-[10%] right-[-10%] w-[50vw] h-[50vw] bg-[#93C5FD] rounded-full blur-[180px] opacity-10 will-change-transform"
          style={{ transform: 'translateZ(0)' }}
        />
      </div>

      {/* MOUSE SPOTLIGHT */}
      <div
        className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-700 mix-blend-overlay"
        style={{
          background: `radial-gradient(600px at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255, 255, 255, 0.03), transparent 80%)`
        }}
      />

      {/* NAVBAR */}
      <header className="fixed z-50 w-full top-0 left-0 transition-all duration-500">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 md:h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 md:gap-3 group">
            <div className="relative w-14 h-14 md:w-20 md:h-20 transition-transform duration-500 group-hover:rotate-12">
              <Image src="/Doitforme_logo.png" alt="logo" fill className="object-contain" />
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-3">
            <button onClick={() => scrollToSection('how-it-works')} className="text-sm font-medium text-white/60 hover:text-white transition-colors px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm hover:bg-white/10">How it works</button>
            <button onClick={() => scrollToSection('faq')} className="text-sm font-medium text-white/60 hover:text-white transition-colors px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm hover:bg-white/10">FAQ</button>
            <Link href="/contact" className="text-sm font-medium text-white/60 hover:text-white transition-colors px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm hover:bg-white/10">Support</Link>
          </nav>

          <button onClick={handleLogin} className="px-5 md:px-6 py-2 md:py-2.5 rounded-full text-xs font-bold text-black bg-white hover:bg-zinc-200 transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-95">
            Login
          </button>
        </div>
      </header>

      {/* -------------------------------------------------------
          HERO SECTION
      --------------------------------------------------------- */}
      <section className="relative z-10 min-h-[90vh] overflow-hidden">
        {/* Hero Background Glow */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-[#8825F5]/15 rounded-full blur-[150px]" />
          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#8825F5]/30 to-transparent" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 lg:px-12 pt-24 md:pt-28 pb-16 md:pb-20 grid lg:grid-cols-2 gap-8 md:gap-12 items-center">

          {/* LEFT: CONTENT */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={loadingComplete ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-center lg:text-left flex flex-col items-center lg:items-start relative z-20"
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 w-fit mb-8 md:mb-10 backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#EC4899] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#EC4899]"></span>
              </span>
              <span className="text-[10px] font-bold tracking-[0.2em] text-zinc-300 uppercase">Live • Verified Student Marketplace</span>
            </div>

            {/* Heading */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight text-white mb-2 w-full">
              Earn. Outsource.
            </h1>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight text-white mb-4 w-full">
              Trade.
            </h1>

            {/* Subheading */}
            <p className="text-xl md:text-2xl text-white/90 leading-snug mb-4 w-full">
              All in One <span className="font-bold">Campus Marketplace</span>
            </p>

            {/* Description */}
            <p className="text-sm md:text-base text-zinc-400 leading-relaxed max-w-md mb-8 md:mb-10 px-2 md:px-0">
              The student economy, built for campus life.<br />
              Earn money, outsource tasks, and trade items securely.
            </p>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto px-2 md:px-0">
              <button
                onClick={handleLogin}
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl text-sm font-bold border-2 border-white/20 text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2 active:scale-95 backdrop-blur-sm"
              >
                Explore Campus <ArrowRight size={16} />
              </button>
              <button
                onClick={() => scrollToSection('how-it-works')}
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl text-sm font-bold border-2 border-white/10 text-white/80 hover:text-white hover:border-white/20 transition-all flex items-center justify-center gap-2.5 active:scale-95"
              >
                <div className="w-6 h-6 rounded-full border border-white/30 flex items-center justify-center">
                  <div className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[7px] border-l-white/80 ml-0.5" />
                </div>
                How it works
              </button>
            </div>
          </motion.div>

          {/* RIGHT: SLOTH MASCOT + FLOATING CARDS */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={loadingComplete ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative hidden lg:flex items-center justify-center h-[580px] w-full -ml-24"
          >
            {/* Multi-layer purple glow */}
            <div className="absolute top-1/2 left-[45%] -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-[#8825F5]/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute top-1/2 left-[45%] -translate-x-1/2 -translate-y-1/2 w-[380px] h-[380px] bg-[#8825F5]/20 rounded-full blur-[80px] pointer-events-none" />
            <div className="absolute top-[55%] left-[45%] -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] bg-[#A855F7]/25 rounded-full blur-[60px] pointer-events-none" />
            <div className="absolute bottom-[60px] left-[40%] -translate-x-1/2 w-[300px] h-[80px] bg-[#8825F5]/15 rounded-full blur-[40px] pointer-events-none" />

            {/* Sparkle particles */}
            <div className="absolute top-[15%] left-[30%] w-1.5 h-1.5 bg-white/40 rounded-full animate-pulse pointer-events-none" />
            <div className="absolute top-[25%] right-[15%] w-1 h-1 bg-white/30 rounded-full animate-pulse pointer-events-none" style={{ animationDelay: '0.5s' }} />
            <div className="absolute bottom-[30%] left-[20%] w-1 h-1 bg-[#A855F7]/50 rounded-full animate-pulse pointer-events-none" style={{ animationDelay: '1s' }} />
            <div className="absolute top-[40%] right-[30%] w-1.5 h-1.5 bg-white/20 rounded-full animate-pulse pointer-events-none" style={{ animationDelay: '1.5s' }} />

            {/* Sloth Mascot */}
            <motion.div
              className="relative z-30"
              style={{ animation: "breathe 4s ease-in-out infinite" }}
              initial={{ opacity: 0, y: 20 }}
              animate={loadingComplete ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              <Image
                src="/hisloth.png"
                alt="Sloth mascot"
                width={440}
                height={440}
                className="object-contain"
                style={{
                  filter: 'drop-shadow(0 0 30px rgba(136, 37, 245, 0.35)) drop-shadow(0 0 60px rgba(136, 37, 245, 0.2)) drop-shadow(0 25px 50px rgba(0, 0, 0, 0.4))'
                }}
                priority
              />
            </motion.div>

            {/* Floating: Revolving Gig Card (Top Right) */}
            <div className="absolute top-[30px] -right-2 z-40">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeGigIndex}
                  initial={{ opacity: 0, y: 15, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -15, scale: 0.95 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="will-change-transform"
                >
                  <div
                    className="relative p-4 rounded-2xl w-[190px]"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255,255,255,0.18)',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
                    }}
                  >
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <div className="w-9 h-9 rounded-full overflow-hidden shadow-md ring-1 ring-white/20">
                        <img
                          src={`https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(activeGig.user + (activeGig.gender === 'male' ? ' boy' : ' girl'))}`}
                          alt={activeGig.user}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="text-sm font-bold text-white">{activeGig.user}</span>
                    </div>
                    <p className="text-[11px] text-white/60 font-medium leading-snug mb-2.5">{activeGig.title}</p>
                    <div className="text-right">
                      <span className="text-lg font-bold text-[#C084FC]">{activeGig.price}</span>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Floating: Funds Released */}
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute bottom-[140px] -right-4 z-50 will-change-transform"
            >
              <div
                className="flex items-center gap-3 px-5 py-3.5 rounded-2xl"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
                }}
              >
                <div className="p-1.5 bg-green-500/20 rounded-full">
                  <CheckCircle2 size={22} className="text-green-400" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Funds</div>
                  <div className="text-sm font-bold text-white">Released</div>
                </div>
              </div>
            </motion.div>

            {/* Floating: Total Earnings */}
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2 }}
              className="absolute bottom-[50px] right-[15px] z-40 will-change-transform"
            >
              <div
                className="px-6 py-4 rounded-2xl"
                style={{
                  background: 'linear-gradient(135deg, rgba(30, 20, 60, 0.8) 0%, rgba(20, 15, 40, 0.9) 100%)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(136, 37, 245, 0.25)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px rgba(136, 37, 245, 0.1), inset 0 1px 0 rgba(255,255,255,0.05)'
                }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]"></span>
                  <span className="text-xs font-medium text-white/50">Total Earnings</span>
                </div>
                <div className="text-3xl font-bold text-white">₹12,450</div>
              </div>
            </motion.div>
          </motion.div>

          {/* MOBILE: Sloth + Cards stacked */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={loadingComplete ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="lg:hidden flex flex-col items-center relative"
          >
            <div className="relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] bg-[#8825F5]/20 rounded-full blur-[80px] pointer-events-none" />
              <Image
                src="/hisloth.png"
                alt="Sloth mascot"
                width={280}
                height={280}
                className="object-contain drop-shadow-[0_15px_40px_rgba(136,37,245,0.4)] relative z-10"
                priority
              />
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-6">
              <div className="bg-white/95 text-black px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-xs font-bold">
                <CheckCircle2 size={14} className="text-green-600" /> Funds Released
              </div>
              <div className="bg-[#1A1A2E]/90 border border-white/10 px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span> ₹12,450 Earned
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* -------------------------------------------------------
          SECTION 2: EVERYTHING YOU NEED
      --------------------------------------------------------- */}
      <section className="relative z-10 overflow-hidden pt-16 md:pt-24 pb-8 md:pb-12 border-y border-white/5 bg-[#050505]">
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] bg-[#8825F5]/8 rounded-full blur-[160px]" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6">

          {/* Heading */}
          <div className="text-center mb-10 md:mb-14">
            <h2 className="text-[1.75rem] sm:text-4xl md:text-[2.75rem] lg:text-5xl xl:text-6xl lg:whitespace-nowrap font-black italic leading-[1.1] tracking-tight text-white mb-4 md:mb-5">
              Everything you need. Inside <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/80">your campus.</span>
            </h2>
            <p className="text-sm md:text-base lg:text-lg text-zinc-400 max-w-lg mx-auto">
              Earn money, outsource tasks, and trade items effortlessly.
            </p>
          </div>

          {/* Three Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 mb-10 md:mb-14">
            {/* Card 1: Earn Money */}
            <div
              className="relative rounded-2xl p-5 pb-6 overflow-hidden group"
              style={{
                background: 'linear-gradient(160deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
              }}
            >
              <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-[#8825F5]/10 rounded-full blur-[80px] pointer-events-none" />
              <div className="relative h-[240px] md:h-[280px] mb-4 flex items-center justify-center overflow-visible">
                <Image
                  src="/moneysloth.png"
                  alt="Earn Money Sloth"
                  width={280}
                  height={280}
                  className="object-contain relative z-10"
                  style={{ filter: 'drop-shadow(0 0 20px rgba(136, 37, 245, 0.2)) drop-shadow(0 15px 30px rgba(0, 0, 0, 0.3))' }}
                />
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute top-4 right-2 z-20"
                >
                  <div
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white"
                    style={{
                      background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.3) 0%, rgba(34, 197, 94, 0.1) 100%)',
                      backdropFilter: 'blur(12px)',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                    }}
                  >
                    <span className="text-green-400">₹</span>450 earned
                  </div>
                </motion.div>
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-white mb-2">Earn Money</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">Complete small campus tasks and get paid instantly.</p>
            </div>

            {/* Card 2: Outsource Tasks */}
            <div
              className="relative rounded-2xl p-5 pb-6 overflow-hidden group"
              style={{
                background: 'linear-gradient(160deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
              }}
            >
              <div className="absolute top-0 left-0 w-[200px] h-[200px] bg-[#6D28D9]/10 rounded-full blur-[80px] pointer-events-none" />
              <div className="relative h-[240px] md:h-[280px] mb-4 flex items-center justify-center overflow-visible">
                <Image
                  src="/tasksloth.png"
                  alt="Outsource Tasks Sloth"
                  width={280}
                  height={280}
                  className="object-contain relative z-10"
                  style={{ filter: 'drop-shadow(0 0 20px rgba(136, 37, 245, 0.2)) drop-shadow(0 15px 30px rgba(0, 0, 0, 0.3))' }}
                />
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                  className="absolute top-2 right-0 z-20"
                >
                  <div
                    className="px-3 py-2 rounded-xl text-[10px]"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.75) 100%)',
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
                    }}
                  >
                    <div className="flex items-center gap-1 text-zinc-600 font-medium mb-0.5">
                      <ArrowRight size={8} className="rotate-[-45deg]" /> Deliver assignment
                    </div>
                    <div className="text-right text-sm font-bold text-[#8825F5]">₹150</div>
                  </div>
                </motion.div>
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-white mb-2">Outsource Tasks</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">Get your work done quickly by trusted students.</p>
            </div>

            {/* Card 3: Buy & Sell */}
            <div
              className="relative rounded-2xl p-5 pb-6 overflow-hidden group"
              style={{
                background: 'linear-gradient(160deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
              }}
            >
              <div className="absolute bottom-0 right-0 w-[200px] h-[200px] bg-[#8825F5]/10 rounded-full blur-[80px] pointer-events-none" />
              <div className="relative h-[240px] md:h-[280px] mb-4 flex items-center justify-center overflow-visible">
                <Image
                  src="/marketsloth.png"
                  alt="Buy and Sell Sloth"
                  width={280}
                  height={280}
                  className="object-contain relative z-10"
                  style={{ filter: 'drop-shadow(0 0 20px rgba(136, 37, 245, 0.2)) drop-shadow(0 15px 30px rgba(0, 0, 0, 0.3))' }}
                />
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-white mb-2">Buy & Sell</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">Trade items easily within your campus.</p>
            </div>
          </div>

          {/* Bottom Earnings Ticker */}
          <div className="flex justify-center">
            <div
              className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
              }}
            >
              <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-[#8825F5]/30">
                <Image src="/Doitforme_logo.png" alt="Avatar" width={32} height={32} className="object-cover" />
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeGigIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                  className="text-sm text-white"
                >
                  <span className="font-bold">{activeGig.user.split('.')[0]}</span>
                  <span className="text-zinc-400"> earned </span>
                  <span className="font-bold text-[#C084FC]">{activeGig.price}</span>
                  <span className="text-zinc-400"> this week</span>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

        </div>
      </section>

      {/* -------------------------------------------------------
          SECTION 3: LIVE CAMPUS FEED
      --------------------------------------------------------- */}
      <section className="pt-8 pb-20 md:pt-12 md:pb-32 bg-[#050505] relative z-10 border-y border-white/5 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">

          {/* LEFT: Static Content */}
          <div className="relative z-20">
            {/* Small Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#8825F5]/30 bg-[#8825F5]/10 mb-6 w-fit">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-[pulse_2s_infinite]"></span>
              <span className="text-[10px] font-bold tracking-widest text-[#C084FC] uppercase">Live on your campus</span>
            </div>

            {/* Headline */}
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight text-white mb-6">
              See what’s happening right now.
            </h2>

            {/* Supporting Text */}
            <p className="text-base md:text-lg text-zinc-400 leading-relaxed mb-8 max-w-md">
              Browse real tasks and marketplace listings from your campus.
            </p>

            {/* CTA Button */}
            <button
              onClick={handleLogin}
              className="w-full sm:w-auto px-8 py-4 rounded-xl text-sm font-bold bg-white text-black hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
            >
              Explore Campus <ArrowRight size={18} />
            </button>
          </div>

          {/* RIGHT: Live Feed Panel & Sloth */}
          <div className="relative h-[550px] w-full flex items-center justify-center lg:justify-end">

            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[#8825F5]/15 rounded-full blur-[100px] pointer-events-none"></div>

            {/* Sloth beside feed */}
            <div className="absolute top-[60%] lg:top-[50%] -left-10 lg:-left-20 -translate-y-1/2 z-30 hidden md:block">
              <Image
                src="/sloth_v2.png"
                alt="Confident Sloth"
                width={200}
                height={200}
                className="object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
              />
            </div>

            {/* Feed Container */}
            <div className="relative w-full max-w-[420px] h-[500px] rounded-3xl border border-white/10 bg-[#0A0A0E]/80 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col z-20">

              {/* Header */}
              <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between z-20 relative">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white uppercase tracking-wider">Live Feed</span>
                </div>
                <span className="text-[10px] text-green-400 font-bold bg-green-400/10 px-2.5 py-1.5 rounded-md border border-green-400/20 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Auto-updating
                </span>
              </div>

              {/* Feed Items (Auto-scroll animation) */}
              <div className="flex-1 overflow-hidden relative cursor-pointer group" onClick={handleLogin}>
                {/* Blur Overlay - Bottom Half */}
                <div className="absolute inset-x-0 bottom-0 h-[280px] bg-gradient-to-t from-[#0A0A0E] via-[#0A0A0E]/95 to-transparent backdrop-blur-[2px] flex flex-col items-center justify-end pb-10 z-20 group-hover:via-[#0A0A0E]/90 transition-all">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10 backdrop-blur-sm group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(136,37,245,0.2)]">
                      <Lock size={20} className="text-[#C084FC]" />
                    </div>
                    <span className="text-sm font-bold text-white max-w-[200px] text-center drop-shadow-md">
                      Login to access campus marketplace
                    </span>
                  </div>
                </div>

                <div className="p-4" style={{ height: '200%' }}>
                  <motion.div
                    animate={{ y: ["0%", "-50%"] }}
                    transition={{ repeat: Infinity, ease: "linear", duration: 30 }}
                    className="flex flex-col gap-3"
                  >
                    {[
                      { title: "Logo Design Needed", price: "₹800", category: "Freelance", time: "2 min ago" },
                      { title: "Calculator for Sale", price: "₹450", category: "Marketplace", time: "5 min ago" },
                      { title: "Drop Lab Record", price: "₹150", category: "Errand", time: "12 min ago" },
                      { title: "Engineering Drawing Sheet", price: "₹50", category: "Marketplace", time: "18 min ago" },
                      { title: "Need help with Python Assignment", price: "₹500", category: "Freelance", time: "24 min ago" },
                    ].map((item, i) => (
                      <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-2 relative overflow-hidden">
                        <div className="flex justify-between items-start gap-4">
                          <h4 className="text-sm font-bold text-white leading-tight flex-1">{item.title}</h4>
                          <span className="text-sm font-bold text-[#C084FC] whitespace-nowrap">{item.price}</span>
                        </div>
                        <div className="flex justify-between items-end mt-2">
                          <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded bg-[#8825F5]/20 text-[#C084FC] border border-[#8825F5]/30">
                            {item.category}
                          </span>
                          <span className="text-[11px] text-zinc-500 font-medium">{item.time}</span>
                        </div>
                      </div>
                    ))}
                    {/* Duplicate list to create seamless scrolling */}
                    {[
                      { title: "Logo Design Needed", price: "₹800", category: "Freelance", time: "2 min ago" },
                      { title: "Calculator for Sale", price: "₹450", category: "Marketplace", time: "5 min ago" },
                      { title: "Drop Lab Record", price: "₹150", category: "Errand", time: "12 min ago" },
                      { title: "Engineering Drawing Sheet", price: "₹50", category: "Marketplace", time: "18 min ago" },
                      { title: "Need help with Python Assignment", price: "₹500", category: "Freelance", time: "24 min ago" },
                    ].map((item, i) => (
                      <div key={`dup-${i}`} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-2 relative overflow-hidden">
                        <div className="flex justify-between items-start gap-4">
                          <h4 className="text-sm font-bold text-white leading-tight flex-1">{item.title}</h4>
                          <span className="text-sm font-bold text-[#C084FC] whitespace-nowrap">{item.price}</span>
                        </div>
                        <div className="flex justify-between items-end mt-2">
                          <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded bg-[#8825F5]/20 text-[#C084FC] border border-[#8825F5]/30">
                            {item.category}
                          </span>
                          <span className="text-[11px] text-zinc-500 font-medium">{item.time}</span>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* TICKER */}
      <div className="w-full bg-white border-y border-zinc-200 py-3 md:py-4 mb-16 md:mb-24 overflow-hidden relative z-10">
        <div className="absolute inset-y-0 left-0 w-16 md:w-32 bg-gradient-to-r from-background to-transparent z-10"></div>
        <div className="absolute inset-y-0 right-0 w-16 md:w-32 bg-gradient-to-l from-background to-transparent z-10"></div>
        <div className="animate-marquee whitespace-nowrap flex gap-10">
          {[...Array(12)].map((_, i) => (
            <span key={i} className="text-base md:text-lg font-bold text-black uppercase tracking-widest mx-4 flex items-center gap-4">
              ASSIGNMENTS <span className="text-zinc-300">•</span>
              RENTALS <span className="text-zinc-300">•</span>
              PROJECTS <span className="text-zinc-300">•</span>
              CASH <span className="text-zinc-300">•</span>
              SKILLS <span className="text-zinc-300">•</span>
            </span>
          ))}
        </div>
      </div>

      {/* -------------------------------------------------------
          THE ESSENTIALS (4 Titles Grid)
      --------------------------------------------------------- */}
      <section className="max-w-7xl mx-auto px-6 mb-12 md:mb-20 relative z-10">
        <div className="mb-12 text-center md:text-left">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Why DoItForMe?</h2>
          <p className="text-zinc-500 text-sm md:text-base">Built for speed, trust, and student life.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {[
            { title: "Zero Friction", desc: "No CVs. No Interviews. Just apply and get to work.", icon: Zap },
            { title: "Student Verified", desc: "Real students from verified colleges. No bots.", icon: Users },
            { title: "Payouts in 24h", desc: "Money sent to your UPI within 24 hours of job completion.", icon: Clock },
            { title: "24/7 Email Support", desc: "Dedicated email assistance for any dispute or issue.", icon: Mail }
          ].map((item, i) => (
            <div key={i} className="p-6 rounded-2xl bg-[#0A0A0A] border border-white/10 hover:border-brand-purple/50 transition-colors group active:scale-95 touch-manipulation">
              <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform">
                <item.icon size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------
          SECTION 4: TRANSPARENCY & PRICING
      --------------------------------------------------------- */}
      <section id="transparency" className="pt-12 pb-20 md:pt-16 md:pb-32 bg-[#050505] relative z-10 overflow-hidden">
        {/* Subtle Background Glows */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#8825F5]/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#6D28D9]/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-6xl mx-auto px-6">
          {/* Header */}
          <div className="text-center mb-16 relative z-20">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white mb-4">
              Simple. Transparent. <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C084FC] to-[#8825F5]">Student-Friendly.</span>
            </h2>
            <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto">
              You keep what you earn. No hidden fees.
            </p>
          </div>

          {/* 2 Column Cards: Services & Marketplace */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 mb-16">

            {/* Card 1: Services */}
            <div className="relative rounded-3xl p-8 lg:p-10 border border-white/10 bg-[#0A0A0A] overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-[#8825F5]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10 flex flex-col h-full">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">Services <span className="text-[#C084FC]">(Hustle)</span></h3>
                    <p className="text-zinc-400 font-medium">Earn by doing tasks</p>
                  </div>
                  {/* Small assisting sloth */}
                  <div className="-mt-8 -mr-4 md:-mr-6 shrink-0 relative z-20">
                    <Image src="/moneysloth.png" alt="Earn Sloth" width={140} height={140} className="object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]" />
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={18} className="text-green-500" />
                    <span className="text-white font-medium">Post tasks → <span className="text-green-400">Free</span></span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={18} className="text-green-500" />
                    <span className="text-white font-medium">Complete tasks → Small service fee</span>
                  </div>
                </div>

                {/* Fee Ladder */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-8">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm text-zinc-400">First 10 jobs</span>
                    <span className="font-bold text-white bg-white/10 px-3 py-1 rounded-full text-sm">10% fee</span>
                  </div>
                  <div className="w-full h-px bg-white/5 mb-3" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#C084FC] font-medium flex items-center gap-1"><Star size={14} className="fill-[#C084FC]" /> After 10 jobs</span>
                    <span className="font-bold text-[#C084FC] bg-[#C084FC]/10 border border-[#C084FC]/20 px-3 py-1 rounded-full text-sm">7.5% fee</span>
                  </div>
                </div>

                <div className="mt-auto bg-[#8825F5]/10 border border-[#8825F5]/20 rounded-xl py-3 px-4 text-center">
                  <span className="text-sm font-bold text-[#C084FC]">We only earn when you earn.</span>
                </div>
              </div>
            </div>

            {/* Card 2: Marketplace */}
            <div className="relative rounded-3xl p-8 lg:p-10 border border-white/10 bg-[#0A0A0A] overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-bl from-[#EC4899]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10 flex flex-col h-full">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">Marketplace</h3>
                    <p className="text-zinc-400 font-medium">Buy and Sell Freely</p>
                  </div>
                  {/* Small assisting sloth */}
                  <div className="-mt-8 -mr-4 md:-mr-6 shrink-0 relative z-20">
                    <Image src="/marketsloth.png" alt="Marketplace Sloth" width={140} height={140} className="object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]" />
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={18} className="text-green-500" />
                    <span className="text-white font-medium flex-1">Sell items → <span className="text-green-400 font-bold px-2 py-0.5 rounded bg-green-500/10 border border-green-500/20">0% fee</span></span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={18} className="text-green-500" />
                    <span className="text-white font-medium">Keep 100% of what you sell</span>
                  </div>
                </div>

                {/* Rental Fee block */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-8">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-300 font-medium">Rent out items</span>
                    <span className="font-bold text-white bg-white/10 px-3 py-1 rounded-full text-sm">3% escrow fee</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-2">Covers holding deposits and securing rentals securely.</p>
                </div>

                <div className="mt-auto bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-center">
                  <span className="text-sm font-bold text-white">No commission. No hidden charges.</span>
                </div>
              </div>
            </div>

          </div>

          {/* Pricing Examples */}
          <div className="mb-16">
            <h3 className="text-center font-mono text-zinc-500 uppercase tracking-widest text-sm mb-6">Real Examples</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
              {/* Example 1 - Sell Book */}
              <div className="bg-[#121212] border border-white/10 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-green-500" />
                <div className="flex justify-between items-end mb-4">
                  <div>
                    <h4 className="text-white font-bold mb-1">Sell Book</h4>
                    <span className="text-2xl font-black text-white">₹500</span>
                  </div>
                </div>
                <div className="space-y-2 pt-4 border-t border-white/10">
                  <div className="flex justify-between">
                    <span className="text-zinc-500 text-sm">Platform fee</span>
                    <span className="text-white text-sm font-medium">₹0</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-300 font-medium">You receive</span>
                    <span className="text-green-400 font-bold bg-green-500/10 px-2 py-1 rounded">₹500</span>
                  </div>
                </div>
              </div>

              {/* Example 2 - Complete Task */}
              <div className="bg-[#121212] border border-white/10 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#8825F5]" />
                <div className="flex justify-between items-end mb-4">
                  <div>
                    <h4 className="text-white font-bold mb-1">Complete Task</h4>
                    <span className="text-2xl font-black text-white">₹500</span>
                  </div>
                </div>
                <div className="space-y-2 pt-4 border-t border-white/10">
                  <div className="flex justify-between">
                    <span className="text-zinc-500 text-sm">Platform fee (10%)</span>
                    <span className="text-red-400 text-sm">-₹50</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-300 font-medium">You receive</span>
                    <span className="text-[#C084FC] font-bold bg-[#8825F5]/20 px-2 py-1 rounded">₹450</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trust Strip */}
          <div className="border-y border-white/10 py-6 overflow-hidden">
            <div className="flex flex-wrap justify-center md:justify-between items-center gap-6 md:gap-4 max-w-5xl mx-auto">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-white/5"><ShieldCheck size={20} className="text-blue-400" /></div>
                <span className="text-sm font-bold text-white uppercase tracking-wider">Escrow Protected</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-white/5"><Lock size={20} className="text-pink-400" /></div>
                <span className="text-sm font-bold text-white uppercase tracking-wider">Campus Only</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-white/5"><DollarSign size={20} className="text-green-400" /></div>
                <span className="text-sm font-bold text-white uppercase tracking-wider">Transparent Fees</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-white/5"><CheckCircle2 size={20} className="text-brand-purple" /></div>
                <span className="text-sm font-bold text-white uppercase tracking-wider">No Hidden Charges</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="pt-12 pb-16 md:pt-16 md:pb-24 bg-[#0A0A0A] border-y border-white/5 relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-12 text-center">Simple Flow</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8 relative">
            {/* THE PURPLE ANIMATED LINE */}
            <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-[2px] bg-white/5 rounded-full overflow-hidden">
              <motion.div
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                className="w-1/2 h-full bg-gradient-to-r from-transparent via-brand-purple to-transparent"
              />
            </div>

            {[
              { step: "01", title: "Create Account", desc: "Sign up and upload your Student ID for verification." },
              { step: "02", title: "Post or Apply", desc: "Posters pay into safe Escrow. Workers apply to tasks." },
              { step: "03", title: "Release Funds", desc: "Work approved? Funds are released directly to the worker." }
            ].map((item, i) => (
              <div key={i} className="relative z-10 flex flex-col items-center text-center">
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-background border border-white/10 flex items-center justify-center text-lg md:text-xl font-bold text-white mb-6 shadow-xl z-20">{item.step}</div>
                <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                <p className="text-zinc-400 max-w-xs text-sm md:text-base">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------
          STUDENT STORIES (Revolving + Minimalist Border)
      --------------------------------------------------------- */}
      <section className="py-16 md:py-24 overflow-hidden relative z-10">
        <div className="max-w-6xl mx-auto px-6 mb-12 flex items-center gap-4">
          <div className="h-px bg-zinc-800 flex-1"></div>
          <h2 className="text-xl md:text-2xl font-bold text-white text-center">Student Stories</h2>
          <div className="h-px bg-zinc-800 flex-1"></div>
        </div>

        {/* Infinite Marquee */}
        <div className="w-full overflow-hidden">
          <div className="flex animate-marquee gap-4 md:gap-6 px-4 md:px-6">
            {[...testimonials, ...testimonials].map((t, i) => (
              <div key={i} className={`flex-shrink-0 w-[280px] md:w-[320px] bg-[#0A0A0A] border-l-2 p-6 rounded-r-xl border-y border-r border-white/5 will-change-transform`} style={{ borderLeftColor: t.color }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-white/5 rounded-full"><Quote size={12} className="text-zinc-400" /></div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{t.role}</span>
                </div>
                <p className="text-zinc-300 text-xs md:text-sm leading-relaxed">"{t.quote}"</p>
                <div className="mt-4 flex gap-1">
                  {[...Array(5)].map((_, j) => <Star key={j} size={10} className="fill-zinc-700 text-zinc-700" />)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ (Restored 4 items) */}
      <section id="faq" className="py-16 md:py-24 max-w-4xl mx-auto px-6 relative z-10">
        <div className="text-center mb-10 md:mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">Common Questions</h2>
          <div className="inline-flex bg-white/5 rounded-full p-1 border border-white/10">
            <button onClick={() => setFaqTab("students")} className={`px-6 md:px-8 py-2 rounded-full text-xs md:text-sm font-bold transition-all duration-300 ${faqTab === "students" ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-white"} active:scale-95`}>Students</button>
            <button onClick={() => setFaqTab("posters")} className={`px-6 md:px-8 py-2 rounded-full text-xs md:text-sm font-bold transition-all duration-300 ${faqTab === "posters" ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-white"} active:scale-95`}>Posters</button>
          </div>
        </div>

        <div className="space-y-3 md:space-y-4">
          {(faqTab === "students" ? studentFaq : posterFaq).map((f, i) => (
            <div key={i} className="border border-white/5 rounded-xl bg-[#0A0A0A] overflow-hidden">
              <button onClick={() => toggleFAQ(i)} className="w-full flex items-center justify-between p-5 md:p-6 text-left hover:bg-white/5 transition-colors touch-manipulation active:bg-white/[0.02]">
                <span className="font-medium text-white text-sm md:text-base pr-4">{f.q}</span>
                <ChevronDown size={18} className={`text-zinc-500 transition-transform duration-300 shrink-0 ${openFaq === i ? "rotate-180" : ""}`} />
              </button>
              <div className={`px-5 md:px-6 overflow-hidden transition-all duration-300 ${openFaq === i ? 'max-h-60 pb-6 opacity-100' : 'max-h-0 opacity-0'}`}>
                <p className="text-zinc-400 leading-relaxed text-xs md:text-sm">{f.a}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="w-full bg-[#020202] py-12 border-t border-white/5 relative z-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">

          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
              <div className="relative w-6 h-6 grayscale opacity-50"><Image src="/Doitforme_logo.png" alt="logo" fill className="object-contain" /></div>
              <span className="font-bold text-lg text-white">DoItForMe</span>
            </div>
            <p className="text-[10px] md:text-xs text-zinc-600">© 2026 DoItForMe Inc.</p>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8">
            <div className="flex gap-6 text-xs md:text-sm text-zinc-500">
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
              <Link href="/privacy-policy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
            </div>

            <div className="hidden md:block h-4 w-px bg-white/10"></div>

            <div className="flex gap-4">
              <a
                href="https://www.linkedin.com/company/doitforme1/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-500 hover:text-[#0A66C2] transition-colors p-2"
                aria-label="LinkedIn"
              >
                <Linkedin size={20} />
              </a>
              <a
                href="https://www.instagram.com/doitforme.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-500 hover:text-[#E4405F] transition-colors p-2"
                aria-label="Instagram"
              >
                <Instagram size={20} />
              </a>
            </div>
          </div>

        </div>
      </footer>
    </div>
  );
}

// -------------------------------------------------------
// STATIC DATA (4 FAQs)
// -------------------------------------------------------
const studentFaq = [
  { q: "How do I get paid?", a: "Once your work is approved by the poster, funds are released immediately to your linked UPI or bank account. No minimum withdrawal limits." },
  { q: "Is verification required?", a: "Yes — you must upload a valid Student ID. This keeps the platform safe and exclusive to students." },
  { q: "What if the poster doesn't pay?", a: "They already paid! Funds are held in Escrow before you start working. If you do the work, you are guaranteed to get paid." },
  { q: "What if I face a dispute?", a: "You can raise a dispute directly in the chat. Our team reviews the chat history and evidence to ensure a fair resolution." },
];

const posterFaq = [
  { q: "Is my money safe?", a: "Yes. Funds are held in Escrow. The worker cannot touch it until you verify their work and click 'Release'." },
  { q: "What are the fees?", a: "Posting is FREE. For Services, we charge 10% (drops to 7.5% after 10 gigs). Market Sales are 0% fee. Rentals have a 3% escrow fee. Payment gateway charges (~2%) are extra." },
  { q: "Can I sell my old books?", a: "Absolutely! List books, calculators, or lab coats in the Campus Market. It's free to list and you keep 100% of the sale price." },
  { q: "How do disputes work?", a: "If you are unhappy with the work, raise a dispute before releasing funds. We mediate to ensure a fair outcome or refund." },
];