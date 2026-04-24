import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  root: path.resolve(__dirname, "client"),

  plugins: [react()],

  build: {
    outDir: "dist", // ✅ FIX HERE (NOT dist/public)
    emptyOutDir: true,
  },

  server: {
    port: 5173,
  },
});
