import { useMemo } from "react";
import { useReadContract } from "wagmi";
import { MULTISIG_ADDRESS, multisigAbi } from "@/contracts";
import { useIsSigner } from "@/hooks/useMultisigInfo";
import { useMultisigAction } from "@/hooks/useMultisigActions";
import type { ProposalTuple } from "@/hooks/useProposals";

type Args = {
  id: number;
  proposal: ProposalTuple;
  threshold: bigint;
  account: `0x${string}` | undefined;
};

export function useProposalCard({ id, proposal, threshold, account }: Args) {
  const { data: isSignerData, isLoading: isSignerLoading } = useIsSigner(account);

  const { data: hasApprovedData, refetch: refetchHasApproved } = useReadContract({
    address: MULTISIG_ADDRESS,
    abi: multisigAbi,
    functionName: "hasApproved",
    args: account ? [BigInt(id), account] : undefined,
    query: {
      enabled:
        Boolean(account) &&
        MULTISIG_ADDRESS !== "0x0000000000000000000000000000000000000000",
    },
  });

  const isSigner = Boolean(isSignerData);
  const hasApproved = Boolean(hasApprovedData);

  const approvalsMet = proposal.approvalCount >= threshold;
  const isActive = !proposal.executed && !proposal.cancelled;
  const isProposer = account && account.toLowerCase() === proposal.proposer.toLowerCase();

  const approveHook = useMultisigAction("approve", isSigner && isActive && !hasApproved ? [BigInt(id)] : undefined, undefined, !proposal.executed && !proposal.cancelled);

  const executeHook = useMultisigAction(
    "execute",
    isSigner && isActive && approvalsMet ? [BigInt(id)] : undefined,
  );

  const cancelHook = useMultisigAction(
    "cancel",
    isSigner && isActive && isProposer ? [BigInt(id)] : undefined,
  );

  return useMemo(
    () => ({
      isSigner: isSigner || isSignerLoading,
      hasApproved,
      canApprove: isSigner && isActive && !hasApproved,
      canExecute: isSigner && isActive && approvalsMet,
      canCancel: isSigner && isActive && Boolean(isProposer),
      approve: () => {
        approveHook.submit?.();
        setTimeout(refetchHasApproved, 1500);
      },
      execute: () => executeHook.submit?.(),
      cancel: () => cancelHook.submit?.(),
      pending: approveHook.isWriting || approveHook.isConfirming,
    }),
    [isSigner, isSignerLoading, hasApproved, isActive, approvalsMet, isProposer, approveHook, executeHook, cancelHook, refetchHasApproved],
  );
}
