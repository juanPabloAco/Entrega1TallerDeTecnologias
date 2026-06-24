import { useMultisigInfo } from "@/hooks/useMultisigInfo";
import { useProposals } from "@/hooks/useProposals";
import { ProposalCard } from "./ProposalCard";

export function ProposalList() {
  const { proposalCount, threshold, isLoading: infoLoading, refetch: refetchInfo } = useMultisigInfo();
  const { proposals, isLoading, isError, refetch } = useProposals(proposalCount);

  const refreshAll = () => {
    refetchInfo();
    refetch();
  };

  if (infoLoading) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <p className="text-sm text-slate-400">Loading contract…</p>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6">
        <p className="text-sm text-rose-300">Failed to read proposals. Check the contract address.</p>
        <button
          onClick={() => refreshAll()}
          className="mt-2 text-xs text-indigo-300 hover:underline"
        >
          Retry
        </button>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Proposals ({proposalCount})
        </h2>
        <button
          onClick={() => refreshAll()}
          className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
        >
          Refresh
        </button>
      </div>

      {isLoading && proposalCount === 0 ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : proposalCount === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">
          No proposals yet. Create one using the form above.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {proposals.map((p, i) =>
            p ? (
              <ProposalCard
                key={i}
                id={i}
                proposal={p}
                threshold={threshold}
                refetchProposals={refreshAll}
              />
            ) : (
              <div
                key={i}
                className="rounded-xl border border-slate-800 bg-slate-900/30 p-5 text-sm text-slate-500"
              >
                Loading proposal #{i}…
              </div>
            ),
          )}
        </div>
      )}
    </section>
  );
}
