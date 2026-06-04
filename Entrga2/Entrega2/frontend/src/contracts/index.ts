import { multisigAbi } from "./Multisig.abi";

export { multisigAbi };

export const MULTISIG_ADDRESS =
  (import.meta.env.VITE_MULTISIG_ADDRESS as `0x${string}` | undefined) ??
  "0x0000000000000000000000000000000000000000";

export const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io";
