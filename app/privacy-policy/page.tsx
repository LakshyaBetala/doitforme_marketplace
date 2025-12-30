"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0B0B11] text-white p-6 md:p-12 selection:bg-[#8825F5] selection:text-white">
      <Link href="/" className="flex items-center gap-2 text-white/50 hover:text-white mb-8 transition-colors w-fit group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Home
      </Link>

      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-black mb-2">Privacy Policy</h1>
        <p className="text-white/40 mb-10 border-b border-white/10 pb-6">Last updated: December 31, 2025</p>

        <div className="space-y-8 text-white/80 leading-relaxed">
          <section>
            <h3 className="text-xl font-bold text-white mb-3">1. Data Collection</h3>
            <p className="text-white/60">
              We collect information you provide directly to us, including your name, email address, Student ID (for verification), and payment details.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">2. How We Use Your Data</h3>
            <p className="text-white/60">
              Your data is used to:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-white/60">
              <li>Verify your identity as a student.</li>
              <li>Process payments and withdrawals.</li>
              <li>Send transaction notifications and updates.</li>
              <li>Detect and prevent fraud.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">3. Payment Security</h3>
            <p className="text-white/60">
              We do not store your credit card or banking password details on our servers. All payment processing is handled securely by <strong>Razorpay</strong>, which is compliant with PCI-DSS standards.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">4. Data Sharing</h3>
            <p className="text-white/60">
              We do not sell your personal data. We may share data with third-party service providers (like Razorpay) solely for the purpose of facilitating your transactions.
            </p>
          </section>
          
          <section>
            <h3 className="text-xl font-bold text-white mb-3">5. Contact</h3>
            <p className="text-white/60">
              For any privacy-related concerns, please contact our Data Protection Officer at <a href="mailto:betala911@gmail.com" className="text-[#8825F5] hover:underline">betala911@gmail.com</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}