"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";

// -------------------------------------------------------
// UTILITIES & HOOKS
// -------------------------------------------------------

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
// GEN-Z LANDING PAGE (TIMBUCKDO INSPIRED - DARK MODE)
// -------------------------------------------------------

export default function HomePage() {
  const scrollY = useScrollPosition();
  const [faqTab, setFaqTab] = useState<"students" | "posters">("students");
  const [openFaq, setOpenFaq] = useState<Record<number, boolean>>({});
  
  // --- CUSTOM SWINGING CURSOR LOGIC START ---
  const cursorContainerRef = useRef<HTMLDivElement>(null);
  const slothSwingerRef = useRef<HTMLDivElement>(null);
  
  // Physics State Refs (using refs instead of state for 60fps performance)
  const mousePos = useRef({ x: 0, y: 0 });
  const prevMouseX = useRef(0);
  const angle = useRef(0);
  const velocity = useRef(0);

  useEffect(() => {
    // 1. Track Mouse Position & Calculate Momentum
    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
      
      // Calculate how fast we moved horizontally
      const dx = e.clientX - prevMouseX.current;
      prevMouseX.current = e.clientX;

      // Add "impulse" to swing velocity based on movement.
      const impulse = dx * 0.1; // Reduced sensitivity for smoother swing
      velocity.current += impulse;
    };

    window.addEventListener("mousemove", handleMouseMove);

    // 2. Physics Animation Loop (Real Pendulum Physics)
    let animationFrameId: number;
    const animate = () => {
      // Physics Constants
      const gravity = 0.4;     // Reduced gravity
      const friction = 0.92;   // Smoother friction

      // Convert current angle to radians for physics calculation
      const radians = angle.current * (Math.PI / 180);

      // Apply Gravity (Pendulum Logic: sin(angle) allows full 360 rotation)
      const gravityForce = -gravity * Math.sin(radians);
      
      velocity.current += gravityForce;
      velocity.current *= friction;  // Apply friction
      angle.current += velocity.current; // Update angle

      // Apply to DOM
      if (cursorContainerRef.current && slothSwingerRef.current) {
        // Move entire container to mouse (Translate)
        cursorContainerRef.current.style.transform = `translate3d(${mousePos.current.x}px, ${mousePos.current.y}px, 0)`;
        
        // Rotate inner container (Swing)
        slothSwingerRef.current.style.transform = `rotate(${angle.current}deg)`;
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate(); // Start the loop

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);
  // --- CUSTOM SWINGING CURSOR LOGIC END ---


  const toggleFAQ = (i: number) =>
    setOpenFaq((prev) => ({ ...prev, [i]: !prev[i] }));

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) element.scrollIntoView({ behavior: "smooth" });
  };

  return (
    // MAIN CONTAINER - Uses the Dark Theme from globals.css
    // ADDED CLASS: 'use-sloth-cursor' to apply cursor hiding only on this page
    <div className="min-h-screen bg-[#0B0B11] text-white overflow-x-hidden relative selection:bg-[#8825F5] selection:text-white use-sloth-cursor">
      
      {/* -------------------------------------------------------
          CUSTOM SWINGING SLOTH CURSOR (Desktop Only)
      --------------------------------------------------------- */}
      <div 
        ref={cursorContainerRef}
        // -ml-8 and -mt-2 center the pivot point relative to the mouse pointer
        className="fixed top-0 left-0 pointer-events-none z-[9999] hidden lg:block will-change-transform -ml-8 -mt-2 mix-blend-normal"
      >
        {/* Inner container rotates around the top-center (like holding a branch) */}
        <div 
          ref={slothSwingerRef}
          className="relative w-16 h-16 origin-[top_center] will-change-transform"
        >
           <Image 
             src="/sloth.png" 
             alt="Swinging Sloth" 
             fill 
             className="object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
             priority
           />
        </div>
      </div>

      {/* -------------------------------------------------------
          NAVBAR — Floating Glass
      --------------------------------------------------------- */}
      <header className={`fixed z-50 w-full top-0 left-0 transition-all duration-300 ${scrollY > 50 ? "bg-[#0B0B11]/80 backdrop-blur-xl border-b border-white/10" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10 transition-transform duration-300 group-hover:rotate-12">
              <Image src="/logo.svg" alt="logo" fill sizes="40px" />
            </div>
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              DoItForMe
            </span>
          </Link>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-8">
            <button 
              onClick={() => scrollToSection('how-it-works')} 
              className="text-sm font-medium text-white/70 hover:text-[#8825F5] transition-colors"
            >
              How it works
            </button>
            <button 
              onClick={() => scrollToSection('faq')} 
              className="text-sm font-medium text-white/70 hover:text-[#0097FF] transition-colors"
            >
              FAQ
            </button>
          </nav>

          <Link
            href="/login"
            className="px-6 py-2 rounded-full font-bold text-white shadow-lg 
              bg-gradient-to-r from-[#7D5FFF] to-[#6F9CFF] hover:scale-105
              transition-all duration-200 shadow-[#7D5FFF]/30"
          >
            Login
          </Link>
        </div>
      </header>

      {/* -------------------------------------------------------
          BACKGROUND ATMOSPHERE
      --------------------------------------------------------- */}
      <BackgroundBlobs />

      {/* -------------------------------------------------------
          HERO SECTION
      --------------------------------------------------------- */}
      <section className="pt-40 pb-20 relative max-w-7xl mx-auto px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        
        {/* Left — Hero Text */}
        <div className="flex flex-col justify-center relative z-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 w-fit mb-6">
            <span className="animate-pulse w-2 h-2 rounded-full bg-[#0097FF]"></span>
            <span className="text-xs font-bold tracking-wide text-[#0097FF] uppercase">India's Only Student Marketplace</span>
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.1] tracking-tight">
            Students <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8825F5] to-[#D31CE7]">Helping</span> <br />
            Students.
          </h1>

          <p className="mt-6 text-lg text-white/60 leading-relaxed max-w-lg">
            Outsource tasks. Earn from free time. Assignments, errands, projects — handled by verified students.
          </p>

          <div className="mt-8 flex items-center gap-4">
            <CTAButton />
            <div className="text-xs text-white/40 flex flex-col">
              <span>🔒 Verified IDs only</span>
              <span>⚡ Fast & Safe</span>
            </div>
          </div>

          {/* Stats / Social Proof */}
          <div className="mt-12 flex gap-8 border-t border-white/10 pt-8">
            <div>
              <h3 className="text-2xl font-bold text-white">100%</h3>
              <p className="text-sm text-white/40">Verified IDs</p>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white">Escrow</h3>
              <p className="text-sm text-white/40">Payment Protection</p>
            </div>
             <div>
              <h3 className="text-2xl font-bold text-white">Beta</h3>
              <p className="text-sm text-white/40">Early Access</p>
            </div>
          </div>
        </div>

        {/* Right — Sloth Card (Parallax) */}
        <div
          className="relative flex justify-center items-center"
          style={{ transform: `translateY(${scrollY * 0.1}px)` }}
        >
          <SlothParallaxCard />
        </div>
      </section>

      {/* -------------------------------------------------------
          INFINITE TICKER (TIMBUCKDO STYLE)
      --------------------------------------------------------- */}
      <div className="w-full bg-[#8825F5] -rotate-1 overflow-hidden py-3 mb-20 border-y-4 border-black">
        <div className="animate-marquee whitespace-nowrap flex gap-10">
          {[...Array(10)].map((_, i) => (
             <span key={i} className="text-xl font-black italic text-white uppercase mx-4">
               ASSIGNMENTS • ERRANDS • PROJECTS • CASH • SKILLS •
             </span>
          ))}
        </div>
      </div>

      {/* -------------------------------------------------------
          FEATURES (Bento Grid Style)
      --------------------------------------------------------- */}
      <section className="max-w-7xl mx-auto px-6 mb-24">
        <div className="grid md:grid-cols-3 gap-6">
          <FeatureCard
            title="Outsource tasks"
            desc="Students complete it for you."
            emoji="✨"
            color="bg-gradient-to-br from-[#8825F5]/20 to-transparent"
          />
          <FeatureCard
            title="Turn time to cash"
            desc="Earn during gap hours."
            emoji="💸"
            color="bg-gradient-to-br from-[#0097FF]/20 to-transparent"
          />
          <FeatureCard
            title="Earn while you learn"
            desc="Work + skills + income."
            emoji="📚"
            color="bg-gradient-to-br from-[#D31CE7]/20 to-transparent"
          />
        </div>
      </section>

      {/* -------------------------------------------------------
          HOW IT WORKS (Scroll Target)
      --------------------------------------------------------- */}
      <section id="how-it-works" className="py-20 max-w-6xl mx-auto px-6 bg-white/5 rounded-[3rem] border border-white/5">
        <div className="text-center mb-16">
           <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">How it works</h2>
           <p className="text-white/50">Simple, safe, and student-friendly.</p>
        </div>
        
        <div className="grid sm:grid-cols-3 gap-8 relative">
           {/* Connecting Line */}
           <div className="hidden md:block absolute top-12 left-0 w-full h-1 bg-gradient-to-r from-[#8825F5] via-[#D31CE7] to-[#0097FF] opacity-30"></div>
           
          <StepCard
            number={1}
            title="Login"
            desc="Create your student account with valid ID."
            icon="👤"
          />
          <StepCard
            number={2}
            title="Post or Apply"
            desc="Get tasks done or earn from them."
            icon="📝"
          />
          <StepCard
            number={3}
            title="Escrow Payment"
            desc="Funds are held safely until work is approved."
            icon="🔒"
          />
        </div>
      </section>

      {/* -------------------------------------------------------
          STUDENT STORIES
      --------------------------------------------------------- */}
      <section className="py-24 max-w-6xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-white mb-10 pl-4 border-l-4 border-[#D31CE7]">Student Stories</h2>

        <div className="grid sm:grid-cols-3 gap-6">
          <Testimonial role="Poster" quote="Got my project done overnight!" color="border-[#8825F5]" />
          <Testimonial role="Worker" quote="Earned ₹2000 last week from free hours!" color="border-[#0097FF]" />
          <Testimonial
            role="Busy Student"
            quote="Perfect for students with tight schedules."
            color="border-[#D31CE7]"
          />
        </div>
      </section>

      {/* -------------------------------------------------------
          FAQ (Scroll Target)
      --------------------------------------------------------- */}
      <section id="faq" className="mb-20 max-w-4xl mx-auto px-6">
        <div className="text-center mb-10">
           <h2 className="text-4xl font-bold text-white mb-6">FAQ</h2>
           <FAQTabs faqTab={faqTab} setFaqTab={setFaqTab} />
        </div>

        <div className="space-y-4">
          {(faqTab === "students"
            ? studentFaq
            : posterFaq
          ).map((f, i) => (
            <FAQItem
              key={i}
              i={i}
              question={f.q}
              answer={f.a}
              open={openFaq[i]}
              toggle={toggleFAQ}
            />
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------
          FOOTER
      --------------------------------------------------------- */}
      <Footer />
    </div>
  );
}

// -------------------------------------------------------
// SUB-COMPONENTS
// -------------------------------------------------------

function BackgroundBlobs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      <div className="absolute w-[40rem] h-[40rem] bg-[#8825F5]/20 blur-[100px] rounded-full -top-40 -left-40 animate-blob" />
      <div className="absolute w-[30rem] h-[30rem] bg-[#0097FF]/20 blur-[100px] rounded-full top-[30%] -right-20 animate-blob animation-delay-2000" />
      <div className="absolute w-[26rem] h-[26rem] bg-[#D31CE7]/10 blur-[100px] rounded-full bottom-0 left-1/2 transform -translate-x-1/2 animate-blob animation-delay-4000" />
    </div>
  );
}

function CTAButton() {
  return (
    <Link
      href="/login"
      className="relative inline-flex items-center justify-center px-8 py-4 
        rounded-full font-bold text-lg text-white
        bg-gradient-to-r from-[#8825F5] to-[#0097FF]
        shadow-[0_0_20px_rgba(136,37,245,0.4)]
        transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(0,151,255,0.6)]"
    >
      Login to Continue
    </Link>
  );
}

function SlothParallaxCard() {
  return (
    <div className="relative bg-white/5 rounded-3xl p-10 border border-white/10 backdrop-blur-md hover:border-[#8825F5]/50 transition-colors duration-500">
      <div className="absolute -inset-1 bg-gradient-to-r from-[#8825F5] to-[#0097FF] rounded-3xl blur opacity-20"></div>
      <div className="w-64 h-64 mx-auto relative z-10">
        <Image src="/logo.svg" alt="Sloth" fill sizes="256px" className="drop-shadow-2xl animate-float" />
      </div>
      <p className="text-center text-white/80 mt-6 font-mono text-sm tracking-widest uppercase">
        Peer-to-peer • Safe • Fast
      </p>
    </div>
  );
}

function FeatureCard({ title, desc, emoji, color }: any) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-6 border border-white/10 hover:-translate-y-2 transition-all duration-300 group ${color}`}
    >
      <div className="text-4xl mb-4 grayscale group-hover:grayscale-0 transition-all duration-300">{emoji}</div>
      <h3 className="text-xl font-bold text-white">{title}</h3>
      <p className="text-sm text-white/60 mt-2">{desc}</p>
    </div>
  );
}

function StepCard({ number, title, desc, icon }: any) {
  return (
    <div className="relative bg-[#0B0B11] border border-white/10 rounded-2xl p-8 z-10 hover:border-[#8825F5] transition-colors duration-300">
      <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#8825F5] to-[#0097FF] flex items-center justify-center text-white font-bold text-xl mb-6 shadow-lg">
        {number}
      </div>
      <h4 className="text-xl font-bold text-white mb-2">{title}</h4>
      <p className="text-white/60">{desc}</p>
      <div className="absolute top-6 right-6 text-3xl opacity-20">{icon}</div>
    </div>
  );
}

function Testimonial({ role, quote, color = "border-white/10" }: any) {
  return (
    <div
      className={`bg-white/5 border-l-4 ${color} backdrop-blur-md rounded-r-xl p-6 hover:bg-white/10 transition-colors duration-300`}
    >
      <div className="text-xs text-[#0097FF] font-bold uppercase tracking-wide">{role}</div>
      <div className="mt-3 font-medium text-white text-lg leading-snug">“{quote}”</div>
      <div className="mt-4 flex items-center gap-2">
         <div className="w-2 h-2 rounded-full bg-green-500"></div>
         <span className="text-xs text-white/40">Verified student</span>
      </div>
    </div>
  );
}

function FAQTabs({ faqTab, setFaqTab }: any) {
  return (
    <div className="inline-flex bg-white/5 rounded-full p-1 border border-white/10">
      <button
        onClick={() => setFaqTab("students")}
        className={`px-8 py-2 rounded-full text-sm font-bold transition-all duration-300
          ${faqTab === "students" ? "bg-[#8825F5] text-white shadow-lg" : "text-white/60 hover:text-white"}`}
      >
        Students
      </button>
      <button
        onClick={() => setFaqTab("posters")}
        className={`px-8 py-2 rounded-full text-sm font-bold transition-all duration-300
          ${faqTab === "posters" ? "bg-[#0097FF] text-white shadow-lg" : "text-white/60 hover:text-white"}`}
      >
        Posters
      </button>
    </div>
  );
}

function FAQItem({ question, answer, open, toggle, i }: any) {
  return (
    <div className={`border border-white/10 rounded-xl overflow-hidden transition-all duration-300 ${open ? 'bg-white/5' : 'bg-transparent'}`}>
      <button
        onClick={() => toggle(i)}
        className="w-full flex items-center justify-between p-6 text-left"
      >
        <span className="font-bold text-white text-lg">{question}</span>
        <span className={`text-[#8825F5] text-2xl transition-transform duration-300 ${open ? "rotate-45" : "rotate-0"}`}>+</span>
      </button>
      <div className={`px-6 overflow-hidden transition-all duration-300 ${open ? 'max-h-40 pb-6' : 'max-h-0'}`}>
        <p className="text-white/60 leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="w-full bg-[#06060A] py-16 border-t border-white/10 relative z-10">
      <div className="max-w-6xl mx-auto px-6 grid sm:grid-cols-4 gap-12">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="relative w-8 h-8">
              <Image src="/logo.svg" alt="logo" fill />
            </div>
            <span className="font-bold text-xl text-white">DoItForMe</span>
          </div>
          <p className="text-sm text-white/40">Student-first marketplace.</p>
        </div>

        <div>
          <h4 className="font-bold text-white mb-4">Platform</h4>
          <ul className="text-sm text-white/60 space-y-2">
            <li><Link href="/login" className="hover:text-[#8825F5] cursor-pointer transition-colors">Login</Link></li>
            <li><Link href="/#how-it-works" className="hover:text-[#8825F5] cursor-pointer transition-colors">How it works</Link></li>
            <li><Link href="/#faq" className="hover:text-[#8825F5] cursor-pointer transition-colors">FAQ</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-white mb-4">Legal</h4>
          <ul className="text-sm text-white/60 space-y-2">
            <li><Link href="/terms" className="hover:text-[#8825F5] cursor-pointer transition-colors">Terms & Conditions</Link></li>
            <li><Link href="/privacy-policy" className="hover:text-[#8825F5] cursor-pointer transition-colors">Privacy Policy</Link></li>
            <li><Link href="/refund-policy" className="hover:text-[#8825F5] cursor-pointer transition-colors">Refund Policy</Link></li>
          </ul>
        </div>  

        <div>
          <h4 className="font-bold text-white mb-4">Contact</h4>
          <ul className="text-sm text-white/60 space-y-2">
             <li><Link href="/contact" className="hover:text-[#8825F5] cursor-pointer transition-colors">Contact Us</Link></li>
             <li className="text-white/40">betala911@gmail.com</li>
          </ul>
        </div>
      </div>
      <div className="mt-12 text-center text-white/20 text-xs">
        © 2025 DoItForMe. All rights reserved. Made in Chennai.
      </div>
    </footer>
  );
}

// -------------------------------------------------------
// STATIC DATA
// -------------------------------------------------------
const studentFaq = [
  { q: "How do I earn?", a: "Browse gigs, apply, complete tasks and get paid securely." },
  { q: "Is verification required?", a: "Yes — student ID verification ensures safety." },
  { q: "How do payments work?", a: "Funds are held in Escrow and released only after you complete the work." },
];

const posterFaq = [
  { q: "How do I post a task?", a: "Login, add details, set price, and post." },
  { q: "Is my money safe?", a: "Yes, we use Escrow. If the work isn't done, you get a refund." },
  { q: "What about refunds?", a: "You can request a refund if the worker fails to deliver. 10% platform fee applies on withdrawals." },
];