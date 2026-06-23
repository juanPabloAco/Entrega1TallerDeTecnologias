import { useAccount } from "wagmi";
import { useProposalCard } from "@/hooks/useProposalCard";
import { SEPOLIA_EXPLORER } from "@/contracts";
import { truncateAddress, formatEther } from "@/utils/format";
import type { ProposalTuple } from "@/hooks/useProposals";

type Props = {
  id: number;
  proposal: ProposalTuple;
  threshold: bigint;
  refetchProposals: () => void;
};

function humanizeError(e: Error | null | undefined): string {
  if (!e) return "";
  const m = e.message || "";
  const match = m.match(/reverted with(?: custom error)? ['"]?([^'"]+)['"]?/);
  if (match) return `Contrato revirtió: ${match[1]}`;
  if (/User rejected|denied/i.test(m)) return "Transacción rechazada en la wallet.";
  if (/insufficient funds/i.test(m)) return "Sin fondos para gas.";
  return m.slice(0, 200);
}

export function ProposalCard({ id, proposal, threshold, refetchProposals }: Props) {
  const { address: account, isConnected } = useAccount();

  const {
    isSigner,
    hasApproved,
    canExecute,
    canCancel,
    approve,
    execute,
    cancel,
    approveError,
    executeError,
    cancelError,
    approveBusy,
    executeBusy,
    cancelBusy,
    approveConfirmed,
    executeConfirmed,
    cancelConfirmed,
    approvalsMet,
  } = useProposalCard({ id, proposal, threshold, account, refetchProposals });

  const approvals = Number(proposal.approvalCount);
  const thresh = Number(threshold);
  const status = proposal.executed
    ? "Executed"
    : proposal.cancelled
      ? "Cancelled"
      : "Pending";

  const statusColor = proposal.executed
    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
    : proposal.cancelled
      ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
      : "bg-amber-500/20 text-amber-300 border-amber-500/30";

  const errorBanner = (e: Error | null | undefined) =>
    e ? (
      <p className="mt-2 text-xs text-rose-300 bg-rose-500/10 rounded px-2 py-1 break-all">
        {humanizeError(e)}
      </p>
    ) : null;

  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900/30 p-5 transition hover:border-slate-700">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">Proposal #{id}</p>
          <a
            href={`${SEPOLIA_EXPLORER}/address/${proposal.target}`}
            target="_blank"
            rel="noreferrer"
            className="break-all font-mono text-sm text-slate-100 hover:text-indigo-300"
          >
            {proposal.target}
          </a>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusColor}`}
        >
          {status}
        </span>
      </header>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Value</dt>
          <dd className="font-mono text-slate-100">
            {formatEther(proposal.value)} <span className="text-slate-500">ETH</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Approvals</dt>
          <dd className="font-mono text-slate-100">
            <span className={approvals >= thresh ? "text-emerald-400" : ""}>
              {approvals}
            </span>
            <span className="text-slate-500"> / {thresh}</span>
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-slate-500">Proposer</dt>
          <dd className="font-mono text-slate-300">{truncateAddress(proposal.proposer, 8, 6)}</dd>
        </div>
        {proposal.data && proposal.data !== "0x" && (
          <div className="col-span-2">
            <dt className="text-xs text-slate-500">Calldata</dt>
            <dd className="break-all rounded bg-slate-950/60 p-2 font-mono text-xs text-slate-400">
              {proposal.data}
            </dd>
          </div>
        )}
      </dl>

      {isConnected && isSigner && !proposal.executed && !proposal.cancelled && (
        <footer className="mt-4 flex flex-wrap gap-2">
          <ActionButton
            label={
              hasApproved
                ? "Approved"
                : approveConfirmed
                  ? "Approved ✓"
                  : approveBusy
                    ? "Confirming…"
                    : approveError
                      ? "Reintentar Approve"
                      : "Approve"
            }
            disabled={hasApproved || approveBusy}
            onClick={approve}
            variant="primary"
          />
          <ActionButton
            label={
              executeConfirmed
                ? "Executed ✓"
                : executeBusy
                  ? "Confirming…"
                  : executeError
                    ? "Reintentar Execute"
                    : "Execute"
            }
            disabled={!canExecute || executeBusy}
            onClick={execute}
            variant="success"
            hint={!approvalsMet ? `Need ${Number(threshold) - approvals} more approval(s)` : undefined}
          />
          <ActionButton
            label={
              cancelConfirmed
                ? "Cancelled ✓"
                : cancelBusy
                  ? "Confirming…"
                  : cancelError
                    ? "Reintentar Cancel"
                    : "Cancel"
            }
            disabled={!canCancel || cancelBusy}
            onClick={cancel}
            variant="danger"
            hint={!canCancel && account !== proposal.proposer ? "Only proposer" : undefined}
          />
        </footer>
      )}
      {errorBanner(approveError as Error | null | undefined)}
      {errorBanner(executeError as Error | null | undefined)}
      {errorBanner(cancelError as Error | null | undefined)}
    </article>
  );
}

function ActionButton({
  label,
  disabled,
  onClick,
  variant,
  hint,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  variant: "primary" | "success" | "danger";
  hint?: string;
}) {
  const styles: Record<typeof variant, string> = {
    primary:
      "bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-400",
    success:
      "bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-400",
    danger:
      "bg-rose-600/80 text-white hover:bg-rose-600 disabled:bg-slate-700 disabled:text-slate-400",
  };

  return (
    <div className="flex flex-col">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${styles[variant]} disabled:cursor-not-allowed`}
      >
        {label}
      </button>
      {hint && disabled && <span className="mt-1 text-[10px] text-slate-500">{hint}</span>}
    </div>
  );
}
