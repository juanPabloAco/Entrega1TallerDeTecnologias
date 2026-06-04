import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["@metamask/sdk", "@base-org/account", "@coinbase/wallet-sdk"],
  },
  optimizeDeps: {
    // These are loaded via dynamic import by wagmi connectors, so they
    // don't need (and can't be) statically pre-bundled.
    exclude: ["@base-org/account", "@coinbase/wallet-sdk", "@metamask/sdk"],
  },
  server: {
    port: 5173,
  },
});
