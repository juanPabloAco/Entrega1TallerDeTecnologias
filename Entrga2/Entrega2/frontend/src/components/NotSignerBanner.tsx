import { useAccount } from "wagmi";
import { useIsSigner } from "@/hooks/useMultisigInfo";
import { MULTISIG_ADDRESS } from "@/contracts";
import { truncateAddress } from "@/utils/format";

export function NotSignerBanner() {
  const { address, isConnected } = useAccount();
  const { data: isSigner, isLoading } = useIsSigner(address);

  if (!isConnected) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4 text-sm text-slate-300">
        Connect a wallet to interact with the multisig.
      </div>
    );
  }

  if (MULTISIG_ADDRESS === "0x0000000000000000000000000000000000000000") return null;

  if (isLoading) return null;

  if (isSigner === false) {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
        <p className="font-medium">Connected as {truncateAddress(address!, 6, 4)}</p>
        <p className="mt-1 text-amber-200/80">
          This address is not a signer of the multisig. You can read on-chain data, but proposing,
          approving and executing proposals require signer access.
        </p>
      </div>
    );
  }

  return null;
}
