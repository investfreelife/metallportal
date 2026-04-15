import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0d0d1a",
        foreground: "#ffffff",
        gold: {
          DEFAULT: "#E8B86D",
          light: "#f0cc8a",
          dark: "#c9993e",
        },
        surface: {
          DEFAULT: "#15152a",
          light: "#1e1e38",
          border: "#2a2a4a",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
