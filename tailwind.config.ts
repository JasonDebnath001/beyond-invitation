import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        maroon: {
          DEFAULT: "#7B1C2E",
          dark: "#5A1220",
          light: "#A83048",
        },
        gold: {
          DEFAULT: "#C9A84C",
          light: "#E6C97A",
          pale: "#F5EED5",
        },
        cream: "#FDF8F0",
        ivory: "#FAF4E8",
        ink: {
          DEFAULT: "#2A1A10",
          mid: "#6B4C3B",
          light: "#9C7B68",
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', "serif"],
        body: ['"DM Sans"', "sans-serif"],
        serif: ['"Cormorant Garamond"', "serif"],
      },
      keyframes: {
        fadeDown: {
          "0%": { opacity: "0", transform: "translateY(-6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        fadeDown: "fadeDown 0.15s ease",
      },
    },
  },
  plugins: [],
};

export default config;
