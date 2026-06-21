import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useReadContracts,
  useWatchContractEvent,
  useBlockNumber,
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

export function useJobCount(): number {
  const { data } = useReadContracts({
    contracts: [
      {
        address: MARKETPLACE_ADDRESS,
        abi: jobMarketplaceAbi,
        functionName: "nextJobId",
      },
    ],
    query: {
      enabled: MARKETPLACE_ADDRESS !== "0x0000000000000000000000000000000000000000",
    },
  });
  const v = data?.[0]?.result as bigint | undefined;
  return Number(v ?? 0n);
}

export function useJobs() {
  const count = useJobCount();
  const ids = Array.from({ length: count }, (_, i) => BigInt(i));

  const query = useReadContracts({
    allowFailure: true,
    contracts: ids.map(
      (id) =>
        ({
          address: MARKETPLACE_ADDRESS,
          abi: jobMarketplaceAbi,
          functionName: "getJob",
          args: [id] as const,
        }) as const,
    ),
    query: {
      enabled:
        count > 0 && MARKETPLACE_ADDRESS !== "0x0000000000000000000000000000000000000000",
    },
  });

  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries();

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

  const { data: blockNumber } = useBlockNumber({ watch: true });
  useEffect(() => {
    query.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockNumber]);

  const jobs: (JobTuple | undefined)[] = (query.data ?? []).map((r) => {
    if (r.status !== "success" || !r.result) return undefined;
    const arr = r.result as unknown as readonly unknown[];
    const client = arr[0] as string;
    const provider = arr[1] as string;
    const evaluator = arr[2] as string;
    const budget = arr[3] as bigint;
    const description = arr[4] as string;
    const deliverableRef = arr[5] as `0x${string}`;
    const status = arr[6] as number;
    const expiresAt = arr[7] as bigint;
    return {
      client: client as `0x${string}`,
      provider: provider as `0x${string}`,
      evaluator: evaluator as `0x${string}`,
      budget,
      description,
      deliverableRef,
      status: Number(status),
      expiresAt,
    };
  });

  return { jobs, count, isLoading: query.isLoading, refetch: query.refetch };
}
