import { useEffect, useMemo, useState } from "react";
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
  refetchProposals: () => void;
};

type Action = "approve" | "execute" | "cancel";

function useSnapshotMultisigAction(
  action: Action,
  enabled: boolean,
  buildArgs: () => readonly unknown[] | undefined,
) {
  const [snapshot, setSnapshot] = useState<readonly unknown[] | undefined>(undefined);
  const hook = useMultisigAction(action, snapshot, undefined, enabled);
  const click = () => {
    const a = buildArgs();
    if (!a) return;
    setSnapshot(a);
  };
  useEffect(() => {
    if (!snapshot) return;
    const terminal =
      hook.simulationError ||
      hook.writeError ||
      hook.receiptError ||
      hook.isConfirmed;
    if (terminal) {
      if (!hook.isConfirmed) {
        hook.reset?.();
      }
      setSnapshot(undefined);
      return;
    }
    if (hook.canSubmit && !hook.isWriting && !hook.isConfirming) {
      hook.submit?.();
      setSnapshot(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hook.canSubmit,
    snapshot,
    hook.simulationError,
    hook.writeError,
    hook.receiptError,
    hook.isConfirmed,
  ]);
  const simulating = snapshot !== undefined && !hook.canSubmit && !hook.simulationError && !hook.writeError && !hook.receiptError;
  return { ...hook, click, simulating };
}

export function useProposalCard({ id, proposal, threshold, account, refetchProposals }: Args) {
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

  const approveHook = useSnapshotMultisigAction(
    "approve",
    isActive,
    () => (isSigner && isActive && !hasApproved ? [BigInt(id)] : undefined),
  );

  const executeHook = useSnapshotMultisigAction(
    "execute",
    isActive,
    () => (isSigner && isActive ? [BigInt(id)] : undefined),
  );

  const cancelHook = useSnapshotMultisigAction(
    "cancel",
    isActive,
    () => (isSigner && isActive && Boolean(isProposer) ? [BigInt(id)] : undefined),
  );

  useEffect(() => {
    if (approveHook.isConfirmed) {
      refetchHasApproved();
      refetchProposals();
    }
    if (executeHook.isConfirmed) refetchProposals();
    if (cancelHook.isConfirmed) refetchProposals();
  }, [
    approveHook.isConfirmed,
    executeHook.isConfirmed,
    cancelHook.isConfirmed,
    refetchHasApproved,
    refetchProposals,
  ]);

  return useMemo(
    () => ({
      isSigner: isSigner || isSignerLoading,
      hasApproved,
      canApprove: isSigner && isActive && !hasApproved,
      canExecute: isSigner && isActive,
      canCancel: isSigner && isActive && Boolean(isProposer),
      approve: () => {
        approveHook.click();
        setTimeout(refetchHasApproved, 1500);
        setTimeout(refetchProposals, 2000);
      },
      execute: () => executeHook.click(),
      cancel: () => cancelHook.click(),
      approveError:
        approveHook.simulationError || approveHook.writeError || approveHook.receiptError,
      executeError:
        executeHook.simulationError || executeHook.writeError || executeHook.receiptError,
      cancelError:
        cancelHook.simulationError || cancelHook.writeError || cancelHook.receiptError,
      approveBusy: approveHook.isWriting || approveHook.isConfirming,
      executeBusy: executeHook.isWriting || executeHook.isConfirming,
      cancelBusy: cancelHook.isWriting || cancelHook.isConfirming,
      approveConfirmed: approveHook.isConfirmed,
      executeConfirmed: executeHook.isConfirmed,
      cancelConfirmed: cancelHook.isConfirmed,
      approvalsMet,
    }),
    [
      isSigner,
      isSignerLoading,
      hasApproved,
      isActive,
      approvalsMet,
      isProposer,
      approveHook,
      executeHook,
      cancelHook,
      refetchHasApproved,
      refetchProposals,
    ],
  );
}
