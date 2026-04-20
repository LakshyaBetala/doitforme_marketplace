"use client";

import Link from "next/link";
import { ArrowLeft, Check, Shield, Zap } from "lucide-react";

export default function PricingContent() {
   return (
      <div className="min-h-screen bg-[#0B0B11] text-white p-6 md:p-12 selection:bg-[#00f2ff] selection:text-black">
         <Link href="/" className="flex items-center gap-2 text-white/50 hover:text-white mb-8 transition-colors w-fit group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Home
         </Link>

         <div className="max-w-4xl mx-auto text-center space-y-12">

            <div>
               <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">DoItForMe Pricing – Simple & Free</h1>
               <p className="text-white/60 text-lg">No hidden charges. Connect directly or use escrow protection.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 text-left">

               {/* Direct Connect */}
               <div className="relative bg-gradient-to-b from-[#1A2B1A] to-[#1A1A24] rounded-3xl p-8 border border-green-500/30 flex flex-col">
                  <div className="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl">
                     MOST POPULAR
                  </div>

                  <div className="flex items-center gap-3 mb-2">
                     <Zap className="w-6 h-6 text-green-400" />
                     <h3 className="text-2xl font-bold text-white">Direct Connect</h3>
                  </div>
                  <p className="text-white/50 text-sm mb-6">Connect, chat, and exchange contacts directly.</p>

                  <div className="text-4xl font-black text-green-400 mb-6">
                     FREE <span className="text-lg font-medium text-white/60">Forever</span>
                  </div>

                  <ul className="space-y-4 mb-8 flex-1">
                     <li className="flex items-start gap-3 text-white/80">
                        <Check className="w-5 h-5 text-green-500 shrink-0" />
                        <span>Free to post unlimited gigs</span>
                     </li>
                     <li className="flex items-start gap-3 text-white/80">
                        <Check className="w-5 h-5 text-green-500 shrink-0" />
                        <span>Free to apply and showcase skills</span>
                     </li>
                     <li className="flex items-start gap-3 text-white/80">
                        <Check className="w-5 h-5 text-green-500 shrink-0" />
                        <span>Phone/WhatsApp exchange on hire</span>
                     </li>
                     <li className="flex items-start gap-3 text-white/80">
                        <Check className="w-5 h-5 text-green-500 shrink-0" />
                        <span>0% platform fee — keep 100% of earnings</span>
                     </li>
                  </ul>

                  <p className="text-xs text-white/50 pt-4 border-t border-white/5">
                     * Perfect for small tasks, errands, and campus gigs where you trust the other party.
                  </p>
               </div>

               {/* Escrow Protection */}
               <div className="bg-[#1A1A24] rounded-3xl p-8 border border-[#00f2ff]/30 flex flex-col">
                  <div className="flex items-center gap-3 mb-2">
                     <Shield className="w-6 h-6 text-[#00f2ff]" />
                     <h3 className="text-2xl font-bold text-white">Escrow Protection</h3>
                  </div>
                  <p className="text-white/50 text-sm mb-6">For gigs ₹500 and above. Funds held until work is verified.</p>

                  <div className="text-4xl font-black text-white mb-6">
                     3% <span className="text-lg font-medium text-white/60">Escrow Fee</span>
                  </div>

                  <ul className="space-y-4 mb-8 flex-1">
                     <li className="flex items-start gap-3 text-white/80">
                        <Check className="w-5 h-5 text-[#00f2ff] shrink-0" />
                        <span>Funds held in secure escrow until delivery</span>
                     </li>
                     <li className="flex items-start gap-3 text-white/80">
                        <Check className="w-5 h-5 text-[#00f2ff] shrink-0" />
                        <span>24-hour review window after submission</span>
                     </li>
                     <li className="flex items-start gap-3 text-white/80">
                        <Check className="w-5 h-5 text-[#00f2ff] shrink-0" />
                        <span>Dispute resolution by DoItForMe team</span>
                     </li>
                     <li className="flex items-start gap-3 text-white/80">
                        <Check className="w-5 h-5 text-[#00f2ff] shrink-0" />
                        <span>Available for gigs ₹500 and above</span>
                     </li>
                  </ul>

                  <p className="text-xs text-white/50 pt-4 border-t border-white/5">
                     * Example: For a ₹1000 gig, 3% = ₹30 fee. Hustler receives ₹970. Client pays ₹1000 + ~3% gateway fee.
                  </p>
               </div>

            </div>

            {/* Contact Support Banner */}
            <div className="mt-12 bg-white/5 border border-white/10 rounded-2xl p-6 text-center max-w-2xl mx-auto">
               <p className="text-white/80 text-lg mb-2">Have a question about our pricing?</p>
               <p className="text-white/50 text-sm">
                  Contact us at <a href="mailto:doitforme.in@gmail.com" className="text-[#00f2ff] font-medium hover:underline">doitforme.in@gmail.com</a> or call <a href="tel:+919344110272" className="text-green-500 font-medium hover:underline">+91 93441 10272</a>
               </p>
            </div>

         </div>
      </div>
   );
}
