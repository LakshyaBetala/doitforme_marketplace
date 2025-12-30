"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function RefundPolicy() {
  return (
    <div className="min-h-screen bg-[#0B0B11] text-white p-6 md:p-12 selection:bg-[#8825F5] selection:text-white">
      <Link href="/" className="flex items-center gap-2 text-white/50 hover:text-white mb-8 transition-colors w-fit group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Home
      </Link>

      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-black mb-2">Refund & Cancellation Policy</h1>
        <p className="text-white/40 mb-10 border-b border-white/10 pb-6">Last updated: December 31, 2025</p>

        <div className="space-y-8 text-white/80 leading-relaxed">
          <section>
            <h3 className="text-xl font-bold text-white mb-3">1. Platform Fees</h3>
            <p className="text-white/60">
              DoItForMe operates as a marketplace. To cover payment gateway charges and platform maintenance:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-white/60">
              <li><strong>Deposits:</strong> Razorpay may charge a standard processing fee (2-3%) when you add money. This is non-refundable.</li>
              <li><strong>Withdrawals:</strong> A flat <strong>10% platform fee</strong> is deducted from the total withdrawal amount when you transfer funds from your wallet to your bank account.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">2. Refunds for Posters (Task Creators)</h3>
            <p className="text-white/60">
              Funds are held in secure Escrow until the work is approved. You are eligible for a 100% refund to your DoItForMe Wallet if:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-white/60">
              <li>You cancel the gig <strong>before</strong> a worker has started working.</li>
              <li>The assigned worker fails to deliver the work within the deadline.</li>
              <li>The delivered work is unsatisfactory (subject to dispute review).</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">3. Dispute Resolution</h3>
            <p className="text-white/60">
              If a disagreement arises between a Poster and a Worker, DoItForMe serves as the final arbitrator. Please email evidence (screenshots, chat logs) to <span className="text-[#8825F5]">betala911@gmail.com</span>. We aim to resolve disputes within 48 hours.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">4. Withdrawal Processing</h3>
            <p className="text-white/60">
              Approved withdrawals are processed to your linked bank account within <strong>5-7 business days</strong>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}