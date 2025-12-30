"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0B0B11] text-white p-6 md:p-12 selection:bg-[#8825F5] selection:text-white">
      <Link href="/" className="flex items-center gap-2 text-white/50 hover:text-white mb-8 transition-colors w-fit group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Home
      </Link>

      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-black mb-2">Terms & Conditions</h1>
        <p className="text-white/40 mb-10 border-b border-white/10 pb-6">Last updated: December 31, 2025</p>

        <div className="space-y-8 text-white/80 leading-relaxed">
          <section>
            <h3 className="text-xl font-bold text-white mb-3">1. Introduction</h3>
            <p className="text-white/60">
              Welcome to DoItForMe. By using our website, you agree to comply with and be bound by the following terms. If you disagree with any part of these terms, please do not use our website.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">2. User Accounts & KYC</h3>
            <p className="text-white/60">
              To ensure safety, DoItForMe requires users to verify their identity using a valid Student ID. You are responsible for maintaining the confidentiality of your account and password.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">3. Payments & Fees</h3>
            <p className="text-white/60">
              We use Razorpay for secure payment processing. 
              <br/>
              - <strong>Escrow:</strong> Funds are held safely until the task is marked complete.
              <br/>
              - <strong>Withdrawal Fee:</strong> A 10% service fee applies to all wallet withdrawals.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">4. Prohibited Activities</h3>
            <p className="text-white/60">
              You agree not to use the platform for:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-white/60">
              <li>Illegal activities or promoting illegal acts.</li>
              <li>Academic dishonesty (e.g., impersonation in exams).</li>
              <li>Harassment or hate speech.</li>
            </ul>
          </section>
          
          <section>
            <h3 className="text-xl font-bold text-white mb-3">5. Limitation of Liability</h3>
            <p className="text-white/60">
              DoItForMe is an intermediary platform. We are not responsible for the quality of work provided by other students. We do, however, offer a dispute resolution mechanism to protect your funds.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}