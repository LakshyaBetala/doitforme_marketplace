"use client";

import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#0B0B11] text-white p-6 md:p-12 selection:bg-[#8825F5] selection:text-white">
      <Link href="/" className="flex items-center gap-2 text-white/50 hover:text-white mb-8 transition-colors w-fit group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Home
      </Link>

      <div className="max-w-4xl mx-auto text-center space-y-12">
        
        <div>
           <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Transparent Pricing</h1>
           <p className="text-white/60 text-lg">No hidden charges. We only earn when you earn.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 text-left">
           
           {/* For Posters */}
           <div className="bg-[#1A1A24] rounded-3xl p-8 border border-white/10 flex flex-col">
              <h3 className="text-2xl font-bold text-white mb-2">For Posters</h3>
              <p className="text-white/50 text-sm mb-6">Students who want tasks done.</p>
              
              <div className="text-4xl font-black text-white mb-6">
                0% <span className="text-lg font-medium text-white/40">Commission</span>
              </div>

              <ul className="space-y-4 mb-8 flex-1">
                 <li className="flex items-start gap-3 text-white/80">
                    <Check className="w-5 h-5 text-green-500 shrink-0" />
                    <span>Free to post unlimited gigs</span>
                 </li>
                 <li className="flex items-start gap-3 text-white/80">
                    <Check className="w-5 h-5 text-green-500 shrink-0" />
                    <span>100% of your budget goes to the worker</span>
                 </li>
                 <li className="flex items-start gap-3 text-white/80">
                    <Check className="w-5 h-5 text-green-500 shrink-0" />
                    <span>Secure Escrow Protection</span>
                 </li>
              </ul>
              
              <p className="text-xs text-white/30 pt-4 border-t border-white/5">
                * Standard Payment Gateway fees (2-3%) may apply when adding funds to wallet via Razorpay.
              </p>
           </div>

           {/* For Workers */}
           <div className="relative bg-gradient-to-b from-[#2A1B3D] to-[#1A1A24] rounded-3xl p-8 border border-[#8825F5]/30 flex flex-col">
              <div className="absolute top-0 right-0 bg-[#8825F5] text-white text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl">
                 MOST POPULAR
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-2">For Workers</h3>
              <p className="text-white/50 text-sm mb-6">Students earning money.</p>
              
              <div className="text-4xl font-black text-white mb-6">
                10% <span className="text-lg font-medium text-white/40">Platform Fee</span>
              </div>

              <ul className="space-y-4 mb-8 flex-1">
                 <li className="flex items-start gap-3 text-white/80">
                    <Check className="w-5 h-5 text-[#8825F5] shrink-0" />
                    <span>Free to apply to gigs</span>
                 </li>
                 <li className="flex items-start gap-3 text-white/80">
                    <Check className="w-5 h-5 text-[#8825F5] shrink-0" />
                    <span>Keep 100% of tips</span>
                 </li>
                 <li className="flex items-start gap-3 text-white/80">
                    <Check className="w-5 h-5 text-[#8825F5] shrink-0" />
                    <span>Fee is only charged on <strong>Withdrawal</strong></span>
                 </li>
              </ul>

              <p className="text-xs text-white/30 pt-4 border-t border-white/5">
                * Example: If you withdraw ₹1000, you receive ₹900. The ₹100 fee covers platform maintenance and server costs.
              </p>
           </div>

        </div>

      </div>
    </div>
  );
}