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
         BRAND COLORS
      ----------------------------------------- */
      colors: {
        brand: {
          purple: "#8825F5",
          pink: "#D31CE7",
          blue: "#0097FF",
          dark: "#0B0B11",   // Main background
          darker: "#06060A", // Footer background
          glass: "rgba(255,255,255,0.05)",
        },
      },

      /* -----------------------------------------
         ANIMATIONS
      ----------------------------------------- */
      animation: {
        blob: "blob 10s infinite",
        float: "float 6s ease-in-out infinite",
        marquee: "marquee 25s linear infinite", // <--- CRITICAL FOR TICKER
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
          "50%": { transform: "translateY(-18px)" },
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
      },
    },
  },
  plugins: [],
};