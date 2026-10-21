"use client";

import { ArrowUpRight, Clock, Mail, MapPin, ReceiptText } from "lucide-react";

import PublicHeader from "@/components/home/PublicHeader";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";

const DISPLAY = { fontFamily: "'Space Grotesk', sans-serif" } as const;

type Channel = {
  icon: typeof Mail;
  title: string;
  blurb: string;
  email: string;
  note: string;
  noteIcon: typeof Clock;
};

const CHANNELS: Channel[] = [
  {
    icon: Mail,
    title: "Email support",
    blurb: "General queries, bug reports and disputes.",
    email: "doitforme.in@gmail.com",
    note: "We reply within one working day.",
    noteIcon: Clock,
  },
  {
    icon: ReceiptText,
    title: "Payments & escalations",
    blurb: "Billing, refunds, and anything left unresolved.",
    email: "gandhimouriyan1234@gmail.com",
    note: "Monday to Saturday, 10:00 – 19:00 IST.",
    noteIcon: Clock,
  },
];

export default function ContactContent() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--fg)] selection:bg-[#8825F5] selection:text-white">
      <PublicHeader />

      <main className="mx-auto max-w-5xl px-5 pb-24 pt-14 md:px-8 md:pt-20">
        <Reveal as="header" immediate>
          <p className="text-[13px] font-semibold tracking-[0.14em] text-[var(--accent-ink)]">SUPPORT</p>
          <h1
            className="mt-3 text-[34px] font-bold leading-[1.05] tracking-[-0.03em] md:text-[44px] lg:whitespace-nowrap lg:text-[56px]"
            style={{ ...DISPLAY, textWrap: "balance" }}
          >
            Contact DoItForMe Support
          </h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-[1.65] text-[var(--fg-muted)]">
            Questions about the platform, a payment or a task? Write to us and a person will answer.
          </p>
        </Reveal>

        <Stagger immediate delay={0.12} className="mt-12 grid gap-4 md:grid-cols-2">
          {CHANNELS.map(({ icon: Icon, title, blurb, email, note, noteIcon: NoteIcon }) => (
            <StaggerItem key={email}>
            <a
              href={`mailto:${email}`}
              className="card-lift group flex h-full flex-col rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-7 hover:border-[var(--accent-line)]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent-ink)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105">
                <Icon className="h-[22px] w-[22px]" />
              </span>
              <h2 className="mt-6 text-[20px] font-semibold tracking-[-0.01em]" style={DISPLAY}>
                {title}
              </h2>
              <p className="mt-1.5 text-[15px] leading-[1.6] text-[var(--fg-muted)]">{blurb}</p>

              <span className="mt-6 inline-flex items-center gap-2 break-all text-[16px] font-semibold text-[var(--accent-ink)]">
                {email}
                <ArrowUpRight
                  aria-hidden
                  className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />
              </span>
              <span className="mt-auto flex items-center gap-1.5 pt-5 text-[13px] text-[var(--fg-faint)]">
                <NoteIcon aria-hidden className="h-3.5 w-3.5" />
                {note}
              </span>
            </a>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal immediate delay={0.3} className="mt-4 flex items-start gap-5 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-7">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--chip)] text-[var(--fg-muted)]">
            <MapPin className="h-[22px] w-[22px]" />
          </span>
          <div>
            <h2 className="text-[20px] font-semibold tracking-[-0.01em]" style={DISPLAY}>
              Operating address
            </h2>
            <p className="mt-1.5 text-[15px] leading-[1.7] text-[var(--fg-muted)]">
              DoItForMe, Zinda Sahib Street
              <br />
              Chennai, Tamil Nadu 600001, India
            </p>
          </div>
        </Reveal>

        {/* Business & compliance.
            Deliberately the quietest block on the page. Razorpay's merchant
            checklist requires a working telephone line with stated hours, so it
            has to be here and has to be real — but support runs on email, and
            merchandising a phone number to students turns it into a helpline.
            Present and truthful, not advertised. */}
        <section className="mt-14 space-y-4 border-t border-[var(--line)] pt-8">
          <h3 className="text-[12px] font-semibold tracking-[0.16em] text-[var(--fg-faint)]">BUSINESS &amp; COMPLIANCE</h3>
          <p className="max-w-3xl text-[13px] leading-[1.7] text-[var(--fg-faint)]">
            Registered business line for payment, billing and compliance matters:{" "}
            <span className="text-[var(--fg-muted)]">+91 93441 10272</span>, Monday to Friday, 11:00 – 17:00 IST.
            For anything else — including task, delivery and refund queries — please email us; we answer
            email far faster than the phone.
          </p>
          <p className="max-w-3xl text-[13px] leading-[1.7] text-[var(--fg-faint)]">
            DoItForMe is operated by <span className="text-[var(--fg-muted)]">Lakshya Betala</span> and{" "}
            <span className="text-[var(--fg-muted)]">Mouriyan Gandhi</span>. Payments are processed by Razorpay and
            settled to the DoItForMe merchant account held by Mouriyan Gandhi. Legal and billing correspondence:{" "}
            <a href="mailto:betala911@gmail.com" className="text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)]">
              betala911@gmail.com
            </a>
            {" · "}
            <a href="mailto:gandhimouriyan1234@gmail.com" className="text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)]">
              gandhimouriyan1234@gmail.com
            </a>
            .
          </p>
        </section>
      </main>
    </div>
  );
}
