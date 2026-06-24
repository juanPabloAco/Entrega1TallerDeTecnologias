import {
  useSimulateContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useWalletClient,
  useWatchContractEvent,
} from "wagmi";
import { useEffect, useMemo, useState } from "react";
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
  const isEnabled =
    enabled &&
    MARKETPLACE_ADDRESS !== "0x0000000000000000000000000000000000000000" &&
    args !== undefined;

  const { data: simulation, error: simulationError } = useSimulateContract({
    address: MARKETPLACE_ADDRESS,
    abi: jobMarketplaceAbi,
    functionName: action,
    args: args as never,
    value: value as never,
    query: { enabled: isEnabled },
  });

  const { data: walletClient } = useWalletClient();
  const [hash, setHash] = useState<`0x${string}` | undefined>(undefined);
  const [isWriting, setIsWriting] = useState(false);
  const [writeError, setWriteError] = useState<Error | null>(null);
  const [hasUnacknowledgedError, setHasUnacknowledgedError] = useState(false);

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

  useEffect(() => {
    if (writeError || receiptError) setHasUnacknowledgedError(true);
  }, [writeError, receiptError]);

  const submit = async () => {
    if (!simulation?.request) {
      console.warn(`[${action}] no simulation request available`, { simulation, simulationError });
      setWriteError(new Error("No hay simulación lista. Reintentá."));
      return;
    }
    if (!walletClient) {
      setWriteError(new Error("Wallet no conectada."));
      return;
    }
    if (isWriting || isConfirming) return;
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
    setHasUnacknowledgedError(false);
  };

  return {
    canSubmit: Boolean(simulation?.request) && !hasUnacknowledgedError,
    isWriting,
    isConfirming,
    isConfirmed,
    simulationError: simulationError as Error | null,
    writeError,
    receiptError: receiptError as Error | null,
    hasUnacknowledgedError,
    hash,
    reset,
    submit,
  };
}

export function useApproveToken(amount: bigint | undefined, spender = MARKETPLACE_ADDRESS) {
  const isEnabled =
    amount !== undefined &&
    amount > 0n &&
    TOKEN_ADDRESS !== "0x0000000000000000000000000000000000000000";

  const { data: simulation, error: simulationError } = useSimulateContract({
    address: TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: "approve",
    args: amount !== undefined ? [spender, amount] : undefined,
    query: { enabled: isEnabled },
  });

  const { data: walletClient } = useWalletClient();
  const [hash, setHash] = useState<`0x${string}` | undefined>(undefined);
  const [isWriting, setIsWriting] = useState(false);
  const [writeError, setWriteError] = useState<Error | null>(null);
  const [hasUnacknowledgedError, setHasUnacknowledgedError] = useState(false);

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

  useEffect(() => {
    if (writeError || receiptError) setHasUnacknowledgedError(true);
  }, [writeError, receiptError]);

  const submit = async () => {
    if (!simulation?.request) {
      console.warn(`[approve] no simulation request available`, { simulation, simulationError });
      setWriteError(new Error("No hay simulación lista. Reintentá."));
      return;
    }
    if (!walletClient) {
      setWriteError(new Error("Wallet no conectada."));
      return;
    }
    if (isWriting || isConfirming) return;
    setIsWriting(true);
    try {
      const txHash = await walletClient.writeContract(simulation.request);
      setHash(txHash);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setWriteError(err);
      setIsWriting(false);
      console.error(`[approve] writeContract failed:`, e);
    }
  };

  const reset = () => {
    setHash(undefined);
    setIsWriting(false);
    setWriteError(null);
    setHasUnacknowledgedError(false);
  };

  return {
    canSubmit: Boolean(simulation?.request) && !hasUnacknowledgedError,
    isWriting,
    isConfirming,
    isConfirmed,
    simulationError: simulationError as Error | null,
    writeError,
    receiptError: receiptError as Error | null,
    hasUnacknowledgedError,
    hash,
    reset,
    submit,
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
  const { data, refetch } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: owner ? [owner, spender] : undefined,
    query: {
      enabled: Boolean(owner) && tokenAddress !== "0x0000000000000000000000000000",
      refetchInterval: 15_000,
      staleTime: 5_000,
    },
  });

  useWatchContractEvent({
    address: tokenAddress,
    abi: erc20Abi,
    eventName: "Approval",
    args: owner ? { owner, spender } : undefined,
    onLogs: () => {
      refetch();
    },
    enabled: Boolean(owner) && tokenAddress !== "0x0000000000000000000000000000",
  });

  return { allowance: (data as bigint | undefined) ?? 0n, refetch };
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
