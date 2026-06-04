import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";
import { http } from "viem";

const projectId = import.meta.env.VITE_WC_PROJECT_ID || "rainbowkit-demo";

export const config = getDefaultConfig({
  appName: "Multisig DApp",
  projectId,
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(),
  },
  ssr: false,
});
