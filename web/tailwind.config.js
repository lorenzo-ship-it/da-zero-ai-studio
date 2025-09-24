/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f4f5ff",
          100: "#e5e7ff",
          200: "#d0d5ff",
          300: "#aab4ff",
          400: "#7c86ff",
          500: "#5c64ff",
          600: "#434bdb",
          700: "#3339ab",
          800: "#232879",
          900: "#171b4f"
        }
      }
    }
  },
  plugins: []
};
