"use client";

import Link from "next/link";
import { ArrowLeft, Mail, MapPin } from "lucide-react";

export default function ContactContent() {
  return (
    <div className="min-h-screen bg-[#0B0B11] text-white p-6 md:p-12 selection:bg-[#8825F5] selection:text-white">
      <Link href="/" className="flex items-center gap-2 text-white/50 hover:text-white mb-8 transition-colors w-fit group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Home
      </Link>

      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Contact DoItForMe Support</h1>
          <p className="text-white/60 leading-relaxed text-lg">
            We are here to help. If you have any questions regarding the platform, payments, or gigs, please reach out to us.
          </p>
        </div>

        <div className="space-y-6 bg-white/10 p-8 rounded-3xl border border-white/10">

          {/* Email Support */}
          <div className="flex items-start gap-4">
            <div className="p-3 bg-[#8825F5]/20 rounded-xl text-[#8825F5]">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">Email Support</h3>
              <p className="text-white/60 text-sm mb-1">For general queries, bug reports, and disputes:</p>
              <a href="mailto:doitforme.in@gmail.com" className="text-[#8825F5] font-medium hover:underline">doitforme.in@gmail.com</a>
              <p className="text-white/40 text-xs mt-1">We reply within one working day.</p>
            </div>
          </div>

          {/* Payments & escalations */}
          <div className="flex items-start gap-4">
            <div className="p-3 bg-[#0097FF]/20 rounded-xl text-[#0097FF]">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">Payments &amp; Escalations</h3>
              <p className="text-white/60 text-sm mb-1">Billing, refunds, and anything left unresolved:</p>
              <a href="mailto:gandhimouriyan1234@gmail.com" className="text-[#0097FF] font-medium hover:underline">gandhimouriyan1234@gmail.com</a>
              <p className="text-white/40 text-xs mt-1">Support hours: Monday to Saturday, 10:00 – 19:00 IST.</p>
            </div>
          </div>

          {/* Office Address */}
          <div className="flex items-start gap-4">
            <div className="p-3 bg-[#0097FF]/20 rounded-xl text-[#0097FF]">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">Operating Address</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                DoItForMe<br />
                Zinda Sahib Street<br />
                Chennai, Tamil Nadu, India.
              </p>
            </div>
          </div>

        </div>

        {/* Business & compliance.
            Deliberately the quietest block on the page. Razorpay's merchant
            checklist requires a working telephone line with stated hours, so it
            has to be here and has to be real — but support runs on email, and
            merchandising a phone number to students turns it into a helpline.
            Present and truthful, not advertised. */}
        <div className="border-t border-white/10 pt-6">
          <h4 className="text-white/40 text-[11px] font-semibold uppercase tracking-[0.2em] mb-2">Business &amp; compliance</h4>
          <p className="text-white/35 text-xs leading-relaxed">
            Registered business line for payment, billing and compliance matters:{" "}
            <span className="text-white/50">+91 93441 10272</span>, Monday to Friday, 11:00 – 17:00 IST.
            For anything else — including task, delivery and refund queries — please email us; we answer
            email far faster than the phone.
          </p>
        </div>

        <p className="text-white/35 text-xs leading-relaxed">
          DoItForMe is operated by <span className="text-white/55">Lakshya Betala</span> and <span className="text-white/55">Mouriyan Gandhi</span>. Payments are processed by Razorpay and settled to the DoItForMe merchant account held by Mouriyan Gandhi.
          Legal and billing correspondence:{" "}
          <a href="mailto:betala911@gmail.com" className="text-white/55 hover:text-white transition-colors">betala911@gmail.com</a>
          {" · "}
          <a href="mailto:gandhimouriyan1234@gmail.com" className="text-white/55 hover:text-white transition-colors">gandhimouriyan1234@gmail.com</a>.
        </p>
      </div>
    </div>
  );
}
