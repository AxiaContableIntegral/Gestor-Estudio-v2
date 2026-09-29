import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        axia: {
          blue: "#1f4668",
          orange: "#fd6f2f",
          teal: "#33838c",
          cream: "#fefaee",
          gray: "#5b5b5b",
          dark: "#2b2b2b",
        }
      },
    },
  },
  plugins: [],
};
export default config;
