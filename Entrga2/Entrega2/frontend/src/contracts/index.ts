import { multisigAbi } from "./Multisig.abi";
import { jobMarketplaceAbi } from "./JobMarketplace.abi";
import { erc20Abi } from "./MockERC20.abi";

export { multisigAbi, jobMarketplaceAbi, erc20Abi };

const ZERO = "0x0000000000000000000000000000000000000000" as const;

export const MULTISIG_ADDRESS =
  (import.meta.env.VITE_MULTISIG_ADDRESS as `0x${string}` | undefined) ?? ZERO;

export const MARKETPLACE_ADDRESS =
  (import.meta.env.VITE_MARKETPLACE_ADDRESS as `0x${string}` | undefined) ?? ZERO;

export const TOKEN_ADDRESS =
  (import.meta.env.VITE_TOKEN_ADDRESS as `0x${string}` | undefined) ?? ZERO;

export const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io";

export const TOKEN_DECIMALS = 6;

export function shortenAddress(addr: string | undefined, chars = 4): string {
  if (!addr) return "";
  return `${addr.slice(0, chars + 2)}…${addr.slice(-chars)}`;
}

export function explorerLink(addr: string, type: "address" | "tx" = "address"): string {
  return `${SEPOLIA_EXPLORER}/${type}/${addr}`;
}
