import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            // Force pino's debug dependency to use the ESM build. Without this, Vite
            // tries to import the CommonJS `browser.js` of `debug` and fails with
            // "does not provide an export named 'default'".
            debug: "debug/src/browser.js",
        },
        dedupe: ["@metamask/sdk", "@base-org/account", "@coinbase/wallet-sdk"],
    },
    optimizeDeps: {
        include: [
            "debug",
            "pino",
            "@tanstack/react-query",
            "wagmi",
            "@wagmi/core",
            "viem",
            "@rainbow-me/rainbowkit",
        ],
        exclude: ["@base-org/account", "@coinbase/wallet-sdk", "@metamask/sdk"],
    },
    server: {
        port: 5173,
    },
});
