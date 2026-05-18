"use client";

import Link from "next/link";
import { ArrowLeft, Check, Shield, Zap, Building2 } from "lucide-react";

export default function PricingContent() {
   return (
      <div className="min-h-[100dvh] bg-[var(--background)] text-white p-6 md:p-12 selection:bg-[var(--brand-purple)] selection:text-white">
         <Link href="/" className="flex items-center gap-2 text-white/50 hover:text-white mb-8 transition-colors w-fit group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Home
         </Link>

         <div className="max-w-6xl mx-auto text-center space-y-12">

            <div>
               <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4" style={{ fontFamily: 'var(--font-space-grotesk), Inter, sans-serif', letterSpacing: '-0.02em' }}>Simple, transparent pricing</h1>
               <p className="text-white/60 text-lg">Free for students. Escrow when you need protection. Pro for companies that hire at scale.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 text-left">

               {/* Direct Connect */}
               <div className="bg-[var(--card)] rounded-2xl p-7 border border-[var(--card-border)] flex flex-col">
                  <div className="flex items-center gap-3 mb-2">
                     <Zap className="w-5 h-5 text-white/70" />
                     <h3 className="text-xl font-semibold text-white">Direct Connect</h3>
                  </div>
                  <p className="text-white/50 text-sm mb-6">Connect, chat, and exchange contacts directly.</p>

                  <div className="text-3xl font-semibold text-white mb-6">
                     Free <span className="text-base font-normal text-white/60">forever</span>
                  </div>

                  <ul className="space-y-3 mb-8 flex-1 text-sm">
                     <li className="flex items-start gap-3 text-white/80"><Check className="w-4 h-4 text-white/60 shrink-0 mt-0.5" /><span>Post & apply to unlimited gigs</span></li>
                     <li className="flex items-start gap-3 text-white/80"><Check className="w-4 h-4 text-white/60 shrink-0 mt-0.5" /><span>Phone/WhatsApp exchanged on hire</span></li>
                     <li className="flex items-start gap-3 text-white/80"><Check className="w-4 h-4 text-white/60 shrink-0 mt-0.5" /><span>0% platform fee — keep 100%</span></li>
                  </ul>

                  <p className="text-xs text-white/50 pt-4 border-t border-white/5">
                     For small tasks, errands and campus gigs where you trust the other party.
                  </p>
               </div>

               {/* Escrow Protection */}
               <div className="relative bg-[var(--card-elevated)] rounded-2xl p-7 border border-[var(--brand-purple)]/30 flex flex-col">
                  <div className="absolute top-0 right-0 bg-[var(--brand-purple)] text-white text-[10px] font-semibold tracking-wider px-3 py-1 rounded-bl-xl rounded-tr-2xl">
                     RECOMMENDED
                  </div>

                  <div className="flex items-center gap-3 mb-2">
                     <Shield className="w-5 h-5 text-[#C9A9FF]" />
                     <h3 className="text-xl font-semibold text-white">Escrow Protection</h3>
                  </div>
                  <p className="text-white/50 text-sm mb-6">For gigs ₹500+. Funds held until work is verified.</p>

                  <div className="text-3xl font-semibold text-white mb-1">
                     3% <span className="text-base font-normal text-white/60">from worker</span>
                  </div>
                  <div className="text-sm text-white/60 mb-6">
                     + 2% gateway fee on payer
                  </div>

                  <ul className="space-y-3 mb-8 flex-1 text-sm">
                     <li className="flex items-start gap-3 text-white/80"><Check className="w-4 h-4 text-[#C9A9FF] shrink-0 mt-0.5" /><span>Funds held in escrow until delivery</span></li>
                     <li className="flex items-start gap-3 text-white/80"><Check className="w-4 h-4 text-[#C9A9FF] shrink-0 mt-0.5" /><span>24-hour review window</span></li>
                     <li className="flex items-start gap-3 text-white/80"><Check className="w-4 h-4 text-[#C9A9FF] shrink-0 mt-0.5" /><span>Dispute resolution by our team</span></li>
                     <li className="flex items-start gap-3 text-white/80"><Check className="w-4 h-4 text-[#C9A9FF] shrink-0 mt-0.5" /><span>Available on gigs ₹500 and above</span></li>
                  </ul>

                  <p className="text-xs text-white/50 pt-4 border-t border-white/5">
                     Example: ₹1000 gig → payer charges ₹1020 (2% gateway). Worker receives ₹970 (3% platform fee).
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
                  Email <a href="mailto:doitforme.in@gmail.com" className="text-[#C9A9FF] hover:underline">doitforme.in@gmail.com</a> · call <a href="tel:+919344110272" className="text-[#C9A9FF] hover:underline">+91 93441 10272</a>
               </p>
            </div>

         </div>
      </div>
   );
}
