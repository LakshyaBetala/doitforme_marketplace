"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, CheckCircle2, ShieldCheck, Zap, Lock,
  DollarSign, ChevronDown, Quote, Star, Wallet, Code2, PenTool, Bike, Users, Mail, Clock,
  Linkedin, Instagram
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
  { id: 1, user: "Aarav P.", role: "Engineering", title: "Fix Next.js Hydration Error", price: "₹500", icon: Code2, color: "bg-blue-600" },
  { id: 2, user: "Sneha K.", role: "Design", title: "Logo for Tech Fest Startup", price: "₹1,200", icon: PenTool, color: "bg-[#8825F5]" },
  { id: 3, user: "Rohan M.", role: "Errand", title: "Drop Lab Record to Block 4", price: "₹150", icon: Bike, color: "bg-emerald-500" }
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
    const criticalImages = ["/sloth.png"];
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

  const ActiveGigIcon = gigsMock[activeGigIndex].icon;

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
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-28 md:h-32 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 md:gap-3 group">
            <div className="relative w-20 h-20 md:w-28 md:h-28 transition-transform duration-500 group-hover:rotate-12">
              <Image src="/sloth.png" alt="logo" fill className="object-contain" />
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
      <section className="pt-24 md:pt-32 pb-12 md:pb-20 relative max-w-7xl mx-auto px-6 lg:px-12 grid lg:grid-cols-2 gap-12 md:gap-16 items-center z-10 min-h-[90vh]">

        {/* LEFT: CONTENT */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={loadingComplete ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-center lg:text-left flex flex-col items-center lg:items-start"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 w-fit mb-6 md:mb-8 mt-8 md:mt-12 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-purple opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-purple"></span>
            </span>
            <span className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">Live: Verified Marketplace</span>
          </div>

          <h1 className="text-4xl md:text-8xl font-black leading-[1.1] md:leading-[1.05] tracking-tighter text-white mb-6 md:mb-8 break-words w-full">
            Outsource tasks.<br />
            <span className="text-zinc-500">Buy & Sell Gear.</span>
          </h1>

          <p className="text-base md:text-lg text-zinc-400 leading-relaxed max-w-xl mb-8 md:mb-10 px-4 md:px-0">
            The safest peer-to-peer marketplace for university students.
            Get assignments and errands done, or monetize your free time securely.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto px-4 md:px-0">
            <button onClick={handleLogin} className="w-full sm:w-auto px-8 py-4 rounded-full text-sm font-bold bg-white text-black hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 active:scale-95">
              Start Now <ArrowRight size={16} />
            </button>
            <button onClick={() => scrollToSection('how-it-works')} className="w-full sm:w-auto px-8 py-4 rounded-full text-sm font-bold border border-zinc-800 text-white hover:bg-zinc-900 transition-all active:scale-95">
              See How It Works
            </button>
          </div>

          <div className="mt-12 md:mt-16 flex items-center gap-6 md:gap-12 border-t border-white/5 pt-8 w-full justify-center lg:justify-start">
            <div className="text-center lg:text-left">
              <div className="text-xl md:text-2xl font-bold text-white">100%</div>
              <div className="text-[9px] md:text-[10px] text-zinc-500 uppercase tracking-widest">Verified</div>
            </div>
            <div className="text-center lg:text-left">
              <div className="text-xl md:text-2xl font-bold text-white">Escrow</div>
              <div className="text-[9px] md:text-[10px] text-zinc-500 uppercase tracking-widest">Protected</div>
            </div>
            <div className="text-center lg:text-left">
              <div className="text-xl md:text-2xl font-bold text-white">0%</div>
              <div className="text-[9px] md:text-[10px] text-zinc-500 uppercase tracking-widest">Post Fee</div>
            </div>
          </div>
        </motion.div>

        {/* RIGHT: REVOLVING GIGS */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={loadingComplete ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="relative hidden lg:block h-[500px] w-full perspective-[1000px]"
        >
          {/* The Revolving Card */}
          <div className="absolute top-10 left-10 z-20 hover:z-50 transition-all">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeGigIndex}
                initial={{ opacity: 0, y: 20, rotateX: -10 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                exit={{ opacity: 0, y: -20, rotateX: 10 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                onClick={handleLogin}
                className="w-80 bg-[#121217]/80 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl cursor-pointer hover:border-brand-purple/40 transition-all group will-change-transform"
              >
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full ${gigsMock[activeGigIndex].color} flex items-center justify-center text-white shadow-lg`}>
                      <ActiveGigIcon size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{gigsMock[activeGigIndex].user}</div>
                      <div className="text-xs text-zinc-500">{gigsMock[activeGigIndex].role}</div>
                    </div>
                  </div>
                  <div className="bg-white/10 text-white px-2 py-1 rounded text-xs font-bold font-mono">
                    {gigsMock[activeGigIndex].price}
                  </div>
                </div>
                <div className="h-14 flex items-center">
                  <div className="text-lg text-white font-bold leading-tight">
                    {gigsMock[activeGigIndex].title}
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500 font-bold uppercase tracking-wider group-hover:text-brand-purple transition-colors">
                  Apply Now <ArrowRight size={12} />
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Static Background Elements */}
          <motion.div
            animate={{ y: [0, 15, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-52 right-10 w-64 bg-white text-black p-4 rounded-2xl shadow-[0_0_50px_rgba(255,255,255,0.1)] z-30 pointer-events-none opacity-90 will-change-transform"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-full text-green-600"><CheckCircle2 size={20} /></div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Escrow</div>
                <div className="text-sm font-bold">Funds Released</div>
              </div>
            </div>
          </motion.div>

          <motion.div
            animate={{ rotate: [0, 3, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
            className="absolute bottom-20 left-20 w-72 bg-[#0A0A0A] border border-white/5 p-6 rounded-3xl -z-10 opacity-60 grayscale blur-[1px] will-change-transform"
          >
            <div className="flex items-center gap-2 text-zinc-500 mb-6">
              <Wallet size={16} /> <span className="text-xs uppercase tracking-widest">Total Earnings</span>
            </div>
            <div className="text-4xl font-bold text-white">₹12,450</div>
          </motion.div>
        </motion.div>
      </section>

      {/* --- MARKETPLACE SHOWCASE --- */}
      <section className="py-20 md:py-32 bg-[#050505] relative z-10 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">

          {/* Visuals */}
          <div className="relative h-[400px] md:h-[500px] w-full">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-pink/20 blur-[120px] rounded-full pointer-events-none"></div>

            {/* Product Card 1 (Textbook) */}
            <motion.div
              whileHover={{ y: -10, rotate: -2 }}
              className="absolute top-10 left-0 md:left-10 w-64 bg-[#121217] border border-white/10 p-4 rounded-3xl shadow-2xl rotate-[-6deg] z-20 cursor-pointer"
            >
              <div className="h-32 bg-zinc-800 rounded-2xl mb-4 flex items-center justify-center text-4xl">📚</div>
              <div className="flex justify-between items-center mb-2">
                <div className="text-sm font-bold text-white">Engineering Physics</div>
                <div className="text-xs font-mono bg-white/10 px-2 py-1 rounded text-white">₹350</div>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>For Sale
              </div>
            </motion.div>

            {/* Product Card 2 (Calculator) */}
            <motion.div
              whileHover={{ y: -10, rotate: 2 }}
              className="absolute bottom-20 right-0 md:right-10 w-64 bg-[#121217] border border-white/10 p-4 rounded-3xl shadow-2xl rotate-[6deg] z-30 cursor-pointer"
            >
              <div className="h-32 bg-zinc-800 rounded-2xl mb-4 flex items-center justify-center text-4xl">📟</div>
              <div className="flex justify-between items-center mb-2">
                <div className="text-sm font-bold text-white">Casio FX-991EX</div>
                <div className="text-xs font-mono bg-white/10 px-2 py-1 rounded text-white">₹50/day</div>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                <span className="w-2 h-2 rounded-full bg-brand-purple"></span>For Rent
              </div>
            </motion.div>
          </div>

          {/* Content */}
          <div>
            <h2 className="text-4xl md:text-6xl font-black text-white mb-6 leading-[0.95] tracking-tighter">
              Campus <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-pink to-brand-purple">Marketplace.</span>
            </h2>
            <p className="text-lg text-zinc-400 leading-relaxed mb-8 max-w-md">
              Don't let your gear gather dust. Sell your old textbooks, rent out your calculator, or buy what you need from seniors.
            </p>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-500 shrink-0">
                  <DollarSign size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">Sell & Earn</h3>
                  <p className="text-sm text-zinc-500">List items in seconds. Get paid directly to UPI after delivery.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-brand-purple shrink-0">
                  <Clock size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">Rent for Short Term</h3>
                  <p className="text-sm text-zinc-500">Need a lab coat for one day? Rent it from a batchmate securely.</p>
                </div>
              </div>
            </div>

            <div className="mt-10">
              <button onClick={handleLogin} className="px-8 py-4 bg-white text-black font-bold rounded-full hover:bg-zinc-200 transition-colors active:scale-95 flex items-center gap-2">
                Browse Marketplace <ArrowRight size={16} />
              </button>
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
      <section className="max-w-7xl mx-auto px-6 mb-20 md:mb-32 relative z-10">
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
          TRANSPARENCY (Bento Grid)
      --------------------------------------------------------- */}
      <section id="transparency" className="max-w-7xl mx-auto px-6 mb-20 md:mb-32 relative z-10">
        <div className="mb-12 md:mb-16">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 md:mb-6">Complete Transparency.</h2>
          <p className="text-zinc-400 text-base md:text-lg max-w-xl">We've stripped away the complexity. No hidden wallets. No confusion.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          <div className="md:col-span-2 relative overflow-hidden rounded-3xl border border-white/10 bg-[#0A0A0A] p-6 md:p-8 group">
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 mb-6"><ShieldCheck size={24} /></div>
              <h3 className="text-2xl font-bold text-white mb-3">Direct Escrow</h3>
              <p className="text-zinc-400 leading-relaxed max-w-lg text-sm md:text-base">
                Funds move directly. When you hire, you pay into Escrow.
                When work is done, funds go directly to the worker's payout method.
                No intermediate wallet storage.
              </p>
            </div>
            <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[80px] group-hover:bg-blue-500/10 transition-colors duration-500" />
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-6 md:p-8 group hover:border-brand-purple/30 transition-colors active:scale-95 touch-manipulation">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-brand-purple mb-6"><Zap size={24} /></div>
            <h3 className="text-2xl font-bold text-white mb-3">Instant Match</h3>
            <p className="text-zinc-400 text-sm md:text-base">Post a gig and get applicants within minutes. Filter by rating.</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-6 md:p-8 group hover:border-brand-pink/30 transition-colors active:scale-95 touch-manipulation">
            <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-500 mb-6"><Lock size={24} /></div>
            <h3 className="text-2xl font-bold text-white mb-3">Verified IDs</h3>
            <p className="text-zinc-400 text-sm md:text-base">No bots. Every user must upload a valid Student ID to participate.</p>
          </div>

          <div className="md:col-span-2 rounded-3xl border border-white/10 bg-[#0A0A0A] p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex-1 w-full">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500 mb-6"><DollarSign size={24} /></div>
              <h3 className="text-2xl font-bold text-white mb-3">The Economics</h3>
              <ul className="space-y-3 text-zinc-400 text-sm md:text-base">
                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-green-500" /> Free to post gigs</li>
                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-green-500" /> Free to apply for gigs</li>
                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-zinc-500" /> 10% Platform fee on payout</li>
              </ul>
            </div>
            <div className="bg-black p-6 rounded-2xl border border-white/10 w-full md:w-64 text-center relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-purple to-brand-blue"></div>
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Payout Example</span>
              <div className="mt-4 flex justify-between text-sm"><span className="text-zinc-400">Earned</span><span className="text-white">₹1000</span></div>
              <div className="mt-2 flex justify-between text-sm"><span className="text-zinc-400">Fee (10%)</span><span className="text-red-400">-₹100</span></div>
              <div className="mt-4 pt-4 border-t border-white/10 flex justify-between font-bold text-lg"><span className="text-white">You Get</span><span className="text-green-400">₹900</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-16 md:py-24 bg-[#0A0A0A] border-y border-white/5 relative z-10">
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
              <div className="relative w-6 h-6 grayscale opacity-50"><Image src="/sloth.png" alt="logo" fill className="object-contain" /></div>
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
  { q: "Is my money safe?", a: "Yes. You deposit funds into Escrow. The worker cannot touch it until you verify their work and click 'Release'." },
  { q: "What if the work is bad?", a: "You can raise a dispute. Since the money is in Escrow, it can be refunded to you if the work is unsatisfactory." },
  { q: "Are there extra fees?", a: "Posting is free. You only pay the amount you set for the task." },
  { q: "How do disputes work?", a: "If you are unhappy with the work, raise a dispute before releasing funds. We mediate to ensure a fair outcome or refund." },
];