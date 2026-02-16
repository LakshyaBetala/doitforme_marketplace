"use client";

import Link from "next/link";
import { ArrowLeft, ScrollText, UserCheck, DollarSign, Ban, AlertTriangle } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#020202] text-white selection:bg-[#8825F5] selection:text-white relative overflow-hidden">

      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-brand-purple/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12 md:py-20 relative z-10">

        {/* Header */}
        <div className="mb-12">
          <Link href="/" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white mb-8 transition-colors group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Back to Home</span>
          </Link>

          <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-500">
            Terms & Conditions
          </h1>
          <p className="text-zinc-500 text-lg">
            Last updated: <span className="text-zinc-300">December 31, 2025</span>
          </p>
        </div>

        {/* Content Cards */}
        <div className="space-y-6">

          {/* Section 1: Introduction */}
          <section className="p-8 rounded-3xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                <ScrollText size={20} />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-white">1. Introduction</h3>
                <p className="text-zinc-400 leading-relaxed">
                  Welcome to DoItForMe. By using our website, you agree to comply with and be bound by the following terms. If you disagree with any part of these terms, please do not use our website.
                </p>
              </div>
            </div>
          </section>

          {/* Section 2: User Accounts */}
          <section className="p-8 rounded-3xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-brand-purple shrink-0">
                <UserCheck size={20} />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-white">2. User Accounts & KYC</h3>
                <p className="text-zinc-400 leading-relaxed">
                  To ensure safety, DoItForMe requires users to verify their identity using a valid Student ID. You are responsible for maintaining the confidentiality of your account and password.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3: Payments & Fees (Crucial Section) */}
          <section className="p-8 rounded-3xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500 shrink-0">
                <DollarSign size={20} />
              </div>
              <div className="w-full space-y-4">
                <h3 className="text-xl font-bold text-white">3. Payments & Fees</h3>
                <p className="text-zinc-400 leading-relaxed">We operate on a transparent, performance-based pricing model:</p>

                <div className="grid md:grid-cols-2 gap-4 mt-2">
                  <div className="p-5 rounded-2xl bg-black/20 border border-white/5">
                    <strong className="block text-white mb-2 text-sm flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-pink-500"></span> Campus Market
                    </strong>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex justify-between"><span>Buy/Sell</span> <span className="text-white font-mono">0% Fee</span></li>
                      <li className="flex justify-between"><span>Rentals</span> <span className="text-white font-mono">3% Escrow Fee</span></li>
                    </ul>
                  </div>
                  <div className="p-5 rounded-2xl bg-black/20 border border-white/5">
                    <strong className="block text-white mb-2 text-sm flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-brand-purple"></span> The Hustle (Services)
                    </strong>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex justify-between"><span>Standard (First 10 Gigs)</span> <span className="text-white font-mono">10% Fee</span></li>
                      <li className="flex justify-between"><span>Campus Pro (10+ Gigs)</span> <span className="text-white font-mono">7.5% Fee</span></li>
                    </ul>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <p className="text-xs text-zinc-500">
                    <strong>Payment Gateway:</strong> A standard processing fee (approx. 2%) is charged by Razorpay on deposits. This is non-refundable.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: Prohibited Activities */}
          <section className="p-8 rounded-3xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                <Ban size={20} />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-white">4. Prohibited Activities</h3>
                <p className="text-zinc-400">You agree not to use the platform for:</p>
                <ul className="grid sm:grid-cols-2 gap-2">
                  <li className="px-3 py-2 rounded-lg bg-white/5 text-xs text-zinc-300 border border-white/5">Illegal activities</li>
                  <li className="px-3 py-2 rounded-lg bg-white/5 text-xs text-zinc-300 border border-white/5">Academic dishonesty</li>
                  <li className="px-3 py-2 rounded-lg bg-white/5 text-xs text-zinc-300 border border-white/5">Harassment/Hate speech</li>
                  <li className="px-3 py-2 rounded-lg bg-white/5 text-xs text-zinc-300 border border-white/5">Fraudulent Gigs</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 5: Liability */}
          <section className="p-8 rounded-3xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-white">5. Limitation of Liability</h3>
                <p className="text-zinc-400 leading-relaxed">
                  DoItForMe is an intermediary platform. We are not responsible for the quality of work provided by other students. We do, however, offer a dispute resolution mechanism to protect your funds.
                </p>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}