import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Port 5173 falls inside a Windows-reserved port range (5102-5201) on some
  // machines, so the dev server fails with EACCES. 3000 avoids that.
  server: { port: 3000 },
});
