import { useState } from "react";
import { useAccount } from "wagmi";
import { parseEther } from "viem";
import { useIsSigner } from "@/hooks/useMultisigInfo";
import { useMultisigAction } from "@/hooks/useMultisigActions";
import {
  isValidAddress,
  isValidHexData,
  normalizeHexData,
} from "@/utils/validation";

export function ProposalForm() {
  const { isConnected } = useAccount();
  const { data: isSigner, isLoading: isSignerLoading } = useIsSigner(
    useAccount().address,
  );

  const [target, setTarget] = useState("");
  const [ethValue, setEthValue] = useState("");
  const [data, setData] = useState("0x");

  const targetValid = isValidAddress(target);
  const dataValid = isValidHexData(data);
  const canPropose = isConnected && isSigner && targetValid && dataValid;

  const { submit, isWriting, isConfirming, isConfirmed, writeError, simulationError, hash } =
    useMultisigAction(
      "propose",
      canPropose
        ? ([target as `0x${string}`, parseEther(ethValue || "0"), normalizeHexData(data)] as const)
        : undefined,
    );

  const error = writeError || simulationError;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPropose) return;
    submit?.();
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
        New proposal
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs text-slate-400">Target address</label>
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="0x…"
            className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 font-mono text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
          />
          {target && !targetValid && (
            <p className="mt-1 text-xs text-rose-400">Invalid address.</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs text-slate-400">Value (ETH)</label>
          <input
            type="text"
            value={ethValue}
            onChange={(e) => setEthValue(e.target.value)}
            placeholder="0.0"
            inputMode="decimal"
            className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 font-mono text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-slate-400">Calldata (hex, optional)</label>
          <textarea
            value={data}
            onChange={(e) => setData(e.target.value)}
            placeholder="0x"
            rows={2}
            className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 font-mono text-xs text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
          />
          {data && !dataValid && (
            <p className="mt-1 text-xs text-rose-400">Invalid hex string.</p>
          )}
        </div>

        <button
          type="submit"
          disabled={!canPropose || isWriting || isConfirming}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          {!isConnected
            ? "Connect wallet to propose"
            : isSignerLoading
              ? "Checking signer…"
              : !isSigner
                ? "Not a signer"
                : isWriting
                  ? "Confirm in wallet…"
                  : isConfirming
                    ? "Mining…"
                    : isConfirmed
                      ? "Proposed ✓"
                      : "Propose transaction"}
        </button>

        {error && (
          <p className="text-xs text-rose-400">{(error as Error).message}</p>
        )}
        {hash && (
          <p className="break-all text-xs text-slate-500">
            tx: <span className="font-mono">{hash}</span>
          </p>
        )}
      </form>
    </section>
  );
}
