"use client";

import Link from "next/link";
import { ArrowLeft, Package, Clock, CheckCircle2, AlertTriangle, Mail } from "lucide-react";

// Razorpay's website review checks for a shipping/delivery policy on every
// merchant site, including service businesses. DoItForMe ships no goods, so
// this page states the service-delivery equivalent: what is delivered, when,
// how it is handed over, and what happens when a deadline is missed.
export default function ShippingContent() {
  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-white selection:bg-[var(--brand-purple)] selection:text-white relative overflow-hidden">

      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-[var(--brand-purple)]/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[20%] w-[500px] h-[500px] bg-[var(--brand-blue)]/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12 md:py-20 relative z-10">

        {/* Header */}
        <div className="mb-12">
          <Link href="/" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white mb-8 transition-colors group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Back to Home</span>
          </Link>

          <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-500" style={{ fontFamily: 'var(--font-space-grotesk), Inter, sans-serif' }}>
            Service Delivery
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed max-w-2xl">
            DoItForMe sells services, not goods — nothing is ever shipped to you. This is our delivery
            policy, and it stands as the shipping policy our payment provider requires.
          </p>
          <p className="text-zinc-500 text-sm mt-4">
            Last updated: <span className="text-zinc-300">September 2, 2026</span>
          </p>
        </div>

        <div className="space-y-6">

          {/* 1. What is delivered */}
          <section className="p-8 rounded-3xl bg-white/[0.04] border border-[var(--card-border)] hover:border-white/10 transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[var(--brand-purple)]/10 flex items-center justify-center text-[#C9A9FF] shrink-0">
                <Package size={20} />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-white">1. What is delivered</h3>
                <p className="text-zinc-400 leading-relaxed">
                  DoItForMe is a services platform. <strong className="text-white">No physical goods are shipped by DoItForMe</strong>, and
                  we do not operate courier or logistics services. What is delivered depends on the listing:
                </p>
                <ul className="space-y-2 text-sm text-zinc-400">
                  <li className="flex gap-3"><span className="text-[#C9A9FF] shrink-0">—</span><span><strong className="text-zinc-200">Digital work</strong> such as documents, presentations, designs, code, research and written material, delivered as files or a link on the task page.</span></li>
                  <li className="flex gap-3"><span className="text-[#C9A9FF] shrink-0">—</span><span><strong className="text-zinc-200">In-person campus services</strong> such as tutoring, lab help and errands, performed at the time and place agreed between the two students.</span></li>
                  <li className="flex gap-3"><span className="text-[#C9A9FF] shrink-0">—</span><span><strong className="text-zinc-200">Campus Market items</strong> sold or rented between students, handed over in person on campus. DoItForMe does not ship, pack or transport these items.</span></li>
                </ul>
              </div>
            </div>
          </section>

          {/* 2. Timelines */}
          <section className="p-8 rounded-3xl bg-white/[0.04] border border-[var(--card-border)] hover:border-white/10 transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[var(--brand-blue)]/10 flex items-center justify-center text-[var(--brand-blue)] shrink-0">
                <Clock size={20} />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-white">2. Delivery timelines</h3>
                <p className="text-zinc-400 leading-relaxed">
                  Every task carries a deadline set by the poster when the task is created and accepted by the worker
                  when they take it on. That deadline is the delivery commitment. Turnaround typically ranges from
                  <strong className="text-white"> 24 hours</strong> for small campus tasks to
                  <strong className="text-white"> 6 weeks</strong> for larger project contracts.
                </p>
                <p className="text-zinc-400 leading-relaxed">
                  Because each task is individually scoped and priced, DoItForMe does not publish a single blanket
                  delivery window. The agreed deadline is shown on the task page and in your dashboard at all times.
                </p>
              </div>
            </div>
          </section>

          {/* 3. Confirmation */}
          <section className="p-8 rounded-3xl bg-white/[0.04] border border-[var(--card-border)] hover:border-white/10 transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[var(--brand-purple)]/10 flex items-center justify-center text-[#C9A9FF] shrink-0">
                <CheckCircle2 size={20} />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-white">3. Confirming delivery</h3>
                <p className="text-zinc-400 leading-relaxed">
                  When the worker marks the task delivered you are notified by email and in the app, and you have
                  <strong className="text-white"> 24 hours</strong> to review the work. During that window you can:
                </p>
                <ul className="space-y-2 text-sm text-zinc-400">
                  <li className="flex gap-3"><span className="text-[#C9A9FF] shrink-0">—</span><span><strong className="text-zinc-200">Approve</strong> — payment is released to the worker immediately.</span></li>
                  <li className="flex gap-3"><span className="text-[#C9A9FF] shrink-0">—</span><span><strong className="text-zinc-200">Request changes</strong> — the review clock is cancelled and restarts when the worker resubmits.</span></li>
                  <li className="flex gap-3"><span className="text-[#C9A9FF] shrink-0">—</span><span><strong className="text-zinc-200">Raise a dispute</strong> — the payment stays held while our team reviews the evidence.</span></li>
                </ul>
                <p className="text-zinc-400 leading-relaxed">
                  If you take no action within 24 hours the payment is released automatically, so workers are never
                  left waiting indefinitely on an unread notification.
                </p>
              </div>
            </div>
          </section>

          {/* 4. Late or non-delivery */}
          <section className="p-8 rounded-3xl bg-white/[0.04] border border-[var(--card-border)] hover:border-white/10 transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-300 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-white">4. Late or missed delivery</h3>
                <p className="text-zinc-400 leading-relaxed">
                  If the agreed deadline passes without a delivery, you are entitled to cancel the task and receive a
                  full refund of the amount paid. Refund conditions, methods and timelines are set out in our{" "}
                  <Link href="/refund-policy" className="text-[#C9A9FF] hover:underline">Refund &amp; Cancellation Policy</Link>.
                </p>
                <p className="text-zinc-400 leading-relaxed">
                  Payment is held by DoItForMe from the moment you pay and is not released to the worker until the work
                  is delivered and the review window closes — so a missed deadline never leaves you out of pocket.
                </p>
              </div>
            </div>
          </section>

          {/* 5. Contact */}
          <section className="p-8 rounded-3xl bg-white/[0.04] border border-[var(--card-border)] hover:border-white/10 transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-300 shrink-0">
                <Mail size={20} />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-white">5. Questions about a delivery</h3>
                <p className="text-zinc-400 leading-relaxed">
                  Email <a href="mailto:doitforme.in@gmail.com" className="text-[#C9A9FF] hover:underline">doitforme.in@gmail.com</a>{" "}
                  or <a href="mailto:gandhimouriyan1234@gmail.com" className="text-[#C9A9FF] hover:underline">gandhimouriyan1234@gmail.com</a> for
                  escalations, Monday to Saturday, 10:00 to 19:00 IST. We reply to delivery queries within one working day.
                </p>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  DoItForMe is operated by Lakshya Betala and Mouriyan Gandhi, Zinda Sahib Street, Chennai, Tamil Nadu 600001, India.
                  Payments are processed by Razorpay Software Private Limited and settled to the DoItForMe merchant
                  account held by Mouriyan Gandhi.
                </p>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
