import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useReadContracts, useWatchContractEvent } from "wagmi";
import { MULTISIG_ADDRESS, multisigAbi } from "@/contracts";

export type ProposalTuple = {
  target: `0x${string}`;
  value: bigint;
  data: `0x${string}`;
  proposer: `0x${string}`;
  approvalCount: bigint;
  executed: boolean;
  cancelled: boolean;
};

export function useProposals(count: number) {
  const queryClient = useQueryClient();
  const ids = Array.from({ length: count }, (_, i) => BigInt(i));

  const query = useReadContracts({
    contracts: ids.map((id) => ({
      address: MULTISIG_ADDRESS,
      abi: multisigAbi,
      functionName: "getProposal",
      args: [id] as const,
    })),
    query: {
      enabled:
        count > 0 && MULTISIG_ADDRESS !== "0x0000000000000000000000000000000000000000",
    },
  });

  // Refresh on any relevant event
  const eventConfig = {
    address: MULTISIG_ADDRESS,
    abi: multisigAbi,
  } as const;

  useWatchContractEvent({
    ...eventConfig,
    eventName: "ProposalCreated",
    onLogs: () => queryClient.invalidateQueries(),
  });
  useWatchContractEvent({
    ...eventConfig,
    eventName: "ProposalApproved",
    onLogs: () => queryClient.invalidateQueries(),
  });
  useWatchContractEvent({
    ...eventConfig,
    eventName: "ProposalExecuted",
    onLogs: () => queryClient.invalidateQueries(),
  });
  useWatchContractEvent({
    ...eventConfig,
    eventName: "ProposalCancelled",
    onLogs: () => queryClient.invalidateQueries(),
  });
  useWatchContractEvent({
    ...eventConfig,
    eventName: "SignerAdded",
    onLogs: () => queryClient.invalidateQueries(),
  });
  useWatchContractEvent({
    ...eventConfig,
    eventName: "SignerRemoved",
    onLogs: () => queryClient.invalidateQueries(),
  });
  useWatchContractEvent({
    ...eventConfig,
    eventName: "ThresholdChanged",
    onLogs: () => queryClient.invalidateQueries(),
  });

  // Use a refetch interval as a fallback for networks where watch events
  // are slow. Keeps the UI snappy.
  useEffect(() => {
    const id = setInterval(() => {
      query.refetch();
    }, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const proposals: (ProposalTuple | undefined)[] = (query.data ?? []).map((r: { status: string; result?: unknown }) => {
    if (r.status !== "success" || !r.result) return undefined;
    const [target, value, data, proposer, approvalCount, executed, cancelled] = r.result as [
      `0x${string}`,
      bigint,
      `0x${string}`,
      `0x${string}`,
      bigint,
      boolean,
      boolean,
    ];
    return { target, value, data, proposer, approvalCount, executed, cancelled };
  });

  return {
    proposals,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
