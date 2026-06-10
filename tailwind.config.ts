import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        /* Legacy palette — kept so pages not yet redesigned still build. */
        maroon: { DEFAULT: "#7B1C2E", dark: "#5A1220", light: "#A83048" },
        gold: { DEFAULT: "#C9A84C", light: "#E6C97A", pale: "#F5EED5" },
        cream: "#FDF8F0",
        ivory: "#FAF4E8",
        ink: { DEFAULT: "#2A1A10", mid: "#6B4C3B", light: "#9C7B68" },

        /*
         * `carbon` = the theme's primary deep maroon "ink".
         * It drives the bands, headings, buttons and borders across the
         * redesigned pages. (Kept this token name so the component files
         * don't all need editing — change the value here to re-theme.)
         */
        carbon: { DEFAULT: "#7B1C2E", dark: "#3E0C17" },
        /* `paper` = warm ivory used for the soft alternating section bands. */
        paper: "#FBF7F1",
      },
      fontFamily: {
        display: ["var(--font-assistant)", "sans-serif"],
        body: ["var(--font-assistant)", "sans-serif"],
        serif: ["var(--font-assistant)", "sans-serif"],
      },
      keyframes: {
        fadeDown: {
          "0%": { opacity: "0", transform: "translateY(-6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        fadeDown: "fadeDown 0.15s ease",
        fadeUp: "fadeUp 0.8s cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
