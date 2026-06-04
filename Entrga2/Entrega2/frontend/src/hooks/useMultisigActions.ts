import { useSimulateContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useEffect } from "react";
import { MULTISIG_ADDRESS, multisigAbi } from "@/contracts";

type Action = "propose" | "approve" | "execute" | "cancel";

export function useMultisigAction(
  action: Action,
  args: readonly unknown[] | undefined,
  value?: bigint,
  enabled = true,
) {
  const { data: simulation, error: simulationError } = useSimulateContract({
    address: MULTISIG_ADDRESS,
    abi: multisigAbi,
    functionName: action,
    // wagmi's TS expects a strict tuple for each function; cast through unknown
    // keeps call sites simple while preserving inference on the result.
    args: args as never,
    value: value as never,
    query: {
      enabled:
        enabled &&
        MULTISIG_ADDRESS !== "0x0000000000000000000000000000000000000000" &&
        args !== undefined,
    },
  });

  const {
    writeContract,
    data: hash,
    isPending: isWriting,
    error: writeError,
    reset,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isConfirmed) {
      const t = setTimeout(() => reset(), 3000);
      return () => clearTimeout(t);
    }
  }, [isConfirmed, reset]);

  return {
    canSubmit: Boolean(simulation?.request),
    isWriting,
    isConfirming,
    isConfirmed,
    simulationError,
    writeError,
    receiptError,
    hash,
    submit: () => simulation?.request && writeContract(simulation.request),
  };
}
