"use client";

import { useEffect, useState, type ElementType, type MouseEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ArrowRight, ArrowUpRight, ChevronDown, Linkedin, Instagram, Mail, Menu, X,
  ClipboardList, UserCheck, ShieldCheck, ThumbsUp, Clock, BadgeCheck, IndianRupee,
  Palette, Search, Presentation, Database, Code2, PenLine, GraduationCap, Sparkles, Check,
} from "lucide-react";
import { Reveal, Stagger, StaggerItem, CountUp, EASE_OUT } from "@/components/motion";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

// -------------------------------------------------------
// PRELOADER (curtain reveal, asset-aware) — kept by request
// -------------------------------------------------------
const words = ["DESIGN", "RESEARCH", "DECKS", "DATA", "HUSTLE"];

const Preloader = ({ onComplete, isAssetReady }: { onComplete: () => void; isAssetReady: boolean }) => {
  const [index, setIndex] = useState(0);
  const [showLogo, setShowLogo] = useState(false);
  const [wordsFinished, setWordsFinished] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => {
        if (prev === words.length - 1) {
          clearInterval(interval);
          setShowLogo(true);
          setWordsFinished(true);
          return prev;
        }
        return prev + 1;
      });
    }, 200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (wordsFinished && isAssetReady) {
      const timer = setTimeout(onComplete, 850);
      return () => clearTimeout(timer);
    }
  }, [wordsFinished, isAssetReady, onComplete]);

  return (
    <motion.div
      initial={{ y: 0 }}
      exit={{ y: "-100%", transition: { duration: 0.9, ease: [0.76, 0, 0.24, 1] } }}
      className="fixed inset-0 z-[9999] bg-[#0B0B11] flex items-center justify-center overflow-hidden cursor-wait"
    >
      <AnimatePresence mode="wait">
        {!showLogo ? (
          <motion.h1
            key={index}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.14 }}
            style={{ color: "var(--brand-purple-soft)", fontFamily: "'Space Grotesk', sans-serif" }}
            className="text-4xl md:text-6xl font-bold tracking-tight"
          >
            {words[index]}
          </motion.h1>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3"
          >
            <div className="relative w-11 h-11 md:w-12 md:h-12">
              <Image src="/logo.png" alt="DoItForMe" fill className="object-contain" priority />
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>DoItForMe</h1>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// -------------------------------------------------------
// CONTENT
// -------------------------------------------------------
const CATEGORIES = [
  [Palette, "Design & branding", "Logos, decks, social posts, Canva, UI", "lg:col-span-2"],
  [Search, "Research & leads", "Market scans, lead lists, summaries", ""],
  [Presentation, "Presentations & docs", "Pitch decks, reports, proposals", ""],
  [Database, "Data & operations", "Entry, cleanup, testing, uploads", ""],
  [Code2, "Coding & automation", "Scripts, fixes, small builds", ""],
  [PenLine, "Writing & content", "Articles, captions, scripts, edits", ""],
  [GraduationCap, "Tutoring & mentoring", "1:1 sessions, mock interviews, notes", ""],
] as const;

const STEPS = [
  [ClipboardList, "Tell us what you need", "Write it in your own words and set a budget. Posting is free."],
  [UserCheck, "Pick a student", "Choose a verified student yourself, or let us choose one for you."],
  [ThumbsUp, "Pay only when happy", "We hold your money safely. You release it once the work is right."],
] as const;

const PROMISES = [
  [BadgeCheck, "Every student is ID-verified"],
  [ShieldCheck, "Money held until you approve"],
  [Clock, "24 hours to review the work"],
  [IndianRupee, "Posting a task is free"],
] as const;

const FLOW = [
  ["You pay", "We hold the payment until you approve the work."],
  ["Work is delivered", "The student submits and explains exactly what was done."],
  ["You review for 24 hours", "Approve it, request changes, or open a dispute."],
  ["Money is released", "Only on your approval does the payout go out."],
] as const;

const FAQS = [
  ["How does it work?", "Post a task for free. Pick a verified student yourself, or let DoItForMe assign one for you. We hold your payment and release it only once you approve the delivered work."],
  ["What are the fees?", "Posting is always free. A flat fee comes out of the worker's payout only when work is delivered: 5% for student-to-student tasks, 10% for business tasks, whether self-serve or fully managed."],
  ["Is my money safe?", "Yes. We hold your payment from the moment you pay, and the student is paid only after you approve. If something is wrong you can request changes or open a dispute, and the money stays held until it is resolved."],
  ["Who are the students?", "Every student is identity-verified before they can work, across school, college and university. You can see ratings, completion rate and skills before you hire."],
  ["What is Managed?", "If you would rather not run it yourself, DoItForMe assigns a vetted student, oversees the timeline, and reviews the work before it reaches you. The fee stays a flat 10%."],
];

const display = { fontFamily: "'Space Grotesk', sans-serif" } as const;

// -------------------------------------------------------
// SMALL PIECES
// -------------------------------------------------------

/** A card that lights up under the cursor (see .lp-spot in globals.css). */
function Spot({
  as = "div", className = "", children, onClick,
}: { as?: "div" | "button"; className?: string; children: ReactNode; onClick?: () => void }) {
  const Tag = as as ElementType;
  const move = (e: MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <Tag onMouseMove={move} onClick={onClick} className={`lp-spot ${className}`}>
      {children}
    </Tag>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 inline-flex items-center gap-2 text-[12.5px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-purple-soft)]">
      <span className="h-px w-6 bg-[rgba(201,169,255,0.6)]" />
      {children}
    </p>
  );
}

/**
 * The hero's picture of the product. It plays the whole job in a loop —
 * posted, offer, money held, approved — so a visitor understands the promise
 * without reading. It is an illustration, and says so.
 */
const DEMO_STAGES = ["Posted", "Offer in", "Money held", "Approved"] as const;

function HeroDemo({ play }: { play: boolean }) {
  const reduce = useReducedMotion();
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (reduce || !play) return;
    const t = setInterval(() => setStage((s) => (s + 1) % DEMO_STAGES.length), 2400);
    return () => clearInterval(t);
  }, [reduce, play]);

  const s = reduce ? 3 : stage;

  return (
    <div className="relative mx-auto w-full max-w-[460px] pt-10 pb-12">
      <div aria-hidden className="absolute inset-6 rounded-[40px] bg-[rgba(136,37,245,0.2)] blur-[70px]" />

      {/* the task */}
      <div className="lp-bob relative rounded-3xl border border-white/[0.1] bg-[#15151f]/90 p-6 shadow-[0_30px_80px_-30px_rgba(136,37,245,0.55)] backdrop-blur-xl" style={{ ["--d" as string]: "0s" }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/55">Example task</span>
            <h3 className="mt-3 text-[22px] font-bold leading-tight tracking-tight" style={display}>Logo for my bakery</h3>
            <p className="mt-1 text-[14px] text-white/50">Design · needed in 2 days</p>
          </div>
          <div className="flex items-center rounded-xl bg-[rgba(136,37,245,0.15)] px-3 py-2 text-[22px] font-bold text-[var(--brand-purple-soft)]" style={display}>
            <IndianRupee size={18} strokeWidth={2.6} />1,500
          </div>
        </div>

        {/* progress */}
        <div className="mt-7">
          <div className="relative h-1.5 rounded-full bg-white/[0.07]">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[var(--brand-purple)] to-[var(--brand-purple-soft)]"
              animate={{ width: `${(s / (DEMO_STAGES.length - 1)) * 100}%` }}
              transition={{ duration: 0.7, ease: EASE_OUT }}
            />
          </div>
          <div className="mt-3 grid grid-cols-4 gap-1">
            {DEMO_STAGES.map((label, i) => (
              <span key={label} className={`flex items-center gap-1 text-[11.5px] font-semibold transition-colors duration-500 ${i <= s ? "text-white/90" : "text-white/30"}`}>
                {i <= s ? <Check size={12} className="text-[var(--brand-purple-soft)]" /> : <span className="h-1.5 w-1.5 rounded-full bg-white/25" />}
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* the student's offer */}
      <AnimatePresence>
        {s >= 1 && (
          <motion.div
            key="offer"
            initial={{ opacity: 0, x: 24, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, scale: 0.95 }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
            className="absolute -right-2 top-0 sm:-right-8"
          >
            <div className="lp-bob flex items-center gap-3 rounded-2xl border border-white/[0.1] bg-[#1b1b27]/95 py-3 pl-3 pr-5 shadow-xl backdrop-blur-xl" style={{ ["--d" as string]: "-2s" }}>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand-purple)] text-[15px] font-bold">A</span>
              <div>
                <p className="text-[14px] font-semibold leading-tight">Aarav offered to help</p>
                <p className="mt-0.5 flex items-center gap-1 text-[12px] text-[var(--brand-purple-soft)]"><BadgeCheck size={13} /> ID-verified student</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* the money */}
      <AnimatePresence>
        {s >= 2 && (
          <motion.div
            key="money"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
            className="absolute -left-2 bottom-0 sm:-left-8"
          >
            <div className="lp-bob flex items-center gap-3 rounded-2xl border border-white/[0.1] bg-[#1b1b27]/95 py-3 pl-3 pr-5 shadow-xl backdrop-blur-xl" style={{ ["--d" as string]: "-4s" }}>
              <span className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-500 ${s === 3 ? "bg-emerald-500/20 text-emerald-300" : "bg-[rgba(136,37,245,0.2)] text-[var(--brand-purple-soft)]"}`}>
                {s === 3 ? <Check size={20} strokeWidth={3} /> : <ShieldCheck size={20} />}
              </span>
              <div>
                <p className="text-[14px] font-semibold leading-tight">{s === 3 ? "Paid to the student" : "₹1,500 held safely"}</p>
                <p className="mt-0.5 text-[12px] text-white/50">{s === 3 ? "You approved the work" : "Released only when you approve"}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();

  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [loadingComplete, setLoadingComplete] = useState(false);
  const [isAssetReady, setIsAssetReady] = useState(false);
  const [shouldShowPreloader, setShouldShowPreloader] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const supabase = supabaseBrowser();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: any) => {
      if (data.user) setUserEmail(data.user.email || null);
    });
  }, [supabase]);

  useEffect(() => {
    const KEY = "dfm_last_preload";
    const WINDOW = 2 * 60 * 1000;
    const lastSeen = localStorage.getItem(KEY);
    const now = Date.now();
    if (lastSeen && now - parseInt(lastSeen) < WINDOW) {
      setShouldShowPreloader(false);
      setLoadingComplete(true);
      setIsAssetReady(true);
    } else {
      localStorage.setItem(KEY, now.toString());
    }
  }, []);

  useEffect(() => {
    const img = new window.Image();
    img.src = "/logo.png";
    img.onload = () => setIsAssetReady(true);
    img.onerror = () => setIsAssetReady(true);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToSection = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };
  const goEarn = () => router.push(userEmail ? "/dashboard" : "/login");
  const goHire = () => router.push("/company/onboarding");
  const isAdmin = userEmail === "betala911@gmail.com" || userEmail === "doitforme.in@gmail.com";

  const NAV = [["work", "Work"], ["how", "How it works"], ["pricing", "Pricing"], ["faq", "FAQ"]] as const;

  return (
    <div className="min-h-screen bg-[var(--background)] text-white relative selection:bg-[var(--brand-purple)] selection:text-white font-sans overflow-x-hidden">
      <AnimatePresence>
        {shouldShowPreloader && !loadingComplete && (
          <Preloader isAssetReady={isAssetReady} onComplete={() => setLoadingComplete(true)} />
        )}
      </AnimatePresence>

      {/* ============ NAV ============ */}
      <header className={`sticky top-0 z-50 transition-[background-color,border-color] duration-300 border-b ${scrolled ? "bg-[rgba(11,11,17,0.8)] backdrop-blur-xl border-white/[0.06]" : "border-transparent"}`}>
        <div className="max-w-6xl mx-auto px-5 md:px-8 h-[72px] flex items-center justify-between">
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="relative w-9 h-9 transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-110"><Image src="/logo.png" alt="DoItForMe" fill className="object-contain" priority /></div>
            <span className="font-bold text-xl tracking-tight" style={display}>DoItForMe</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-[15px] font-medium text-white/65">
            {NAV.map(([id, label]) => (
              <button key={id} onClick={() => scrollToSection(id)} className="group relative px-4 py-2 transition-colors hover:text-white">
                {label}
                <span className="absolute inset-x-4 bottom-1 h-px origin-left scale-x-0 bg-[var(--brand-purple-soft)] transition-transform duration-300 group-hover:scale-x-100" />
              </button>
            ))}
            {isAdmin && <Link href="/admin" className="px-4 py-2 hover:text-white transition-colors">Admin</Link>}
          </nav>
          <div className="flex items-center gap-1">
            <button onClick={goEarn} className="hidden sm:block text-[15px] font-semibold text-white/80 hover:text-white px-4 py-2.5 transition-colors">{userEmail ? "Dashboard" : "Log in"}</button>
            <button onClick={goHire} className="lp-shine hidden sm:inline-flex items-center gap-2 text-[15px] font-semibold text-white bg-[var(--brand-purple)] hover:brightness-110 px-5 py-2.5 rounded-full transition active:scale-[0.97]">Get work done</button>
            <button onClick={() => setMenuOpen((o) => !o)} aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} className="md:hidden flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: EASE_OUT }}
              className="overflow-hidden md:hidden border-t border-white/[0.06] bg-[var(--background)]"
            >
              <div className="px-5 py-3 flex flex-col">
                {NAV.map(([id, label]) => (
                  <button key={id} onClick={() => scrollToSection(id)} className="text-left py-3.5 text-[17px] font-semibold text-white/80 border-b border-white/[0.05]">{label}</button>
                ))}
                <button onClick={goEarn} className="text-left py-3.5 text-[17px] font-semibold text-white/80">{userEmail ? "Dashboard" : "Log in"}</button>
                <button onClick={goHire} className="mb-3 mt-1 rounded-full bg-[var(--brand-purple)] py-3.5 text-[16px] font-bold">Get work done</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ============ HERO ============ */}
      <section className="relative">
        <div aria-hidden className="absolute inset-x-0 top-0 h-[760px] overflow-hidden">
          <div className="lp-grid absolute inset-0" />
          <div className="lp-blob lp-blob-a left-[8%] top-[-120px] h-[420px] w-[520px] bg-[rgba(136,37,245,0.3)]" />
          <div className="lp-blob lp-blob-b right-[2%] top-[80px] h-[380px] w-[440px] bg-[#5b2bd9]/25" />
        </div>

        <div className="relative max-w-6xl mx-auto px-5 md:px-8 pt-14 md:pt-24 pb-10">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-8 items-center">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={loadingComplete ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, ease: EASE_OUT }}>
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] backdrop-blur mb-7">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand-purple-soft)] opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--brand-purple-soft)]" />
                </span>
                <span className="text-[12px] font-semibold tracking-[0.1em] text-white/75 uppercase">India&apos;s verified student workforce</span>
              </div>
              <h1 className="font-bold tracking-tight leading-[1.03] text-[clamp(2.6rem,5.6vw,4.4rem)]" style={{ ...display, textWrap: "balance" }}>
                Get any task done by <span className="lp-gradient-text">trusted students.</span>
              </h1>
              <p className="mt-6 text-[19px] text-white/70 leading-relaxed max-w-xl">
                Need a logo, a poster, a price list or some data typed up? Tell us what you need. A verified student does it, and you pay only when you are happy.
              </p>
              <div className="mt-9 flex flex-col sm:flex-row gap-3.5 max-w-lg">
                <button onClick={goHire} className="lp-shine group px-8 py-4 rounded-full text-[17px] font-bold text-white bg-[var(--brand-purple)] hover:brightness-110 hover:shadow-[0_16px_40px_-10px_rgba(136,37,245,0.95)] active:scale-[0.97] transition flex items-center justify-center gap-2.5 shadow-[0_12px_32px_-12px_rgba(136,37,245,0.9)]">
                  I need work done <ArrowRight size={19} className="transition-transform group-hover:translate-x-1" />
                </button>
                <button onClick={goEarn} className="px-8 py-4 rounded-full text-[17px] font-bold text-white/90 border border-white/15 hover:border-white/30 hover:bg-white/[0.06] active:scale-[0.97] transition">
                  I want to earn
                </button>
              </div>
              <p className="mt-5 flex items-center gap-2 text-[14px] text-white/50"><Check size={15} className="text-[var(--brand-purple-soft)]" /> Free to post. No card needed to start.</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 30 }} animate={loadingComplete ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.8, delay: 0.2, ease: EASE_OUT }}>
              <HeroDemo play={loadingComplete} />
            </motion.div>
          </div>

          {/* The promises, as one calm strip. */}
          <Stagger immediate delay={0.4} className="mt-12 grid grid-cols-2 lg:grid-cols-4 rounded-3xl border border-white/[0.08] bg-white/[0.025] backdrop-blur">
            {PROMISES.map(([Icon, text], i) => (
              <StaggerItem key={text} className={`group flex items-center gap-3 p-5 ${i > 0 ? "lg:border-l border-white/[0.07]" : ""} ${i % 2 === 1 ? "border-l border-white/[0.07] lg:border-l" : ""} ${i > 1 ? "border-t border-white/[0.07] lg:border-t-0" : ""}`}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--brand-purple-soft)] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-6deg]">
                  <Icon size={21} />
                </span>
                <span className="text-[14.5px] font-semibold leading-snug text-white/85">{text}</span>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ============ MARQUEE ============ */}
      <div className="lp-marquee relative mt-6 py-5">
        <div className="lp-marquee-track">
          {[0, 1].map((dup) => (
            <div key={dup} aria-hidden={dup === 1} className="flex shrink-0 items-center gap-3 pr-3">
              {["Logos", "Posters", "Price lists", "Pitch decks", "Data entry", "Social media", "Research", "Resumes", "Websites", "Translations", "Video edits", "Tutoring"].map((t) => (
                <span key={t} className="inline-flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-5 py-2.5 text-[15px] font-medium text-white/65 transition-colors hover:border-[rgba(201,169,255,0.4)] hover:text-white">
                  <Sparkles size={14} className="text-[var(--brand-purple-soft)]" /> {t}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ============ HOW IT WORKS ============ */}
      <section id="how" className="relative max-w-6xl mx-auto px-5 md:px-8 py-20 md:py-28 scroll-mt-20">
        <Reveal className="max-w-xl mb-14">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="font-bold tracking-tight leading-[1.05] text-[clamp(2rem,3.8vw,3rem)]" style={display}>Three easy steps. No risk.</h2>
        </Reveal>
        <div className="relative">
          {/* a line that draws itself behind the step icons */}
          <motion.div
            aria-hidden
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: "-20%" }}
            transition={{ duration: 1.4, ease: EASE_OUT }}
            className="absolute left-[16%] right-[16%] top-[62px] hidden h-px origin-left bg-gradient-to-r from-transparent via-[rgba(201,169,255,0.5)] to-transparent md:block"
          />
          <Stagger className="grid md:grid-cols-3 gap-5" gap={0.14}>
            {STEPS.map(([Icon, t, d], i) => (
              <StaggerItem key={t}>
                <Spot className="h-full rounded-3xl border border-white/[0.08] bg-[var(--card)] p-8">
                  <span className="absolute right-6 top-4 text-[72px] font-bold leading-none text-white/[0.04]" style={display}>{i + 1}</span>
                  <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand-purple)] text-white shadow-[0_10px_30px_-10px_rgba(136,37,245,0.9)]">
                    <Icon size={26} />
                  </span>
                  <h3 className="font-bold text-[22px] mt-7" style={display}>{t}</h3>
                  <p className="text-white/60 text-[16px] mt-2.5 leading-relaxed">{d}</p>
                </Spot>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ============ WORK (bento) ============ */}
      <section id="work" className="relative max-w-6xl mx-auto px-5 md:px-8 py-20 md:py-28 scroll-mt-20">
        <div className="grid lg:grid-cols-[1fr_1fr] gap-6 items-end mb-12">
          <Reveal>
            <Eyebrow>Real deliverables</Eyebrow>
            <h2 className="font-bold tracking-tight leading-[1.05] text-[clamp(2rem,3.8vw,3rem)]" style={display}>
              Not errands.<br />Actual work.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-white/65 max-w-md leading-relaxed text-[17px] lg:ml-auto">From a logo by tonight to a clean price list by Friday. These are just the popular ones. If you can describe it, a verified student can probably do it.</p>
          </Reveal>
        </div>

        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" gap={0.06}>
          {CATEGORIES.map(([Icon, title, desc, span]) => (
            <StaggerItem key={title} className={span}>
              <Spot as="button" onClick={goHire} className="group flex h-full w-full flex-col justify-start rounded-3xl border border-white/[0.08] bg-[var(--card)] p-7 text-left">
                <div className="flex w-full items-start justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--brand-purple-soft)] transition-all duration-300 group-hover:bg-[var(--brand-purple)] group-hover:text-white">
                    <Icon size={23} />
                  </span>
                  <ArrowUpRight size={22} className="text-white/25 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" />
                </div>
                <h3 className="mt-10 text-[20px] font-semibold tracking-tight" style={display}>{title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-white/55">{desc}</p>
              </Spot>
            </StaggerItem>
          ))}
          <StaggerItem className="sm:col-span-2 lg:col-span-4">
            <Spot as="button" onClick={goHire} className="group flex w-full items-center justify-between gap-6 rounded-3xl border border-[var(--accent-line)] bg-[linear-gradient(110deg,rgba(136,37,245,0.18),rgba(136,37,245,0.04))] p-7 text-left">
              <div className="flex items-center gap-5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-purple)] text-white"><Sparkles size={23} /></span>
                <div>
                  <h3 className="text-[20px] font-semibold tracking-tight text-[var(--brand-purple-soft)]" style={display}>Anything else</h3>
                  <p className="mt-1 text-[15px] text-white/60">Describe your task, name a budget, and the right student finds it.</p>
                </div>
              </div>
              <ArrowRight size={24} className="hidden shrink-0 text-[var(--brand-purple-soft)] transition-transform duration-300 group-hover:translate-x-1.5 sm:block" />
            </Spot>
          </StaggerItem>
        </Stagger>
      </section>

      {/* ============ MANAGED + EARN ============ */}
      <section className="relative max-w-6xl mx-auto px-5 md:px-8 py-10">
        <div className="grid gap-5 lg:grid-cols-2">
          <Reveal>
            <Spot className="relative h-full rounded-3xl border border-white/[0.08] bg-[var(--card)] p-8 md:p-10">
              <div aria-hidden className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-[var(--accent-soft)] blur-[100px]" />
              <div className="relative flex h-full flex-col">
                <div className="flex items-start justify-between gap-4">
                  <Eyebrow>DoItForMe Managed</Eyebrow>
                  <div className="relative -mt-4 h-36 w-36 shrink-0 animate-[float_8s_ease-in-out_infinite]"><Image src="/tasksloth.png" alt="" fill className="object-contain" sizes="144px" /></div>
                </div>
                <h2 className="font-bold tracking-tight leading-[1.08] text-[clamp(1.7rem,2.8vw,2.3rem)]" style={display}>Prefer not to manage it? We will.</h2>
                <p className="mt-4 text-white/65 leading-relaxed text-[16.5px]">One click and DoItForMe assigns a vetted student, runs the timeline, and reviews the work before it reaches you. You deal with us, never a stranger. The fee stays a flat 10%.</p>
                <button onClick={goHire} className="lp-shine group mt-auto inline-flex w-fit items-center gap-2 rounded-full bg-[var(--brand-purple)] px-7 py-3.5 text-[16px] font-bold transition hover:brightness-110 active:scale-[0.97]" style={{ marginTop: 28 }}>
                  Let us handle it <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </Spot>
          </Reveal>
          <Reveal delay={0.1}>
            <Spot className="relative h-full rounded-3xl border border-white/[0.08] bg-[var(--card)] p-8 md:p-10">
              <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#2f6bff]/10 blur-[100px]" />
              <div className="relative flex h-full flex-col">
                <div className="flex items-start justify-between gap-4">
                  <Eyebrow>For students</Eyebrow>
                  <div className="relative -mt-4 h-36 w-36 shrink-0 animate-[float_8s_ease-in-out_infinite]"><Image src="/moneysloth.png" alt="" fill className="object-contain" sizes="144px" /></div>
                </div>
                <h2 className="font-bold tracking-tight leading-[1.08] text-[clamp(1.7rem,2.8vw,2.3rem)]" style={display}>Turn your skills into income.</h2>
                <p className="mt-4 text-white/65 leading-relaxed text-[16.5px]">Get verified once, then take on tasks that match what you are good at. Deliver, get approved, and the payout lands in your UPI. A flat 5 to 10% fee, nothing hidden.</p>
                <button onClick={goEarn} className="group mt-auto inline-flex w-fit items-center gap-2 rounded-full border border-white/15 px-7 py-3.5 text-[16px] font-bold transition hover:border-white/30 hover:bg-white/[0.05] active:scale-[0.97]" style={{ marginTop: 28 }}>
                  Start earning <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </Spot>
          </Reveal>
        </div>
      </section>

      {/* ============ PRICING ============ */}
      <section id="pricing" className="relative max-w-6xl mx-auto px-5 md:px-8 py-20 md:py-28 scroll-mt-20">
        <Reveal className="max-w-xl mb-12">
          <Eyebrow>Pricing</Eyebrow>
          <h2 className="font-bold tracking-tight leading-[1.05] text-[clamp(2rem,3.8vw,3rem)]" style={display}>One flat fee. Nothing hidden.</h2>
          <p className="text-white/60 mt-4 text-[16px] leading-relaxed">Posting is free. The fee comes out of the payout, only when work is delivered and approved.</p>
        </Reveal>
        <Stagger className="grid md:grid-cols-2 gap-5" gap={0.12}>
          <StaggerItem>
            <Spot className="h-full rounded-3xl border border-white/[0.08] bg-[var(--card)] p-9">
              <p className="text-[14px] font-semibold uppercase tracking-[0.1em] text-white/50">Student economy</p>
              <p className="mt-3 flex items-baseline text-[68px] font-bold leading-none tracking-tight" style={display}><CountUp to={5} /><span className="text-[40px] text-white/50">%</span></p>
              <p className="mt-5 text-white/55 leading-relaxed text-[15.5px]">Students helping students. Tutoring, decks, design, coding help. The lowest fee, payment protected end to end.</p>
            </Spot>
          </StaggerItem>
          <StaggerItem>
            <Spot className="relative h-full rounded-3xl border border-[rgba(201,169,255,0.4)] bg-[linear-gradient(160deg,rgba(136,37,245,0.22),var(--card)_60%)] p-9">
              <span className="absolute right-6 top-6 rounded-full bg-[var(--brand-purple)] px-3 py-1 text-[11.5px] font-bold uppercase tracking-[0.08em]">For businesses</span>
              <p className="text-[14px] font-semibold uppercase tracking-[0.1em] text-[var(--brand-purple-soft)]">Business work</p>
              <p className="mt-3 flex items-baseline text-[68px] font-bold leading-none tracking-tight text-[var(--brand-purple-soft)]" style={display}><CountUp to={10} /><span className="text-[40px] opacity-60">%</span></p>
              <p className="mt-5 text-white/60 leading-relaxed text-[15.5px]">Company tasks, self-serve or fully managed. We can assign and review the delivery for you. The fee stays the same.</p>
            </Spot>
          </StaggerItem>
        </Stagger>
      </section>

      {/* ============ ESCROW TIMELINE ============ */}
      <section className="relative border-y border-white/[0.06] bg-white/[0.012]">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-20 md:py-28">
          <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-12 lg:gap-20 items-start">
            <Reveal className="lg:sticky lg:top-28">
              <Eyebrow>Safety</Eyebrow>
              <h2 className="font-bold tracking-tight leading-[1.05] text-[clamp(2rem,3.8vw,3rem)]" style={display}>Your money is safe the whole way.</h2>
              <p className="mt-5 max-w-sm text-white/60 leading-relaxed text-[16.5px]">The student never gets paid until you say the work is right.</p>
            </Reveal>
            <div className="relative">
              <Stagger gap={0.18}>
                {FLOW.map(([t, d], i) => (
                  <StaggerItem key={t} className="group relative flex gap-6 pb-9 last:pb-0">
                    {/* connector to the next step: starts under this circle, ends at the next one, so the line stops at 4 */}
                    {i < FLOW.length - 1 && (
                      <>
                        <span aria-hidden className="absolute left-[19.5px] top-10 bottom-0 w-px bg-white/[0.1]" />
                        <motion.span
                          aria-hidden
                          initial={{ scaleY: 0 }}
                          whileInView={{ scaleY: 1 }}
                          viewport={{ once: true, margin: "-10%" }}
                          transition={{ duration: 0.7, delay: 0.25 + i * 0.35, ease: EASE_OUT }}
                          className="absolute left-[19.5px] top-10 bottom-0 w-px origin-top bg-gradient-to-b from-[var(--brand-purple)] to-[var(--brand-purple-soft)]"
                        />
                      </>
                    )}
                    <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[rgba(201,169,255,0.5)] bg-[var(--card-elevated)] text-[14px] font-bold text-[var(--brand-purple-soft)] transition-all duration-300 group-hover:scale-110 group-hover:bg-[var(--brand-purple)] group-hover:text-white">{i + 1}</span>
                    <div className="pt-1.5">
                      <h4 className="font-semibold text-[18px]" style={display}>{t}</h4>
                      <p className="mt-1 text-[15px] leading-relaxed text-white/55">{d}</p>
                    </div>
                  </StaggerItem>
                ))}
              </Stagger>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="faq" className="relative max-w-3xl mx-auto px-5 md:px-8 py-20 md:py-28 scroll-mt-20">
        <Reveal className="text-center mb-12">
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="font-bold tracking-tight text-[clamp(2rem,3.8vw,3rem)]" style={display}>Questions? Answered.</h2>
        </Reveal>
        <div className="space-y-3">
          {FAQS.map(([q, a], i) => {
            const open = openFaq === i;
            return (
              <div key={q} className={`rounded-2xl border transition-colors duration-300 ${open ? "border-[rgba(201,169,255,0.35)] bg-white/[0.04]" : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"}`}>
                <button onClick={() => setOpenFaq(open ? null : i)} aria-expanded={open} className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left">
                  <span className="font-semibold text-[18px]" style={display}>{q}</span>
                  <ChevronDown size={22} className={`shrink-0 transition-transform duration-300 ${open ? "rotate-180 text-[var(--brand-purple-soft)]" : "text-white/50"}`} />
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: EASE_OUT }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-6 text-white/65 leading-relaxed text-[16.5px] max-w-2xl">{a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="relative max-w-6xl mx-auto px-5 md:px-8 pb-20">
        <Reveal>
          <div className="relative rounded-[32px] border border-[rgba(201,169,255,0.25)] bg-[linear-gradient(135deg,#1c0f33_0%,var(--card)_55%,#150d26_100%)] overflow-hidden grid md:grid-cols-[1.25fr_0.75fr] items-center">
            <div aria-hidden className="lp-blob lp-blob-a -left-16 -bottom-24 h-80 w-80 bg-[rgba(136,37,245,0.3)]" />
            <div className="relative p-9 md:p-14 order-2 md:order-1">
              <h2 className="font-bold tracking-tight leading-[1.04] text-[clamp(2.1rem,4.2vw,3.2rem)]" style={display}>
                Ready to<br />get it done?
              </h2>
              <p className="text-white/65 mt-4 max-w-sm text-[16px] leading-relaxed">Post your first task in minutes, or start earning from your skills today. Every payment protected until you approve.</p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 max-w-md">
                <button onClick={goHire} className="lp-shine group px-8 py-4 rounded-full text-[17px] font-bold text-white bg-[var(--brand-purple)] hover:brightness-110 active:scale-[0.97] transition flex items-center justify-center gap-2.5">
                  I need work done <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
                </button>
                <button onClick={goEarn} className="px-8 py-4 rounded-full text-[17px] font-bold text-white/90 border border-white/15 hover:border-white/30 hover:bg-white/[0.06] active:scale-[0.97] transition">I want to earn</button>
              </div>
            </div>
            <div className="relative h-56 md:h-[340px] flex items-end justify-center order-1 md:order-2">
              <div className="relative w-52 h-52 md:w-72 md:h-72 animate-[float_8s_ease-in-out_infinite] -mb-1">
                <Image src="/hisloth.png" alt="DoItForMe sloth waving" fill className="object-contain" sizes="(max-width:768px) 208px, 288px" />
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="relative border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-14 grid md:grid-cols-[1.6fr_1fr_1fr] gap-10">
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              <div className="relative w-7 h-7"><Image src="/logo.png" alt="DoItForMe" fill className="object-contain" /></div>
              <span className="font-semibold text-base tracking-tight" style={display}>DoItForMe</span>
            </Link>
            <p className="text-white/40 text-[14px] mt-4 max-w-xs leading-relaxed">India&apos;s verified student workforce. Get work done, safely.</p>
            <div className="flex items-center gap-3 mt-5">
              <a href="https://www.linkedin.com/company/doitforme" target="_blank" rel="noreferrer" aria-label="LinkedIn" className="w-10 h-10 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-white/45 hover:text-white hover:border-[rgba(201,169,255,0.5)] hover:-translate-y-0.5 transition-all"><Linkedin size={16} /></a>
              <a href="https://www.instagram.com/doitforme.in" target="_blank" rel="noreferrer" aria-label="Instagram" className="w-10 h-10 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-white/45 hover:text-white hover:border-[rgba(201,169,255,0.5)] hover:-translate-y-0.5 transition-all"><Instagram size={16} /></a>
              <a href="mailto:doitforme.in@gmail.com" aria-label="Email" className="w-10 h-10 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-white/45 hover:text-white hover:border-[rgba(201,169,255,0.5)] hover:-translate-y-0.5 transition-all"><Mail size={16} /></a>
            </div>
          </div>
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35 mb-4">Platform</h4>
            <ul className="text-[14px]">
              <li><button onClick={() => scrollToSection("how")} className="inline-flex min-h-[40px] items-center text-white/50 hover:text-white transition-colors">How it works</button></li>
              <li><button onClick={() => scrollToSection("pricing")} className="inline-flex min-h-[40px] items-center text-white/50 hover:text-white transition-colors">Pricing</button></li>
              <li><Link href="/company/onboarding" className="inline-flex min-h-[40px] items-center text-white/50 hover:text-white transition-colors">Hire talent</Link></li>
              <li><Link href="/login" className="inline-flex min-h-[40px] items-center text-white/50 hover:text-white transition-colors">Start earning</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35 mb-4">Company</h4>
            <ul className="text-[14px]">
              <li><Link href="/about" className="inline-flex min-h-[40px] items-center text-white/50 hover:text-white transition-colors">About</Link></li>
              <li><Link href="/contact" className="inline-flex min-h-[40px] items-center text-white/50 hover:text-white transition-colors">Contact</Link></li>
              <li><Link href="/terms" className="inline-flex min-h-[40px] items-center text-white/50 hover:text-white transition-colors">Terms</Link></li>
              <li><Link href="/privacy-policy" className="inline-flex min-h-[40px] items-center text-white/50 hover:text-white transition-colors">Privacy</Link></li>
              <li><Link href="/refund-policy" className="inline-flex min-h-[40px] items-center text-white/50 hover:text-white transition-colors">Refunds</Link></li>
              <li><Link href="/shipping-policy" className="inline-flex min-h-[40px] items-center text-white/50 hover:text-white transition-colors">Delivery</Link></li>
              <li><Link href="/pricing" className="inline-flex min-h-[40px] items-center text-white/50 hover:text-white transition-colors">Pricing</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-6 border-t border-white/[0.06] text-[12px] text-white/35">
          © {new Date().getFullYear()} DoItForMe. Made for India&apos;s campuses.
          <span className="block mt-1 text-white/25">Operated by Lakshya Betala and Mouriyan Gandhi, Chennai, Tamil Nadu 600001, India.</span>
        </div>
      </footer>
    </div>
  );
}
