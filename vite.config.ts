import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  root: path.resolve(__dirname, "client"),

  plugins: [react()],

  build: {
    outDir: "dist/public", // ✅ FIXED
    emptyOutDir: true,
  },

  server: {
    port: 5173,
  },
});
