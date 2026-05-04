/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      /* -----------------------------------------
         FONTS
      ----------------------------------------- */
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },

      /* -----------------------------------------
         SWISS MINIMALIST PALETTE
      ----------------------------------------- */
      colors: {
        // Core Theme Colors (Mapped to globals.css variables)
        background: "var(--background)",
        foreground: "var(--foreground)",

        // UI Components — match the surface scale in app/globals.css
        card: {
          DEFAULT: "var(--card)",          // #13131A
          elevated: "var(--card-elevated)", // #1A1A24 (modals, popovers, hover)
          border: "var(--card-border)",
        },

        // Brand Accents — only TWO hues. Anything else is drift.
        brand: {
          purple: "var(--brand-purple)",          // #8825F5 — primary CTA / fills
          "purple-soft": "var(--brand-purple-soft)", // #C9A9FF — inline accent text
          blue: "var(--brand-blue)",              // #0097FF — secondary, sparingly
          // DEPRECATED: aliased to brand-purple so legacy `bg-brand-pink` / `text-brand-pink`
          // call-sites render brand-correct without per-file edits. Migrate consumers,
          // then delete this token entirely.
          pink: "var(--brand-purple)",
          dark: "var(--background)",              // #0B0B11
          glass: "rgba(255,255,255,0.05)",
        },
      },

      /* -----------------------------------------
         ANIMATIONS (PRESERVED & REFINED)
      ----------------------------------------- */
      animation: {
        blob: "blob 10s infinite",
        float: "float 6s ease-in-out infinite",
        marquee: "marquee 30s linear infinite", // Adjusted speed for elegance
      },

      keyframes: {
        blob: {
          "0%": { transform: "translate(0px, 0px) scale(1)" },
          "33%": { transform: "translate(30px, -50px) scale(1.1)" },
          "66%": { transform: "translate(-20px, 20px) scale(0.9)" },
          "100%": { transform: "translate(0px, 0px) scale(1)" },
        },
        float: {
          "0%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" }, // Reduced movement for minimalism
          "100%": { transform: "translateY(0)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },

      /* -----------------------------------------
         BOX SHADOWS
      ----------------------------------------- */
      boxShadow: {
        neon: "0 0 10px rgba(136,37,245, 0.5), 0 0 20px rgba(0,151,255, 0.3)",
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        subtle: "0 1px 2px 0 rgba(0, 0, 0, 0.05)", // New minimalist shadow
      },
    },
  },
  plugins: [],
};