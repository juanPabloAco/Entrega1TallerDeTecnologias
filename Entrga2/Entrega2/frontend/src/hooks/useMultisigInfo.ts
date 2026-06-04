import { useReadContract, useReadContracts } from "wagmi";
import { useMemo } from "react";
import { MULTISIG_ADDRESS, multisigAbi } from "@/contracts";

export function useSigners() {
  return useReadContract({
    address: MULTISIG_ADDRESS,
    abi: multisigAbi,
    functionName: "getSigners",
    query: { enabled: MULTISIG_ADDRESS !== "0x0000000000000000000000000000000000000000" },
  });
}

export function useThreshold() {
  return useReadContract({
    address: MULTISIG_ADDRESS,
    abi: multisigAbi,
    functionName: "threshold",
    query: { enabled: MULTISIG_ADDRESS !== "0x0000000000000000000000000000000000000000" },
  });
}

export function useProposalCount() {
  return useReadContract({
    address: MULTISIG_ADDRESS,
    abi: multisigAbi,
    functionName: "proposalCount",
    query: { enabled: MULTISIG_ADDRESS !== "0x0000000000000000000000000000000000000000" },
  });
}

export function useIsSigner(account: `0x${string}` | undefined) {
  return useReadContract({
    address: MULTISIG_ADDRESS,
    abi: multisigAbi,
    functionName: "isSigner",
    args: account ? [account] : undefined,
    query: {
      enabled: Boolean(account) && MULTISIG_ADDRESS !== "0x0000000000000000000000000000000000000000",
    },
  });
}

export function useMultisigInfo() {
  const signers = useSigners();
  const threshold = useThreshold();
  const proposalCount = useProposalCount();

  return useMemo(
    () => ({
      signers: (signers.data as `0x${string}`[] | undefined) ?? [],
      threshold: (threshold.data as bigint | undefined) ?? 0n,
      proposalCount: Number(proposalCount.data ?? 0n),
      isLoading: signers.isLoading || threshold.isLoading || proposalCount.isLoading,
      isError: signers.isError || threshold.isError || proposalCount.isError,
      refetch: () => {
        signers.refetch();
        threshold.refetch();
        proposalCount.refetch();
      },
    }),
    [signers, threshold, proposalCount],
  );
}

export function useHasApprovedBatch(proposalId: number, signers: `0x${string}`[]) {
  return useReadContracts({
    contracts: signers.map((s) => ({
      address: MULTISIG_ADDRESS,
      abi: multisigAbi,
      functionName: "hasApproved",
      args: [BigInt(proposalId), s] as const,
    })),
    query: {
      enabled:
        signers.length > 0 && MULTISIG_ADDRESS !== "0x0000000000000000000000000000000000000000",
    },
  });
}
