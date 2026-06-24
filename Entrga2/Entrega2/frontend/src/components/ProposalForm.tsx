import { useState } from "react";
import { useAccount } from "wagmi";
import { parseEther, encodeFunctionData, decodeFunctionData, getAbiItem, toFunctionSelector } from "viem";
import { useIsSigner } from "@/hooks/useMultisigInfo";
import { useMultisigAction } from "@/hooks/useMultisigActions";
import { jobMarketplaceAbi, MARKETPLACE_ADDRESS } from "@/contracts";
import {
  isValidAddress,
  isValidHexData,
  normalizeHexData,
} from "@/utils/validation";

function humanizeError(e: Error | null | undefined): string {
  if (!e) return "";
  const m = e.message || "";
  const revertMatch = m.match(/reverted with(?: custom error)? ['"]?([^'"]+)['"]?/);
  if (revertMatch) return `Contrato revirtió: ${revertMatch[1]}`;
  const causeMatch = m.match(/cause[^]*?reason['"]?[:\s]+([^"'\n]+)/);
  if (causeMatch) return `Causa: ${causeMatch[1]}`;
  if (/insufficient funds/i.test(m)) {
    return "La Multisig no tiene ETH suficiente para transferir este valor. Fondeala primero.";
  }
  if (/Unexpected error/i.test(m)) {
    return "Error inesperado al simular la tx. Revisá que el target sea un contrato válido y que la Multisig tenga fondos si el value > 0.";
  }
  return m.slice(0, 200);
}

type CalldataInfo =
  | { kind: "empty" }
  | { kind: "unknown"; selector: string }
  | {
      kind: "complete" | "reject";
      selector: string;
      jobId: bigint;
      reason: `0x${string}`;
      reasonText: string;
    };

function decodeMarketplaceCalldata(calldata: string): CalldataInfo {
  if (!calldata || calldata === "0x" || calldata === "0X") return { kind: "empty" };
  const normalized = normalizeHexData(calldata);
  if (normalized.length < 10) return { kind: "empty" };
  const selector = normalized.slice(0, 10);
  const completeSelector = toFunctionSelector(
    getAbiItem({ abi: jobMarketplaceAbi, name: "complete" }),
  );
  const rejectSelector = toFunctionSelector(
    getAbiItem({ abi: jobMarketplaceAbi, name: "reject" }),
  );
  try {
    if (selector === completeSelector) {
      const decoded = decodeFunctionData({
        abi: jobMarketplaceAbi,
        data: normalized as `0x${string}`,
      });
      const args = decoded.args as readonly [bigint, `0x${string}`];
      const r = args[1];
      let reasonText = "";
      try {
        reasonText = Buffer.from(r.slice(2), "hex")
          .toString("utf8")
          .replace(/[\u0000-\u001f\u007f]+$/g, "")
          .trim();
      } catch {
        reasonText = r;
      }
      return {
        kind: "complete",
        selector,
        jobId: args[0],
        reason: r,
        reasonText: reasonText || r,
      };
    }
    if (selector === rejectSelector) {
      const decoded = decodeFunctionData({
        abi: jobMarketplaceAbi,
        data: normalized as `0x${string}`,
      });
      const args = decoded.args as readonly [bigint, `0x${string}`];
      const r = args[1];
      let reasonText = "";
      try {
        reasonText = Buffer.from(r.slice(2), "hex")
          .toString("utf8")
          .replace(/[\u0000-\u001f\u007f]+$/g, "")
          .trim();
      } catch {
        reasonText = r;
      }
      return {
        kind: "reject",
        selector,
        jobId: args[0],
        reason: r,
        reasonText: reasonText || r,
      };
    }
  } catch {
  }
  return { kind: "unknown", selector };
}

export function ProposalForm() {
  const { address, isConnected } = useAccount();
  const { data: isSigner, isLoading: isSignerLoading } = useIsSigner(address);

  const [target, setTarget] = useState<string>(MARKETPLACE_ADDRESS);
  const [ethValue, setEthValue] = useState("0");
  const [data, setData] = useState("0x");
  const [jobId, setJobId] = useState("0");
  const [reason, setReason] = useState("approved-by-multisig");

  const targetValid = isValidAddress(target);
  const dataValid = isValidHexData(data);
  const canPropose = isConnected && isSigner && targetValid && dataValid;

  const decoded = decodeMarketplaceCalldata(data);
  const isTargetingMarketplace =
    targetValid &&
    MARKETPLACE_ADDRESS !== "0x0000000000000000000000000000000000000000" &&
    target.toLowerCase() === MARKETPLACE_ADDRESS.toLowerCase();

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

  const fillCompleteCalldata = () => {
    try {
      const id = BigInt(jobId || "0");
      const r = reason.padEnd(32, " ").slice(0, 32);
      const rBytes = ("0x" +
        Array.from(new TextEncoder().encode(r))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")
          .padEnd(64, "0")
          .slice(0, 64)) as `0x${string}`;
      const encoded = encodeFunctionData({
        abi: jobMarketplaceAbi,
        functionName: "complete",
        args: [id, rBytes],
      });
      setData(encoded);
    } catch (err) {
      console.warn("encode failed:", err);
    }
  };

  const fillRejectCalldata = () => {
    try {
      const id = BigInt(jobId || "0");
      const r = (reason || "rejected").padEnd(32, " ").slice(0, 32);
      const rBytes = ("0x" +
        Array.from(new TextEncoder().encode(r))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")
          .padEnd(64, "0")
          .slice(0, 64)) as `0x${string}`;
      const encoded = encodeFunctionData({
        abi: jobMarketplaceAbi,
        functionName: "reject",
        args: [id, rBytes],
      });
      setData(encoded);
    } catch (err) {
      console.warn("encode failed:", err);
    }
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
          <p className="mt-1 text-[10px] text-slate-500">
            Por defecto <code>0</code> — usar sólo si la Multisig debe transferir ETH.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
          <div>
            <label className="mb-1 block text-xs text-slate-400">jobId</label>
            <input
              type="number"
              min="0"
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 font-mono text-sm text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">reason (texto)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 font-mono text-sm text-slate-100"
            />
          </div>
          <div className="col-span-2 flex gap-2">
            <button
              type="button"
              onClick={fillCompleteCalldata}
              className="flex-1 rounded-md bg-emerald-600/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600"
            >
              Encode complete(jobId, reason)
            </button>
            <button
              type="button"
              onClick={fillRejectCalldata}
              className="flex-1 rounded-md bg-rose-600/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-600"
            >
              Encode reject(jobId, reason)
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-slate-400">Calldata (hex)</label>
          <textarea
            value={data}
            onChange={(e) => setData(e.target.value)}
            placeholder="0x"
            rows={3}
            className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 font-mono text-xs text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
          />
          {data && !dataValid && (
            <p className="mt-1 text-xs text-rose-400">Invalid hex string.</p>
          )}
          {isTargetingMarketplace && dataValid && (
            <div className="mt-2 rounded border border-slate-800 bg-slate-950/40 p-2 text-xs text-slate-300">
              {decoded.kind === "empty" && (
                <p className="text-slate-500">Calldata vacío — no se llamará a ninguna función del marketplace.</p>
              )}
              {decoded.kind === "unknown" && (
                <p className="text-amber-300">
                  Selector <code className="font-mono">{decoded.selector}</code> no es de <code>complete</code> ni <code>reject</code>. Verificá que el target y los datos correspondan a la acción que querés ejecutar.
                </p>
              )}
              {(decoded.kind === "complete" || decoded.kind === "reject") && (
                <div className="space-y-1">
                  <p>
                    <span className="text-slate-500">Función: </span>
                    <code className="font-mono text-emerald-300">{decoded.kind}</code>
                    <span className="text-slate-500"> · selector </span>
                    <code className="font-mono">{decoded.selector}</code>
                  </p>
                  <p>
                    <span className="text-slate-500">jobId: </span>
                    <code className="font-mono text-slate-100">{decoded.jobId.toString()}</code>
                    {decoded.jobId === 0n && (
                      <span className="ml-2 text-amber-300">⚠ es el primer job; verificá que sea el correcto</span>
                    )}
                  </p>
                  <p>
                    <span className="text-slate-500">reason: </span>
                    <code className="font-mono text-slate-100">{decoded.reasonText || decoded.reason}</code>
                  </p>
                </div>
              )}
            </div>
          )}
          {targetValid && !isTargetingMarketplace && dataValid && data !== "0x" && (
            <p className="mt-2 text-[11px] text-amber-300/80">
              ⚠ El target no es el JobMarketplace ({MARKETPLACE_ADDRESS.slice(0, 8)}…). El calldata no se decodifica automáticamente.
            </p>
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
          <p className="rounded bg-rose-500/10 px-3 py-2 text-xs text-rose-300 break-all">
            {humanizeError(error as Error)}
          </p>
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
