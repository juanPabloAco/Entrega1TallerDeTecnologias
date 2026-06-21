import React from "react";
import ReactDOM from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";
import "@rainbow-me/rainbowkit/styles.css";
import "./index.css";
import App from "./App";
import { config } from "./wagmi";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cached reads stay fresh for 30s — wagmi/viem use this to decide
      // whether to re-fetch on mount, refocus, etc. Higher staleTime =
      // dramatically fewer HTTP requests when the page stays open.
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      // Don't refetch on every window focus: only when stale.
      refetchOnWindowFocus: false,
      // Retry failed queries a couple of times so transient RPC errors
      // don't immediately surface as UI errors.
      retry: 2,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme()}
          modalSize="compact"
          initialChain={sepolia}
        >
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
);
