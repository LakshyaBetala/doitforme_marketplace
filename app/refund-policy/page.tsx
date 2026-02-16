"use client";

import Link from "next/link";
import { ArrowLeft, Receipt, RotateCcw, Scale, Banknote } from "lucide-react";

export default function RefundPolicy() {
  return (
    <div className="min-h-screen bg-[#020202] text-white selection:bg-[#8825F5] selection:text-white relative overflow-hidden">

      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-brand-purple/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[20%] w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12 md:py-20 relative z-10">

        {/* Header */}
        <div className="mb-12">
          <Link href="/" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white mb-8 transition-colors group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Back to Home</span>
          </Link>

          <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-500">
            Refund & Cancellation
          </h1>
          <p className="text-zinc-500 text-lg">
            Last updated: <span className="text-zinc-300">December 31, 2025</span>
          </p>
        </div>

        {/* Content Cards */}
        <div className="space-y-6">

          {/* Section 1: Platform Fees */}
          <section className="p-8 rounded-3xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                <Receipt size={20} />
              </div>
              <div className="w-full space-y-4">
                <h3 className="text-xl font-bold text-white">1. Platform Fees</h3>
                <p className="text-zinc-400 leading-relaxed">DoItForMe ensures fair pricing for students with a tiered structure:</p>

                <div className="grid md:grid-cols-2 gap-4 mt-2">
                  <div className="p-5 rounded-2xl bg-black/20 border border-white/5">
                    <strong className="block text-white mb-2 text-sm flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-pink-500"></span> Campus Market
                    </strong>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex justify-between"><span>Buy/Sell Items</span> <span className="text-white font-mono">0% (Free)</span></li>
                      <li className="flex justify-between"><span>Rentals</span> <span className="text-white font-mono">3% Fee</span></li>
                    </ul>
                  </div>
                  <div className="p-5 rounded-2xl bg-black/20 border border-white/5">
                    <strong className="block text-white mb-2 text-sm flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-brand-purple"></span> The Hustle
                    </strong>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex justify-between"><span>Standard Tier</span> <span className="text-white font-mono">10% Fee</span></li>
                      <li className="flex justify-between"><span>Pro Tier (&gt;10 Gigs)</span> <span className="text-white font-mono">7.5% Fee</span></li>
                    </ul>
                  </div>
                </div>
                <div className="pt-4 border-t border-white/5 mt-4">
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    <strong>Gateway Charges:</strong> Razorpay processes all payments. A fee of ~2% applies on deposits, paid to the gateway provider.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Refunds */}
          <section className="p-8 rounded-3xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-brand-purple shrink-0">
                <RotateCcw size={20} />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-white">2. Refunds for Posters</h3>
                <p className="text-zinc-400 leading-relaxed">
                  Funds are held in secure Escrow. You are eligible for a 100% refund to your wallet if:
                </p>
                <div className="grid gap-2">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                    <span className="text-sm text-zinc-300">You cancel before work starts</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                    <span className="text-sm text-zinc-300">Worker misses deadline</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                    <span className="text-sm text-zinc-300">Unsatisfactory work (verified by dispute)</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Disputes */}
          <section className="p-8 rounded-3xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0">
                <Scale size={20} />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-white">3. Dispute Resolution</h3>
                <p className="text-zinc-400 leading-relaxed">
                  If a disagreement arises, DoItForMe acts as the arbitrator. Email evidence (chat logs) to <span className="text-white hover:underline cursor-pointer">betala911@gmail.com</span>. We resolve disputes within 48 hours.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4: Withdrawals */}
          <section className="p-8 rounded-3xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500 shrink-0">
                <Banknote size={20} />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-white">4. Withdrawal Processing</h3>
                <p className="text-zinc-400 leading-relaxed">
                  Approved withdrawals are processed to your linked bank account within <strong className="text-white">5-7 business days</strong>.
                </p>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}