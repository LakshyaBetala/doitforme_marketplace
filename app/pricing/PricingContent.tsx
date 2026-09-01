"use client";

import Link from "next/link";
import { ArrowLeft, Check, Shield, Building2, GraduationCap } from "lucide-react";

// Every number on this page comes from lib/fees.ts (PLATFORM_FEES 5%/10%,
// GATEWAY_FEE_RATE 2%). Publishing a rate we do not charge is both a chargeback
// magnet and a payment-aggregator compliance problem, so when the dial in
// lib/fees.ts moves, this page moves with it.
export default function PricingContent() {
   return (
      <div className="min-h-[100dvh] bg-[var(--background)] text-white p-6 md:p-12 selection:bg-[var(--brand-purple)] selection:text-white">
         <Link href="/" className="flex items-center gap-2 text-white/50 hover:text-white mb-8 transition-colors w-fit group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Home
         </Link>

         <div className="max-w-6xl mx-auto text-center space-y-12">

            <div>
               <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4" style={{ fontFamily: 'var(--font-space-grotesk), Inter, sans-serif', letterSpacing: '-0.02em' }}>Simple, transparent pricing</h1>
               <p className="text-white/60 text-lg">Free to post. One platform fee, taken from the payout — never a surprise at checkout.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 text-left">

               {/* Student listings — the core product, so it carries the accent */}
               <div className="relative bg-[var(--card-elevated)] rounded-2xl p-7 border border-[var(--brand-purple)]/30 flex flex-col">
                  <div className="absolute top-0 right-0 bg-[var(--brand-purple)] text-white text-[10px] font-semibold tracking-wider px-3 py-1 rounded-bl-xl rounded-tr-2xl">
                     STUDENTS
                  </div>

                  <div className="flex items-center gap-3 mb-2">
                     <GraduationCap className="w-5 h-5 text-[#C9A9FF]" />
                     <h3 className="text-xl font-semibold text-white">Student Listings</h3>
                  </div>
                  <p className="text-white/50 text-sm mb-6">Gigs, items and rentals posted by students.</p>

                  <div className="text-3xl font-semibold text-white mb-1">
                     5% <span className="text-base font-normal text-white/60">from the payout</span>
                  </div>
                  <div className="text-sm text-white/60 mb-6">
                     + 2% gateway fee, paid by the payer
                  </div>

                  <ul className="space-y-3 mb-8 flex-1 text-sm">
                     <li className="flex items-start gap-3 text-white/80"><Check className="w-4 h-4 text-[#C9A9FF] shrink-0 mt-0.5" /><span>Free to post and free to apply</span></li>
                     <li className="flex items-start gap-3 text-white/80"><Check className="w-4 h-4 text-[#C9A9FF] shrink-0 mt-0.5" /><span>Payment held until you approve the work</span></li>
                     <li className="flex items-start gap-3 text-white/80"><Check className="w-4 h-4 text-[#C9A9FF] shrink-0 mt-0.5" /><span>24-hour review window</span></li>
                     <li className="flex items-start gap-3 text-white/80"><Check className="w-4 h-4 text-[#C9A9FF] shrink-0 mt-0.5" /><span>Dispute resolution by our team</span></li>
                  </ul>

                  <p className="text-xs text-white/50 pt-4 border-t border-white/5">
                     Example: a ₹1,000 gig. You are charged ₹1,020 (2% gateway). The student receives ₹950.
                  </p>
               </div>

               {/* Company tasks */}
               <div className="bg-[var(--card)] rounded-2xl p-7 border border-[var(--card-border)] flex flex-col">
                  <div className="flex items-center gap-3 mb-2">
                     <Shield className="w-5 h-5 text-white/70" />
                     <h3 className="text-xl font-semibold text-white">Company Tasks</h3>
                  </div>
                  <p className="text-white/50 text-sm mb-6">Work posted by a company or agency.</p>

                  <div className="text-3xl font-semibold text-white mb-1">
                     10% <span className="text-base font-normal text-white/60">from the payout</span>
                  </div>
                  <div className="text-sm text-white/60 mb-6">
                     + 2% gateway fee, paid by the payer
                  </div>

                  <ul className="space-y-3 mb-8 flex-1 text-sm">
                     <li className="flex items-start gap-3 text-white/80"><Check className="w-4 h-4 text-white/60 shrink-0 mt-0.5" /><span>Hire 1 to 50 verified students per task</span></li>
                     <li className="flex items-start gap-3 text-white/80"><Check className="w-4 h-4 text-white/60 shrink-0 mt-0.5" /><span>Payment held until you approve the work</span></li>
                     <li className="flex items-start gap-3 text-white/80"><Check className="w-4 h-4 text-white/60 shrink-0 mt-0.5" /><span>Managed delivery — we assign and QA</span></li>
                     <li className="flex items-start gap-3 text-white/80"><Check className="w-4 h-4 text-white/60 shrink-0 mt-0.5" /><span>Same 10% whether self-serve or managed</span></li>
                  </ul>

                  <p className="text-xs text-white/50 pt-4 border-t border-white/5">
                     Example: a ₹1,000 task. You are charged ₹1,020 (2% gateway). The student receives ₹900.
                  </p>
               </div>

               {/* Company Pro */}
               <div className="bg-[var(--card)] rounded-2xl p-7 border border-[var(--card-border)] flex flex-col">
                  <div className="flex items-center gap-3 mb-2">
                     <Building2 className="w-5 h-5 text-white/70" />
                     <h3 className="text-xl font-semibold text-white">Company Pro</h3>
                  </div>
                  <p className="text-white/50 text-sm mb-6">For companies hiring at scale.</p>

                  <div className="text-3xl font-semibold text-white mb-1">
                     ₹299<span className="text-base font-normal text-white/60"> / month</span>
                  </div>
                  <div className="text-sm text-white/60 mb-6">
                     Free tier: 1 gig, capped at 10 applicants.
                  </div>

                  <ul className="space-y-3 mb-8 flex-1 text-sm">
                     <li className="flex items-start gap-3 text-white/80"><Check className="w-4 h-4 text-white/60 shrink-0 mt-0.5" /><span>Unlimited gig posts</span></li>
                     <li className="flex items-start gap-3 text-white/80"><Check className="w-4 h-4 text-white/60 shrink-0 mt-0.5" /><span>Unlimited applicants per gig</span></li>
                     <li className="flex items-start gap-3 text-white/80"><Check className="w-4 h-4 text-white/60 shrink-0 mt-0.5" /><span>Featured pin on every post</span></li>
                     <li className="flex items-start gap-3 text-white/80"><Check className="w-4 h-4 text-white/60 shrink-0 mt-0.5" /><span>Resume access for every applicant</span></li>
                  </ul>

                  <Link href="/company/dashboard" className="text-center bg-white/[0.06] hover:bg-white/[0.1] border border-[var(--card-border)] rounded-lg py-2.5 text-sm font-medium text-white transition-colors">
                     Upgrade in dashboard
                  </Link>
               </div>

            </div>

            {/* Contact Support Banner */}
            <div className="mt-12 bg-white/5 border border-[var(--card-border)] rounded-2xl p-6 text-center max-w-2xl mx-auto">
               <p className="text-white/80 text-base mb-1">Have a question about pricing?</p>
               <p className="text-white/50 text-sm">
                  Email <a href="mailto:doitforme.in@gmail.com" className="text-[#C9A9FF] hover:underline">doitforme.in@gmail.com</a> · billing <a href="mailto:gandhimouriyan1234@gmail.com" className="text-[#C9A9FF] hover:underline">gandhimouriyan1234@gmail.com</a>
               </p>
            </div>

         </div>
      </div>
   );
}
