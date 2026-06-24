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

const QUERY_KEY = ["multisig", "proposals", MULTISIG_ADDRESS] as const;
const MAX_PROPOSALS = 32;

export function useProposals(count: number) {
  const queryClient = useQueryClient();
  const ids = Array.from({ length: Math.min(count, MAX_PROPOSALS) }, (_, i) => BigInt(i));

  const query = useReadContracts({
    allowFailure: true,
    contracts: ids.map((id) => ({
      address: MULTISIG_ADDRESS,
      abi: multisigAbi,
      functionName: "getProposal",
      args: [id] as const,
    })),
    query: {
      enabled:
        ids.length > 0 &&
        MULTISIG_ADDRESS !== "0x0000000000000000000000000000000000000000",
    },
  });

  useWatchContractEvent({
    address: MULTISIG_ADDRESS,
    abi: multisigAbi,
    onLogs: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const proposals: (ProposalTuple | undefined)[] = (query.data ?? []).map((r) => {
    if (r.status !== "success" || !r.result) return undefined;
    const obj = r.result as Record<string, unknown> & readonly unknown[];
    const get = (key: string, idx: number): unknown => {
      if (obj[key] !== undefined) return obj[key];
      if (Array.isArray(obj) && obj.length > idx) return obj[idx];
      return undefined;
    };
    try {
      return {
        target: get("target", 0) as `0x${string}`,
        value: BigInt(get("value", 1) as bigint),
        data: get("data", 2) as `0x${string}`,
        proposer: get("proposer", 3) as `0x${string}`,
        approvalCount: BigInt(get("approvalCount", 4) as bigint),
        executed: Boolean(get("executed", 5)),
        cancelled: Boolean(get("cancelled", 6)),
      };
    } catch {
      return undefined;
    }
  });

  return {
    proposals,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}