<div align="center">
  <img src="./public/Doitforme_logo.png" alt="DoItForMe Logo" width="120" />
  <h1>DoItForMe</h1>
  <p><strong>India's Premium Student Hustle & Enterprise Gig Network</strong></p>
  
  [![License: Private](https://img.shields.io/badge/License-Private-red)](#license--contact)
  ![Tech Stack](https://img.shields.io/badge/Stack-Next.js%20%7C%20TypeScript%20%7C%20Supabase-blue)
  ![Status](https://img.shields.io/badge/Status-Active%20Development-green)
</div>

---

## 🎯 Mission

**DoItForMe** is a cutting-edge gig marketplace platform that empowers verified university students to monetize their skills through legitimate high-value tasks. We bridge the gap between students seeking flexible income and businesses/peers needing reliable talent, all backed by enterprise-grade security.

---

## ✨ Key Features

- ⚡ **Instant Deployments**: Scale from 1 to 50 workers per task instantly
- 🛡️ **3% Escrow Security**: Funds held securely until task completion (verified by both parties)
- 🎓 **Strictly Verified Talent**: Only university-cleared students can accept and perform tasks
- 🏢 **Enterprise Hub**: Dedicated onboarding and clearance logic for B2B hiring at scale
- 💬 **Real-time Communications**: Integrated messaging, task tracking, and automated deployment logs
- 💰 **Flexible Payment Options**: UPI, Card, and Digital Wallet integrations via Cashfree
- 🔐 **Bank-Grade Security**: Row-Level Security (RLS) with PostgreSQL & Supabase
- 📱 **Mobile-Responsive UI**: Glassmorphism design with smooth animations

---

## 🛠 Tech Stack

A modern, production-grade architecture built for performance, security, and developer experience:

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 15 (App Router) | React framework with server components & optimized routing |
| **Language** | TypeScript | Type-safe development |
| **Styling** | Tailwind CSS + Custom Glassmorphism | Modern, responsive UI components |
| **Animation** | Framer Motion | Smooth interactions & micro-animations |
| **Icons** | Lucide-React | Consistent icon library |
| **Backend/Auth/Database** | Supabase (PostgreSQL) | PostgreSQL database with real-time RLS policies |
| **Payments** | Cashfree | UPI, Card, and Wallet integrations |
| **Notifications** | Telegram Webhooks | Real-time task & payment alerts |

---

## 🚀 Quick Start (Development)

### Prerequisites
- **Node.js** v18 or higher
- **npm** or **yarn** package manager
- Local or remote **Supabase** instance
- Valid **Cashfree** API credentials
- Git

### Installation & Setup

**1. Clone the Repository**
```bash
git clone https://github.com/LakshyaBetala/doitforme_marketplace.git
cd doitforme_marketplace
```

**2. Install Dependencies**
```bash
npm install
# or
yarn install
```

**3. Configure Environment Variables**

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Cashfree Payment Gateway
CASHFREE_APP_ID=your_cashfree_app_id
CASHFREE_SECRET_KEY=your_cashfree_secret_key

# Optional: Admin & Cron Secrets
ADMIN_SECRET=your_admin_secret
CRON_SECRET=your_cron_secret

# Additional keys (if needed)
# Reference .env.example for a complete list
```

**4. Initialize Database**

Run Supabase migrations to set up the database schema:

```bash
# Navigate to supabase directory
cd supabase

# Execute SQL migration files in order (01-08)
# Use Supabase Dashboard → SQL Editor or local CLI
```

See [supabase/README.md](./supabase/README.md) for detailed migration instructions.

**5. Start Development Server**
```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The app will hot-reload on file changes.

**6. Building for Production**
```bash
npm run build
npm start
```

---

## 🔒 Security Architecture

DoItForMe implements **enterprise-grade security** through multiple layers:

### Authentication & Authorization
- **OTP-Based Login**: Email One-Time Passcodes for frictionless authentication (no magic links)
- **Row-Level Security (RLS)**: PostgreSQL policies ensure users only access their own data
- **Role-Based Access Control (RBAC)**: Three distinct user roles with granular permissions

### User Roles

| Role | Permissions | Use Case |
|------|-----------|----------|
| **Student Worker** | Apply for gigs, receive payouts, accept postings | Flexible income generation |
| **Standard Poster** | Post gigs, fund escrow, accept deliveries | Peer-to-peer task posting |
| **Company/Enterprise** | Scale tasks (1-50 workers), bulk hiring, priority support | B2B staffing at scale |

### Escrow & Payment Security
- **Funds Hold**: 3% escrow fee ensures accountability
- **Transactional Integrity**: SQL RPCs handle atomic wallet freezes/unfreezes
- **Automated Release**: Scheduled cron jobs auto-release escrow after task completion windows
- **Audit Trails**: All financial transactions logged for compliance

### Network Security
- **Supabase Auth**: Built-in HTTPS, token rotation, secure session management
- **API Rate Limiting**: Protected endpoints with admin/cron secret headers
- **Real-time RLS**: Supabase real-time listeners respect database policies

---

## 📊 Project Structure

```
doitforme_marketplace/
├── app/                      # Next.js App Router
│   ├── (auth)/              # Authentication pages
│   ├── (dashboard)/         # Protected dashboard routes
│   ├── api/                 # API endpoints & webhooks
│   └── layout.tsx           # Root layout
├── components/              # Reusable React components
├── hooks/                   # Custom React hooks
├── lib/                     # Utility functions & helpers
├── public/                  # Static assets
├── supabase/                # Database migrations & config
│   ├── migrations/          # SQL migration files
│   ├── sql/                 # RPC & schema definitions
│   └── types.ts             # TypeScript types (auto-generated)
├── styles/                  # Global CSS & Tailwind config
├── .env.example             # Example environment variables
├── next.config.js           # Next.js configuration
├── tsconfig.json            # TypeScript configuration
└── README.md                # This file
```

---

## 🔧 Configuration

### Supabase Setup

1. Create a [Supabase project](https://supabase.com)
2. Note your Project URL and API keys
3. Run migrations in the correct order (see `supabase/README.md`)
4. Enable Email Auth with OTP in Supabase Dashboard → Authentication → Providers

### Cashfree Integration

1. Register at [Cashfree](https://cashfree.com)
2. Generate API credentials
3. Add to `.env.local`:
   ```env
   CASHFREE_APP_ID=your_app_id
   CASHFREE_SECRET_KEY=your_secret_key
   ```

### Telegram Notifications (Optional)

Set up Telegram webhooks for real-time notifications:
- Create a Telegram Bot via [@BotFather](https://telegram.me/botfather)
- Configure webhook endpoint in `.env.local`

---

## 📚 API Endpoints

Key API routes (all protected with authentication):

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/login` | POST | OTP login |
| `/api/gigs` | GET, POST | List/create gigs |
| `/api/gigs/[id]` | GET, PATCH | Gig details & updates |
| `/api/applications` | POST | Apply to gigs |
| `/api/payments/verify` | POST | Verify Cashfree payments |
| `/api/cron/auto-release` | GET | Auto-release escrow (cron) |

Full API documentation in `/docs` or via OpenAPI schema.

---

## 🧪 Testing

### Local Testing

1. **Database Testing**: Use Supabase local emulator
   ```bash
   supabase start  # Requires Docker
   ```

2. **Payment Gateway**: Use Cashfree sandbox credentials

3. **Unit Tests**: (To be added)
   ```bash
   npm run test
   ```

### Staging Deployment

- Deploy to Vercel/Railway with staging environment variables
- Test full payment flow with Cashfree sandbox
- Verify OTP emails are being sent

---

## 🚢 Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Connect repository to [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy via Git push

### Self-Hosted

1. Build production bundle: `npm run build`
2. Deploy Node.js app to hosting (Railway, Render, AWS, etc.)
3. Configure environment variables in hosting platform
4. Set up database backups & monitoring

---

## 🐛 Troubleshooting

### Common Issues

**Q: OTP emails not arriving?**
- A: Check Supabase → Authentication → Email Templates
- Verify sender email is configured
- Check spam folder

**Q: Escrow transactions failing?**
- A: Verify all migration files have been run in order
- Check `SUPABASE_SERVICE_ROLE_KEY` is configured
- Review database logs in Supabase dashboard

**Q: Payment verification errors?**
- A: Confirm Cashfree credentials are correct
- Test with sandbox API keys first
- Check webhook signature validation

**Q: RLS policies blocking queries?**
- A: Review PostgreSQL RLS policies in Supabase
- Ensure authenticated user has required roles
- Check network tab in browser DevTools

---

## 📖 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Cashfree Integration Guide](https://docs.cashfree.com)
- [Database Migrations Guide](./supabase/README.md)

---

## 🤝 Contributing

Currently this is a private project. For team members:

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -m "feat: add feature"`
3. Push to branch: `git push origin feature/your-feature`
4. Submit PR for review

---

## 📄 License & Contact

**Private / Proprietary Project**

All rights reserved. This project and its contents are proprietary to the DoItForMe team.

For inquiries, partnership opportunities, or support, contact the DoItForMe Team.

---

<div align="center">
  <p><strong>Built with ❤️ by the DoItForMe Team</strong></p>
  <p><em>Empowering students through technology and opportunity</em></p>
</div>
