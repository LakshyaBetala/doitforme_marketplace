"use client";

import Link from "next/link";
import { ArrowLeft, Mail, MapPin, Phone } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#0B0B11] text-white p-6 md:p-12 selection:bg-[#8825F5] selection:text-white">
      <Link href="/" className="flex items-center gap-2 text-white/50 hover:text-white mb-8 transition-colors w-fit group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Home
      </Link>

      <div className="max-w-2xl mx-auto space-y-8">
        <div>
           <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Contact Us</h1>
           <p className="text-white/60 leading-relaxed text-lg">
             We are here to help. If you have any questions regarding the platform, payments, or gigs, please reach out to us.
           </p>
        </div>

        <div className="space-y-6 bg-white/5 p-8 rounded-3xl border border-white/10">
          
          {/* Email Support */}
          <div className="flex items-start gap-4">
            <div className="p-3 bg-[#8825F5]/20 rounded-xl text-[#8825F5]">
               <Mail className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">Email Support</h3>
              <p className="text-white/60 text-sm mb-1">For general queries, bug reports, and disputes:</p>
              <a href="mailto:betala911@gmail.com" className="text-[#8825F5] font-medium hover:underline">betala911@gmail.com</a>
            </div>
          </div>

          {/* Office Address */}
          <div className="flex items-start gap-4">
            <div className="p-3 bg-[#0097FF]/20 rounded-xl text-[#0097FF]">
               <MapPin className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">Registered Office</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                DoItForMe HQ<br/>
                Chennai, Tamil Nadu, India.<br/>
                <span className="opacity-50 text-xs">(Full address provided upon request or invoice generation)</span>
              </p>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}