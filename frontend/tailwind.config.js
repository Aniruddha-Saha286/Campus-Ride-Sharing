/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7ff",
          100: "#d9edff",
          200: "#bce0ff",
          300: "#8fcdff",
          400: "#5bb3ff",
          500: "#2f95ff",
          600: "#1877f2",
          700: "#145fd1",
          800: "#164ea8",
          900: "#174485",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 10px 30px -12px rgba(24, 119, 242, 0.25)",
      },
    },
  },
  plugins: [],
};
