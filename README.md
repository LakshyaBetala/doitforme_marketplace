<div align="center">
  <img src="./public/Doitforme_logo.png" alt="DoItForMe Logo" width="120" />
  <h1>DoItForMe</h1>
  <p><strong>India's Premium Student Hustle & Enterprise Gig Network</strong></p>
</div>

---

## 🚀 Overview

**DoItForMe** is a cutting-edge platform connecting verified university students with high-value gigs, both from peers (Student-to-Student) and businesses (Company-to-Student). By leveraging a secure 3% Escrow payment system, role-based verifications, and real-time chat, DoItForMe completely eliminates the friction and risk traditionally associated with freelance student work.

### Key Features
- ⚡ **Instant Deployments**: Scale from 1 to 50 workers per task instantly.
- 🛡️ **3% Escrow Security**: Funds are held securely until the task is marked completed by both parties.
- 🎓 **Strictly Verified Talent**: Only university-cleared students can accept and perform tasks.
- 🏢 **Enterprise Hub**: Dedicated onboarding and clearance logic for B2B hiring.
- 💬 **Real-time Comms**: Integrated messaging, collision tracking, and automated deployment logs.

---

## 🛠 Tech Stack

Built with modern, production-grade tools focused on speed, aesthetics, and robust security:

- **Frontend**: [Next.js 15 (App Router)](https://nextjs.org/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) + Custom Glassmorphism Theme
- **Icons & Motion**: Lucide-React & Framer Motion
- **Backend/Auth/DB**: [Supabase](https://supabase.com/) (PostgreSQL & Realtime RLS)
- **Payments**: Cashfree (Integrated UPI/Card checkouts)
- **Notifications**: Telegram Webhook Intergration

---

## 💻 Getting Started (Development)

### Prerequisites
- Node.js (v18+)
- Local or Remote Supabase Instance
- Valid Cashfree API Keys 

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/LakshyaBetala/doitforme_marketplace.git
   cd doitforme_marketplace
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env.local` file in the root directory and add the following keys:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   CASHFREE_APP_ID=your_cashfree_id
   CASHFREE_SECRET_KEY=your_cashfree_secret
   # (Include any other necessary keys listed in .env.example)
   ```

4. **Initialize Supabase Migrations:**
   Ensure your database matches the current schema by running necessary migrations located in `supabase/migrations/`.

5. **Start the development server:**
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔒 Security & Roles

DoItForMe utilizes strictly enforced **Row-Level Security (RLS)** in PostgreSQL via Supabase. 
The system routes users into one of three core roles:
1. **Student Worker**: Permitted to apply for gigs, receive manual payouts, and accept direct postings.
2. **Standard Poster**: Allowed to post gigs, fund escrow deposits, and accept deliveries.
3. **Company / Enterprise**: Requires manual administrator clearance. Permitted to rapidly scale tasks (up to 50 workers) under high-budget rules.

### Note on OTP Logins
DoItForMe strictly utilizes Email One-Time Passcodes (OTP) for frictionless authentication (No magic links). Ensure your Supabase Auth settings have Magic Links disabled and OTP expiry tuned to your preference (default: 60s cooldown).

---

## 📄 License & Contact

Private / Proprietary Project. 
Created and maintained by the DoItForMe Team. All rights reserved. 
