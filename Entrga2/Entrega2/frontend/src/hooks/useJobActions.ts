import { useSimulateContract, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { useEffect, useMemo } from "react";
import {
  MARKETPLACE_ADDRESS,
  TOKEN_ADDRESS,
  jobMarketplaceAbi,
  erc20Abi,
} from "@/contracts";

type JobAction =
  | "createJob"
  | "setProvider"
  | "fund"
  | "submit"
  | "complete"
  | "reject"
  | "claimRefund";

export function useJobAction(
  action: JobAction,
  args: readonly unknown[] | undefined,
  value?: bigint,
  enabled = true,
) {
  const { data: simulation, error: simulationError } = useSimulateContract({
    address: MARKETPLACE_ADDRESS,
    abi: jobMarketplaceAbi,
    functionName: action,
    args: args as never,
    value: value as never,
    query: {
      enabled:
        enabled &&
        MARKETPLACE_ADDRESS !== "0x0000000000000000000000000000000000000000" &&
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
    reset,
    submit: () => simulation?.request && writeContract(simulation.request),
  };
}

export function useApproveToken(amount: bigint | undefined, spender = MARKETPLACE_ADDRESS) {
  const { data: simulation, error: simulationError } = useSimulateContract({
    address: TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: "approve",
    args: amount !== undefined ? [spender, amount] : undefined,
    query: {
      enabled:
        amount !== undefined &&
        amount > 0n &&
        TOKEN_ADDRESS !== "0x0000000000000000000000000000000000000000",
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
    reset,
    submit: () => simulation?.request && writeContract(simulation.request),
  };
}

export function useTokenBalance(
  account: `0x${string}` | undefined,
  tokenAddress: `0x${string}` = TOKEN_ADDRESS,
) {
  const { data } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: account ? [account] : undefined,
    query: {
      enabled: Boolean(account) && tokenAddress !== "0x0000000000000000000000000000000000000000",
    },
  });
  return (data as bigint | undefined) ?? 0n;
}

export function useTokenAllowance(
  owner: `0x${string}` | undefined,
  spender: `0x${string}` = MARKETPLACE_ADDRESS,
  tokenAddress: `0x${string}` = TOKEN_ADDRESS,
) {
  const { data } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: owner ? [owner, spender] : undefined,
    query: {
      enabled: Boolean(owner) && tokenAddress !== "0x0000000000000000000000000000000000000000",
    },
  });
  return (data as bigint | undefined) ?? 0n;
}

export type JobRole = "client" | "provider" | "evaluator" | "anyone";

export function useJobRole(
  job: { client: string; provider: string; evaluator: string; status: number } | undefined,
  account: `0x${string}` | undefined,
): JobRole {
  return useMemo(() => {
    if (!account || !job) return "anyone";
    const a = account.toLowerCase();
    if (job.evaluator.toLowerCase() === a) return "evaluator";
    if (job.provider.toLowerCase() === a && job.provider !== "0x0000000000000000000000000000000000000000")
      return "provider";
    if (job.client.toLowerCase() === a) return "client";
    return "anyone";
  }, [job, account]);
}
