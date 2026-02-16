"use client";

import Link from "next/link";
import { ArrowLeft, Eye, Database, FileText, Mail } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#020202] text-white selection:bg-[#8825F5] selection:text-white relative overflow-hidden">

      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-brand-purple/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12 md:py-20 relative z-10">

        {/* Header */}
        <div className="mb-12">
          <Link href="/" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white mb-8 transition-colors group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Back to Home</span>
          </Link>

          <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-500">
            Privacy Policy
          </h1>
          <p className="text-zinc-500 text-lg">
            Last updated: <span className="text-zinc-300">December 31, 2025</span>
          </p>
        </div>

        {/* Content Cards */}
        <div className="space-y-6">

          {/* Section 1: Data Collection */}
          <section className="p-8 rounded-3xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                <Database size={20} />
              </div>
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white">1. Data Collection</h3>
                <p className="text-zinc-400 leading-relaxed">
                  We collect information you provide directly to us, including your name, email address, Student ID (for verification), and payment details.
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-black/20 border border-white/5">
                    <strong className="block text-white mb-1 text-sm">Personal Information</strong>
                    <span className="text-xs text-zinc-500">Name, Email, Student ID (for verification).</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-black/20 border border-white/5">
                    <strong className="block text-white mb-1 text-sm">Financial Information</strong>
                    <span className="text-xs text-zinc-500">Payment details (processed by third-party).</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: How We Use Your Data */}
          <section className="p-8 rounded-3xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-brand-purple shrink-0">
                <Eye size={20} />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-white">2. How We Use Your Data</h3>
                <p className="text-zinc-400 leading-relaxed">Your data is used to:</p>
                <ul className="space-y-2 text-zinc-400">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-purple"></span>
                    Verify your identity as a student.
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-purple"></span>
                    Process payments and withdrawals.
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-purple"></span>
                    Send transaction notifications and updates.
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-purple"></span>
                    Detect and prevent fraud.
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 3: Payment Security & Data Sharing */}
          <section className="p-8 rounded-3xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500 shrink-0">
                <FileText size={20} />
              </div>
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white">3. Security & Sharing</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-white font-medium mb-1">Payment Security</h4>
                    <p className="text-zinc-400 text-sm leading-relaxed">
                      We do not store your credit card or banking password details. All payment processing is handled securely by <strong className="text-white">Razorpay</strong>, which is compliant with PCI-DSS standards.
                    </p>
                  </div>
                  <div>
                    <h4 className="text-white font-medium mb-1">Data Sharing</h4>
                    <p className="text-zinc-400 text-sm leading-relaxed">
                      We do not sell your personal data. We only share necessary data with third-party providers (like Razorpay) to facilitate transactions.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: Contact */}
          <section className="p-8 rounded-3xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0">
                <Mail size={20} />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-white">4. Contact</h3>
                <p className="text-zinc-400 leading-relaxed">
                  For any privacy-related concerns, please contact our Data Protection Officer at <a href="mailto:betala911@gmail.com" className="text-brand-purple hover:text-white transition-colors underline decoration-brand-purple/30 underline-offset-4">betala911@gmail.com</a>.
                </p>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}