This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Supabase OTP Setup

If you want to use email One-Time Passwords (OTP) instead of Magic Links, update your Supabase Email Template:

- In the Supabase Dashboard go to **Authentication → Templates → Email Templates** (or, for self-hosted/local, edit your email templates).
- Modify the template used for sign-in to include the token variable `{{ .Token }}` where you want the 6-digit code to appear, for example:

	<h2>One time login code</h2>
	<p>Please enter this code: {{ .Token }}</p>

- Do NOT rely on `emailRedirectTo` in the client when you want OTP-only flow — removing the redirect avoids sending a magic link. The app already uses `signInWithOtp` and `verifyOtp` in the client.

Security notes:
- By default OTPs expire after 1 hour and users can request an OTP once every 60 seconds. Configure these in the Dashboard under **Auth → Providers → Email** if needed, but keep expirations short to reduce brute-force risk.
