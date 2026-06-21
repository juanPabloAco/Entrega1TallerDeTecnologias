import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";
import { http } from "viem";

// Public Sepolia RPC URLs (in order of preference). Avoid rate-limited
// thirdweb gateways — wagmi/RainbowKit fall back to them if no transport is
// provided, which produces 429s under any non-trivial load.
const ALCHEMY_KEY = import.meta.env.VITE_ALCHEMY_API_KEY || "demo";
const RPC_URLS = [
  `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://rpc.sepolia.org",
];

function pickRpc(): string {
  if (!ALCHEMY_KEY || ALCHEMY_KEY === "demo") return RPC_URLS[1];
  return RPC_URLS[0];
}

const projectId = import.meta.env.VITE_WC_PROJECT_ID || "rainbowkit-demo";

export const config = getDefaultConfig({
  appName: "Multisig DApp",
  projectId,
  chains: [sepolia],
  transports: {
    // Sepolia gets a polling-capable HTTP transport pointing at the user's
    // own Alchemy key (or the public RPC fallback). This avoids the 429s
    // users were hitting when RainbowKit fell back to thirdweb.com.
    [sepolia.id]: http(pickRpc(), { batch: { batchSize: 8 } }),
  },
  ssr: false,
});