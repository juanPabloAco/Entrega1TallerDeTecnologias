import { useEffect, useMemo, useState } from "react";
import {
  useReadContract,
  useSimulateContract,
  useWaitForTransactionReceipt,
  useWalletClient,
} from "wagmi";
import { MULTISIG_ADDRESS, multisigAbi } from "@/contracts";
import { useIsSigner } from "@/hooks/useMultisigInfo";
import type { ProposalTuple } from "@/hooks/useProposals";

type Args = {
  id: number;
  proposal: ProposalTuple;
  threshold: bigint;
  account: `0x${string}` | undefined;
  refetchProposals: () => void;
};

type Action = "approve" | "execute" | "cancel";

function useIsolatedMultisigAction(action: Action, args: readonly unknown[] | undefined) {
  const enabled =
    Boolean(args) && MULTISIG_ADDRESS !== "0x0000000000000000000000000000000000000000";

  const { data: simulation, error: simulationError } = useSimulateContract({
    address: MULTISIG_ADDRESS,
    abi: multisigAbi,
    functionName: action,
    args: args as never,
    query: { enabled },
  });

  const { data: walletClient } = useWalletClient();

  const [hash, setHash] = useState<`0x${string}` | undefined>(undefined);
  const [isWriting, setIsWriting] = useState(false);
  const [writeError, setWriteError] = useState<Error | null>(null);

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isConfirmed) {
      const t = setTimeout(() => {
        setHash(undefined);
        setIsWriting(false);
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [isConfirmed]);

  const click = async () => {
    setWriteError(null);
    if (!simulation?.request) {
      const errMsg = simulationError
        ? `La simulación falló: ${simulationError.message.slice(0, 200)}`
        : "No hay simulación lista. Esperá unos segundos y reintentá.";
      console.warn(`[${action}] no simulation request available`, { simulation, simulationError });
      setWriteError(new Error(errMsg));
      return;
    }
    if (!walletClient) {
      setWriteError(new Error("Wallet no conectada."));
      return;
    }
    setIsWriting(true);
    try {
      const txHash = await walletClient.writeContract(simulation.request);
      setHash(txHash);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setWriteError(err);
      setIsWriting(false);
      console.error(`[${action}] writeContract failed:`, e);
    }
  };

  const reset = () => {
    setHash(undefined);
    setIsWriting(false);
    setWriteError(null);
  };

  return {
    click,
    isWriting,
    isConfirming,
    isConfirmed,
    simulationError: simulationError as Error | null,
    writeError,
    receiptError: receiptError as Error | null,
    reset,
    hasRequest: Boolean(simulation?.request),
  };
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

  const approveArgs: readonly unknown[] | undefined =
    isSigner && isActive && !hasApproved ? [BigInt(id)] : undefined;
  const executeArgs: readonly unknown[] | undefined =
    isSigner && isActive && approvalsMet ? [BigInt(id)] : undefined;
  const cancelArgs: readonly unknown[] | undefined =
    isSigner && isActive && Boolean(isProposer) ? [BigInt(id)] : undefined;

  const approveHook = useIsolatedMultisigAction("approve", approveArgs);
  const executeHook = useIsolatedMultisigAction("execute", executeArgs);
  const cancelHook = useIsolatedMultisigAction("cancel", cancelArgs);

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
      canExecute: isSigner && isActive && approvalsMet,
      canCancel: isSigner && isActive && Boolean(isProposer),
      approve: async () => {
        await approveHook.click();
        setTimeout(refetchHasApproved, 1500);
        setTimeout(refetchProposals, 2000);
      },
      execute: () => executeHook.click(),
      cancel: () => cancelHook.click(),
      approveError: approveHook.simulationError || approveHook.writeError || approveHook.receiptError,
      executeError: executeHook.simulationError || executeHook.writeError || executeHook.receiptError,
      cancelError: cancelHook.simulationError || cancelHook.writeError || cancelHook.receiptError,
      approveBusy: approveHook.isWriting || approveHook.isConfirming,
      executeBusy: executeHook.isWriting || executeHook.isConfirming,
      cancelBusy: cancelHook.isWriting || cancelHook.isConfirming,
      approveConfirmed: approveHook.isConfirmed,
      executeConfirmed: executeHook.isConfirmed,
      cancelConfirmed: cancelHook.isConfirmed,
      approvalsMet,
      resetApprove: approveHook.reset,
      resetExecute: executeHook.reset,
      resetCancel: cancelHook.reset,
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
