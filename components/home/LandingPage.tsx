"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, ArrowUpRight, ChevronDown, Linkedin, Instagram, Mail,
  ClipboardList, UserCheck, ShieldCheck, ThumbsUp, Clock, BadgeCheck, IndianRupee, Users,
} from "lucide-react";
import { Reveal, Stagger, StaggerItem, CountUp } from "@/components/motion";
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
  ["01", "Design & branding", "Logos, decks, social, Canva, UI"],
  ["02", "Research & leads", "Market scans, lead lists, summaries"],
  ["03", "Presentations & docs", "Pitch decks, reports, proposals"],
  ["04", "Data & operations", "Entry, cleanup, testing, uploads"],
  ["05", "Coding & automation", "Scripts, fixes, small builds"],
  ["06", "Writing & content", "Articles, captions, scripts, edits"],
  ["07", "Tutoring & mentoring", "1:1 sessions, mock interviews, notes"],
];

const STEPS = [
  [ClipboardList, "Tell us what you need", "Write it in your own words and set a budget. Posting is free."],
  [UserCheck, "Pick a student", "Choose a verified student yourself, or let us choose one for you."],
  [ThumbsUp, "Pay only when happy", "We hold your money safely. You release it once the work is right."],
] as const;

const PROMISES = [
  [BadgeCheck, "Every student is ID-verified"],
  [ShieldCheck, "Your money is held until you approve"],
  [Clock, "24 hours to review the work"],
  [IndianRupee, "Posting a task is free"],
] as const;

const FAQS = [
  ["How does it work?", "Post a task for free. Pick a verified student yourself, or let DoItForMe assign one for you. We hold your payment and release it only once you approve the delivered work."],
  ["What are the fees?", "Posting is always free. A flat fee comes out of the worker's payout only when work is delivered: 5% for student-to-student tasks, 10% for business tasks, whether self-serve or fully managed."],
  ["Is my money safe?", "Yes. We hold your payment from the moment you pay, and the student is paid only after you approve. If something is wrong you can request changes or open a dispute, and the money stays held until it is resolved."],
  ["Who are the students?", "Every student is identity-verified before they can work, across school, college and university. You can see ratings, completion rate and skills before you hire."],
  ["What is Managed?", "If you would rather not run it yourself, DoItForMe assigns a vetted student, oversees the timeline, and reviews the work before it reaches you. The fee stays a flat 10%."],
];

export default function LandingPage() {
  const router = useRouter();

  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [loadingComplete, setLoadingComplete] = useState(false);
  const [isAssetReady, setIsAssetReady] = useState(false);
  const [shouldShowPreloader, setShouldShowPreloader] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

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

  const scrollToSection = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  const goEarn = () => router.push(userEmail ? "/dashboard" : "/login");
  const goHire = () => router.push("/company/onboarding");
  const isAdmin = userEmail === "betala911@gmail.com" || userEmail === "doitforme.in@gmail.com";

  const display = { fontFamily: "'Space Grotesk', sans-serif" } as const;

  return (
    <div className="min-h-screen bg-[var(--background)] text-white relative selection:bg-[var(--brand-purple)] selection:text-white font-sans overflow-x-hidden">
      <AnimatePresence>
        {shouldShowPreloader && !loadingComplete && (
          <Preloader isAssetReady={isAssetReady} onComplete={() => setLoadingComplete(true)} />
        )}
      </AnimatePresence>

      {/* ============ NAV ============ */}
      <header className={`sticky top-0 z-50 transition-colors duration-300 ${scrolled ? "bg-[var(--background)] backdrop-blur-xl border-b border-white/[0.06]" : ""}`}>
        <div className="max-w-6xl mx-auto px-5 md:px-8 h-[72px] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="relative w-9 h-9"><Image src="/logo.png" alt="DoItForMe" fill className="object-contain" priority /></div>
            <span className="font-bold text-xl tracking-tight" style={display}>DoItForMe</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-[15px] font-medium text-white/65">
            <button onClick={() => scrollToSection("work")} className="hover:text-white transition-colors">Work</button>
            <button onClick={() => scrollToSection("how")} className="hover:text-white transition-colors">How it works</button>
            <button onClick={() => scrollToSection("pricing")} className="hover:text-white transition-colors">Pricing</button>
            <button onClick={() => scrollToSection("faq")} className="hover:text-white transition-colors">FAQ</button>
            {isAdmin && <Link href="/admin" className="hover:text-white transition-colors">Admin</Link>}
          </nav>
          <div className="flex items-center gap-1">
            <button onClick={goEarn} className="text-[15px] font-semibold text-white/80 hover:text-white px-4 py-2.5 transition-colors">{userEmail ? "Dashboard" : "Log in"}</button>
            <button onClick={goHire} className="hidden sm:inline-flex text-[15px] font-semibold text-white bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 px-5 py-2.5 rounded-full transition active:scale-[0.97]">Get work done</button>
          </div>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section className="relative max-w-6xl mx-auto px-5 md:px-8 pt-12 md:pt-20 pb-16">
        <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[var(--accent-soft)] blur-[120px]" />
        <div className="relative grid lg:grid-cols-[1fr_400px] gap-10 items-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={loadingComplete ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] mb-7">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-purple-soft)]" />
              <span className="text-[12px] font-semibold tracking-[0.08em] text-white/70 uppercase">India&apos;s verified student workforce</span>
            </div>
            <h1 className="font-bold tracking-tight leading-[1.04] text-[clamp(2.5rem,5.2vw,4rem)]" style={{ ...display, textWrap: "balance" }}>
              Get any task done by <span className="text-[var(--brand-purple-soft)]">trusted students.</span>
            </h1>
            <p className="mt-6 text-[19px] text-white/70 leading-relaxed max-w-xl">
              Need a logo, a poster, a price list or some data typed up? Tell us what you need. A verified student does it, and you pay only when you are happy.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row gap-3.5 max-w-lg">
              <button onClick={goHire} className="group px-8 py-4 rounded-full text-[17px] font-bold text-white bg-[var(--brand-purple)] hover:brightness-110 active:scale-[0.97] transition flex items-center justify-center gap-2.5 shadow-[0_12px_32px_-12px_rgba(136,37,245,0.9)]">
                I need work done <ArrowRight size={19} className="transition-transform group-hover:translate-x-1" />
              </button>
              <button onClick={goEarn} className="px-8 py-4 rounded-full text-[17px] font-bold text-white/90 border border-white/15 hover:bg-white/[0.06] active:scale-[0.97] transition">
                I want to earn
              </button>
            </div>
          </motion.div>

          {/* Sloth with a soft radial glow, no hard shape */}
          <motion.div initial={{ opacity: 0 }} animate={loadingComplete ? { opacity: 1 } : {}} transition={{ duration: 0.8, delay: 0.2 }} className="relative hidden lg:flex items-center justify-center h-[440px]">
            <div className="absolute w-72 h-72 rounded-full bg-[var(--accent-soft)] blur-[90px]" />
            <div className="relative w-[330px] h-[430px] animate-[float_9s_ease-in-out_infinite]">
              <Image src="/slohero.png" alt="DoItForMe sloth" fill className="object-contain" priority />
            </div>
          </motion.div>
        </div>

        {/* Promises, as things you can see rather than a line of grey text. */}
        <Stagger immediate delay={0.35} className="relative mt-14 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PROMISES.map(([Icon, text]) => (
            <StaggerItem key={text} className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--brand-purple-soft)]">
                <Icon size={21} />
              </span>
              <span className="text-[14.5px] font-semibold leading-snug text-white/85">{text}</span>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section id="how" className="relative max-w-6xl mx-auto px-5 md:px-8 py-20 md:py-24 scroll-mt-20">
        <Reveal className="max-w-xl mb-12">
          <p className="text-[var(--brand-purple-soft)] text-[13px] font-semibold tracking-[0.12em] uppercase mb-4">How it works</p>
          <h2 className="font-bold tracking-tight leading-[1.05] text-[clamp(2rem,3.6vw,2.9rem)]" style={display}>Three easy steps. No risk.</h2>
        </Reveal>
        <Stagger className="grid md:grid-cols-3 gap-5" gap={0.12}>
          {STEPS.map(([Icon, t, d], i) => (
            <StaggerItem key={t} className="card-lift relative rounded-3xl border border-white/[0.08] bg-[var(--card)] p-8">
              <span className="absolute right-6 top-5 text-[64px] font-bold leading-none text-white/[0.05]" style={display}>{i + 1}</span>
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--brand-purple-soft)]">
                <Icon size={26} />
              </span>
              <h3 className="font-bold text-[21px] mt-6" style={display}>{t}</h3>
              <p className="text-white/60 text-[16px] mt-2.5 leading-relaxed">{d}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ============ WORK (editorial list) ============ */}
      <section id="work" className="relative max-w-6xl mx-auto px-5 md:px-8 py-20 md:py-24 scroll-mt-20">
        <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-12 lg:gap-20">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <p className="text-[var(--brand-purple-soft)] text-[13px] font-semibold tracking-[0.12em] uppercase mb-4">Real deliverables</p>
            <h2 className="font-bold tracking-tight leading-[1.05] text-[clamp(1.9rem,3.5vw,2.8rem)]" style={display}>
              Not errands.<br />Actual work.
            </h2>
            <p className="text-white/65 mt-5 max-w-sm leading-relaxed text-[17px]">From a logo by tonight to a clean price list by Friday. These are just the popular ones. If you can describe it, a verified student can probably do it.</p>
          </Reveal>

          <Stagger gap={0.05}>
            {CATEGORIES.map(([num, title, desc], i) => (
              <StaggerItem key={num}>
              <button onClick={goHire} className={`group w-full text-left flex items-center gap-6 py-6 ${i === 0 ? "border-t" : ""} border-b border-white/[0.07] transition-[padding] duration-300 hover:pl-3`}>
                <span className="text-[13px] font-mono text-white/30 tabular-nums">{num}</span>
                <div className="flex-1">
                  <h3 className="text-xl md:text-[22px] font-semibold tracking-tight group-hover:text-[var(--brand-purple-soft)] transition-colors" style={display}>{title}</h3>
                  <p className="text-white/55 text-[15.5px] mt-1">{desc}</p>
                </div>
                <ArrowUpRight size={22} className="text-white/25 group-hover:text-white/80 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
              </button>
              </StaggerItem>
            ))}
            {/* Open-ended capstone: signals the list is examples, not a closed menu */}
            <StaggerItem>
            <button onClick={goHire} className="group w-full text-left flex items-center gap-6 py-6 border-b border-white/[0.07] transition-[padding] duration-300 hover:pl-3">
              <span className="text-[13px] font-mono text-[var(--accent-ink)] tabular-nums">08</span>
              <div className="flex-1">
                <h3 className="text-xl md:text-[22px] font-semibold tracking-tight text-[var(--brand-purple-soft)]" style={display}>Anything else</h3>
                <p className="text-white/55 text-[15.5px] mt-1">Describe your task, name a budget, and the right student finds it.</p>
              </div>
              <ArrowUpRight size={22} className="text-[var(--accent-ink)] group-hover:text-[var(--brand-purple-soft)] transition-colors shrink-0" />
            </button>
            </StaggerItem>
          </Stagger>
        </div>
      </section>

      {/* ============ MANAGED (subtle tinted card) ============ */}
      <Reveal as="section" className="relative max-w-6xl mx-auto px-5 md:px-8 py-10">
        <div className="relative rounded-3xl border border-white/[0.08] bg-[var(--card)] overflow-hidden grid md:grid-cols-[1.4fr_0.6fr] items-center">
          <div className="absolute -left-20 -top-20 w-72 h-72 rounded-full bg-[var(--accent-soft)] blur-[100px] pointer-events-none" />
          <div className="relative p-8 md:p-12">
            <p className="text-[var(--brand-purple-soft)] text-[12px] font-semibold tracking-[0.12em] uppercase mb-4">DoItForMe Managed</p>
            <h2 className="font-bold tracking-tight leading-[1.06] text-[clamp(1.8rem,3.2vw,2.6rem)]" style={display}>
              Prefer not to manage it? We will.
            </h2>
            <p className="text-white/65 mt-4 max-w-md leading-relaxed text-[17px]">
              One click and DoItForMe assigns a vetted student, runs the timeline, and reviews the work before it reaches you. You deal with us, never a stranger. The fee stays a flat 10%.
            </p>
            <button onClick={goHire} className="mt-7 inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-[16px] font-bold active:scale-[0.97] transition text-white bg-[var(--brand-purple)] hover:brightness-110 transition">
              Let us handle it <ArrowRight size={15} />
            </button>
          </div>
          <div className="relative h-48 md:h-64 flex items-center justify-center">
            <div className="relative w-40 h-40 md:w-52 md:h-52 animate-[float_8s_ease-in-out_infinite]">
              <Image src="/tasksloth.png" alt="" fill className="object-contain" sizes="208px" />
            </div>
          </div>
        </div>
      </Reveal>

      {/* ============ EARN (subtle card) ============ */}
      <Reveal as="section" className="relative max-w-6xl mx-auto px-5 md:px-8 py-10">
        <div className="rounded-3xl border border-white/[0.08] bg-[var(--card)] grid md:grid-cols-[0.55fr_1.45fr] items-center overflow-hidden">
          <div className="relative h-48 md:h-64 flex items-center justify-center order-2 md:order-1">
            <div className="relative w-40 h-40 md:w-48 md:h-48 animate-[float_8s_ease-in-out_infinite]">
              <Image src="/moneysloth.png" alt="" fill className="object-contain" sizes="192px" />
            </div>
          </div>
          <div className="p-8 md:p-12 order-1 md:order-2">
            <p className="text-[var(--brand-purple-soft)] text-[12px] font-semibold tracking-[0.12em] uppercase mb-4">For students</p>
            <h2 className="font-bold tracking-tight leading-[1.06] text-[clamp(1.8rem,3.2vw,2.6rem)]" style={display}>
              Turn your skills into income.
            </h2>
            <p className="text-white/65 mt-4 max-w-md leading-relaxed text-[17px]">
              Get verified once, then take on tasks that match what you are good at. Deliver, get approved, and the payout lands in your UPI. A flat 5 to 10% fee, nothing hidden.
            </p>
            <button onClick={goEarn} className="mt-7 inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-[16px] font-bold active:scale-[0.97] transition text-white border border-white/12 hover:bg-white/[0.04] transition">
              Start earning <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </Reveal>

      {/* ============ PRICING ============ */}
      <section id="pricing" className="relative max-w-6xl mx-auto px-5 md:px-8 py-20 md:py-24 scroll-mt-20">
        <div className="max-w-xl mb-12">
          <p className="text-[var(--brand-purple-soft)] text-[12px] font-semibold tracking-[0.12em] uppercase mb-4">Pricing</p>
          <h2 className="font-bold tracking-tight leading-[1.05] text-[clamp(1.9rem,3.5vw,2.8rem)]" style={display}>One flat fee. Nothing hidden.</h2>
          <p className="text-white/55 mt-4 text-[15px]">Posting is free. The fee comes out of the payout, only when work is delivered and approved.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/[0.08] bg-[var(--card)] p-8">
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold tracking-tight" style={display}>5%</span>
              <h3 className="text-[15px] font-medium text-white/70">Student economy</h3>
            </div>
            <p className="text-white/45 mt-4 leading-relaxed text-[14px]">Students helping students. Tutoring, decks, design, coding help. The lowest fee, payment protected end to end.</p>
          </div>
          <div className="rounded-2xl border border-[var(--accent-line)] bg-[var(--card)] p-8">
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold tracking-tight text-[var(--brand-purple-soft)]" style={display}>10%</span>
              <h3 className="text-[15px] font-medium text-white/70">Business work</h3>
            </div>
            <p className="text-white/45 mt-4 leading-relaxed text-[14px]">Company tasks, self-serve or fully managed. We can assign and review the delivery for you. The fee stays the same.</p>
          </div>
        </div>
      </section>

      {/* ============ ESCROW TIMELINE ============ */}
      <section className="relative border-y border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-20 md:py-24">
          <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-12 lg:gap-20 items-start">
            <div className="lg:sticky lg:top-28">
              <p className="text-[var(--brand-purple-soft)] text-[12px] font-semibold tracking-[0.12em] uppercase mb-4">Safety</p>
              <h2 className="font-bold tracking-tight leading-[1.05] text-[clamp(1.9rem,3.5vw,2.8rem)]" style={display}>Your money is safe the whole way.</h2>
            </div>
            <div className="relative pl-2">
              <div className="absolute left-[15px] top-3 bottom-3 w-px bg-white/[0.08]" />
              {[
                ["You pay", "We hold the payment until you approve the work."],
                ["Work is delivered", "The student submits and explains exactly what was done."],
                ["You review for 24 hours", "Approve it, request changes, or open a dispute."],
                ["Money is released", "Only on your approval does the payout go out."],
              ].map(([t, d], i) => (
                <div key={t} className="relative flex gap-5 pb-8 last:pb-0">
                  <span className="relative z-10 shrink-0 w-8 h-8 rounded-full bg-[var(--card-elevated)] border border-[var(--accent-line)] flex items-center justify-center text-[12px] font-semibold text-[var(--brand-purple-soft)]">{i + 1}</span>
                  <div className="pt-1">
                    <h4 className="font-semibold text-[16px]" style={display}>{t}</h4>
                    <p className="text-white/45 text-[14px] mt-0.5 leading-relaxed">{d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="faq" className="relative max-w-3xl mx-auto px-5 md:px-8 py-20 md:py-24 scroll-mt-20">
        <Reveal><h2 className="font-bold tracking-tight text-center text-[clamp(2rem,3.6vw,2.7rem)] mb-12" style={display}>Questions? Answered.</h2></Reveal>
        <div className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
          {FAQS.map(([q, a], i) => (
            <div key={q}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i} className="w-full flex items-center justify-between gap-4 py-6 text-left">
                <span className="font-semibold text-[18px]" style={display}>{q}</span>
                <ChevronDown size={22} className={`shrink-0 text-white/50 transition-transform duration-300 ${openFaq === i ? "rotate-180 text-[var(--brand-purple-soft)]" : ""}`} />
              </button>
              <AnimatePresence initial={false}>
                {openFaq === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
                    className="overflow-hidden"
                  >
                    <p className="pb-7 text-white/65 leading-relaxed text-[16.5px] max-w-2xl">{a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </section>

      {/* ============ FINAL CTA (asymmetric, mascot-forward) ============ */}
      <section className="relative max-w-6xl mx-auto px-5 md:px-8 pb-20">
        <div className="relative rounded-3xl border border-white/[0.08] bg-[var(--card)] overflow-hidden grid md:grid-cols-[1.25fr_0.75fr] items-center">
          <div className="absolute -left-16 -bottom-24 w-80 h-80 rounded-full bg-[var(--accent-soft)] blur-[110px] pointer-events-none" />
          <div className="relative p-9 md:p-14 order-2 md:order-1">
            <p className="text-[var(--brand-purple-soft)] text-[12px] font-semibold tracking-[0.12em] uppercase mb-4">Get started</p>
            <h2 className="font-bold tracking-tight leading-[1.04] text-[clamp(2rem,4vw,3.1rem)]" style={display}>
              Ready to<br />get it done?
            </h2>
            <p className="text-white/55 mt-4 max-w-sm text-[15px] leading-relaxed">Post your first task in minutes, or start earning from your skills today. Every payment protected until you approve.</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 max-w-md">
              <button onClick={goHire} className="group px-8 py-4 rounded-full text-[17px] font-bold text-white bg-[var(--brand-purple)] hover:brightness-110 active:scale-[0.97] transition flex items-center justify-center gap-2.5">
                I need work done <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </button>
              <button onClick={goEarn} className="px-8 py-4 rounded-full text-[17px] font-bold text-white/90 border border-white/15 hover:bg-white/[0.06] active:scale-[0.97] transition">I want to earn</button>
            </div>
          </div>
          <div className="relative h-56 md:h-[340px] flex items-end justify-center order-1 md:order-2">
            <div className="absolute w-56 h-56 rounded-full bg-[var(--accent-soft)] blur-[80px]" />
            <div className="relative w-52 h-52 md:w-72 md:h-72 animate-[float_8s_ease-in-out_infinite] -mb-1">
              <Image src="/hisloth.png" alt="DoItForMe sloth waving" fill className="object-contain" sizes="(max-width:768px) 208px, 288px" />
            </div>
          </div>
        </div>
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
              <a href="https://www.linkedin.com/company/doitforme" target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-white/45 hover:text-white transition-colors"><Linkedin size={15} /></a>
              <a href="https://www.instagram.com/doitforme.in" target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-white/45 hover:text-white transition-colors"><Instagram size={15} /></a>
              <a href="mailto:doitforme.in@gmail.com" className="w-9 h-9 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-white/45 hover:text-white transition-colors"><Mail size={15} /></a>
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
