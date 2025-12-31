"use client";

import Link from "next/link";
import { ArrowLeft, Zap, Users, ShieldCheck } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#0B0B11] text-white p-6 md:p-12 selection:bg-[#8825F5] selection:text-white">
      <Link href="/" className="flex items-center gap-2 text-white/50 hover:text-white mb-8 transition-colors w-fit group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Home
      </Link>

      <div className="max-w-4xl mx-auto space-y-16">
        
        {/* Hero Section */}
        <div className="text-center space-y-6">
           <h1 className="text-4xl md:text-6xl font-black tracking-tight">
             We are <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8825F5] to-[#0097FF]">DoItForMe</span>.
           </h1>
           <p className="text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
             India's first student-to-student marketplace. We are building a community where students can outsource tasks to save time and hustle to earn money.
           </p>
        </div>

        {/* Mission Grid */}
        <div className="grid md:grid-cols-3 gap-6">
           <div className="bg-white/5 p-8 rounded-3xl border border-white/10 hover:border-[#8825F5]/50 transition-colors">
              <div className="w-12 h-12 bg-[#8825F5]/20 rounded-xl flex items-center justify-center text-[#8825F5] mb-4">
                 <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-2">Our Mission</h3>
              <p className="text-white/60 text-sm">To empower every student in India with financial independence and time freedom.</p>
           </div>
           
           <div className="bg-white/5 p-8 rounded-3xl border border-white/10 hover:border-[#0097FF]/50 transition-colors">
              <div className="w-12 h-12 bg-[#0097FF]/20 rounded-xl flex items-center justify-center text-[#0097FF] mb-4">
                 <Users className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-2">For Students</h3>
              <p className="text-white/60 text-sm">Built by students, for students. We understand the chaotic schedule of college life.</p>
           </div>

           <div className="bg-white/5 p-8 rounded-3xl border border-white/10 hover:border-green-500/50 transition-colors">
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center text-green-500 mb-4">
                 <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-2">Trust First</h3>
              <p className="text-white/60 text-sm">With Verified Student IDs and Escrow payments, safety is our #1 priority.</p>
           </div>
        </div>

        {/* Story Section */}
        <div className="bg-[#1A1A24] rounded-3xl p-8 md:p-12 border border-white/10">
           <h2 className="text-3xl font-bold mb-6">Our Story</h2>
           <div className="space-y-4 text-white/70 leading-relaxed">
              <p>
                DoItForMe started with a simple observation: College students are always short on two things—<strong>Time</strong> and <strong>Money</strong>.
              </p>
              <p>
                Some students have deadlines piling up and need help running errands or finishing assignments. Others have free time and skills but no way to earn quick cash.
              </p>
              <p>
                We built DoItForMe to bridge this gap. A secure, anonymous platform where you can get things done or get paid to do them. No complex hiring, no resumes—just simple tasks for students.
              </p>
           </div>
        </div>

      </div>
    </div>
  );
}