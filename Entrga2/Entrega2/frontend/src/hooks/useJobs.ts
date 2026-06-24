import { useMemo, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useReadContract,
  useWatchContractEvent,
  usePublicClient,
} from "wagmi";
import {
  MARKETPLACE_ADDRESS,
  jobMarketplaceAbi,
} from "@/contracts";

export type JobStatus =
  | "None"
  | "Open"
  | "Funded"
  | "Submitted"
  | "Completed"
  | "Rejected"
  | "Expired";

export type JobTuple = {
  client: `0x${string}`;
  provider: `0x${string}`;
  evaluator: `0x${string}`;
  budget: bigint;
  description: string;
  deliverableRef: `0x${string}`;
  status: number;
  expiresAt: bigint;
};

export const STATUS_LABEL: Record<number, JobStatus> = {
  0: "None",
  1: "Open",
  2: "Funded",
  3: "Submitted",
  4: "Completed",
  5: "Rejected",
  6: "Expired",
};

export const STATUS_BADGE: Record<number, string> = {
  0: "bg-slate-700 text-slate-300",
  1: "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40",
  2: "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/40",
  3: "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/40",
  4: "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40",
  5: "bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40",
  6: "bg-slate-500/20 text-slate-300 ring-1 ring-slate-500/40",
};

const MAX_JOBS = 64;

function parseJobResult(result: unknown): JobTuple | undefined {
  if (!result || typeof result !== "object") return undefined;
  const r = result as Record<string, unknown> & readonly unknown[];
  const get = (key: string, idx: number): unknown => {
    if (r[key] !== undefined) return r[key];
    if (Array.isArray(r) && r.length > idx) return r[idx];
    return undefined;
  };
  try {
    const status = Number(get("status", 6) as number);
    if (status === 0) return undefined;
    const ZERO_BYTES32 = ("0x" + "0".repeat(64)) as `0x${string}`;
    return {
      client: get("client", 0) as `0x${string}`,
      provider: get("provider", 1) as `0x${string}`,
      evaluator: get("evaluator", 2) as `0x${string}`,
      budget: BigInt(get("budget", 3) as bigint),
      description: String(get("description", 4) ?? ""),
      deliverableRef:
        (get("deliverableRef", 5) as `0x${string}` | undefined) ?? ZERO_BYTES32,
      status,
      expiresAt: BigInt(get("expiresAt", 7) as bigint),
    };
  } catch (e) {
    console.warn("[parseJobResult] failed:", e, "raw:", result);
    return undefined;
  }
}

function useJobCount(): {
  count: number;
  refetch: () => void;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
} {
  const enabled = MARKETPLACE_ADDRESS !== "0x0000000000000000000000000000000000000000";
  const q = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: jobMarketplaceAbi,
    functionName: "nextJobId",
    query: {
      enabled,
      refetchInterval: 30_000,
    },
  });
  const count = useMemo(() => {
    if (!q.data) return 0;
    const v = q.data as unknown as bigint;
    return Math.min(Number(v), MAX_JOBS);
  }, [q.data]);

  useEffect(() => {
    if (q.error) console.warn("[useJobCount] error:", q.error);
  }, [q.error]);

  return {
    count,
    refetch: q.refetch,
    isLoading: q.isLoading,
    isFetching: q.isFetching,
    isError: q.isError,
    error: q.error,
  };
}

function useJobById(jobId: number, enabled: boolean, refetchTrigger: number = 0): {
  job: JobTuple | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
} {
  const publicClient = usePublicClient();
  const [data, setData] = useState<JobTuple | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setData(undefined);
      setIsLoading(false);
      return;
    }
    if (!publicClient) {
      setIsLoading(true);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const result = await publicClient.readContract({
          address: MARKETPLACE_ADDRESS,
          abi: jobMarketplaceAbi,
          functionName: "getJob",
          args: [BigInt(jobId)],
        });
        if (cancelled) return;
        const parsed = parseJobResult(result);
        setData(parsed);
        setIsLoading(false);
      } catch (e) {
        if (cancelled) return;
        console.warn(`[useJobById ${jobId}] error:`, e);
        setError(e);
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [publicClient, jobId, enabled, tick, refetchTrigger]);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [enabled]);

  return {
    job: data,
    isLoading,
    isError: !!error,
    error,
    refetch: () => setTick((t) => t + 1),
  };
}

export function useJobs() {
  const queryClient = useQueryClient();
  const countQuery = useJobCount();
  const count = countQuery.count;

  const [refetchTick, setRefetchTick] = useState(0);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["marketplace"] });
    setRefetchTick((t) => t + 1);
  };

  useWatchContractEvent({
    address: MARKETPLACE_ADDRESS,
    abi: jobMarketplaceAbi,
    eventName: "JobCreated",
    onLogs: invalidate,
  });
  useWatchContractEvent({
    address: MARKETPLACE_ADDRESS,
    abi: jobMarketplaceAbi,
    eventName: "ProviderSet",
    onLogs: invalidate,
  });
  useWatchContractEvent({
    address: MARKETPLACE_ADDRESS,
    abi: jobMarketplaceAbi,
    eventName: "JobFunded",
    onLogs: invalidate,
  });
  useWatchContractEvent({
    address: MARKETPLACE_ADDRESS,
    abi: jobMarketplaceAbi,
    eventName: "JobSubmitted",
    onLogs: invalidate,
  });
  useWatchContractEvent({
    address: MARKETPLACE_ADDRESS,
    abi: jobMarketplaceAbi,
    eventName: "JobCompleted",
    onLogs: invalidate,
  });
  useWatchContractEvent({
    address: MARKETPLACE_ADDRESS,
    abi: jobMarketplaceAbi,
    eventName: "JobRejected",
    onLogs: invalidate,
  });
  useWatchContractEvent({
    address: MARKETPLACE_ADDRESS,
    abi: jobMarketplaceAbi,
    eventName: "RefundClaimed",
    onLogs: invalidate,
  });

  return {
    count,
    isLoading: countQuery.isLoading,
    isFetching: countQuery.isFetching,
    isError: countQuery.isError,
    error: countQuery.error,
    refetchTick,
    refetch: () => {
      countQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ["marketplace", "job"] });
      setRefetchTick((t) => t + 1);
    },
  };
}

export { useJobById };