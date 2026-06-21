import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import {
  useJobAction,
  useApproveToken,
  useTokenAllowance,
  useJobRole,
} from "@/hooks/useJobActions";
import { JobTuple, STATUS_LABEL } from "@/hooks/useJobs";
import { shortenAddress, TOKEN_DECIMALS } from "@/contracts";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

function humanizeError(e: Error | null | undefined): string {
  if (!e) return "";
  const m = e.message || "";
  const match = m.match(/reverted with(?: custom error)? ['"]?([^'"]+)['"]?/);
  if (match) return `Contrato revirtió: ${match[1]}`;
  if (/JobNotFound|InvalidState|NotClient|NotProvider|NotEvaluator|JobAlreadyExpired|JobNotExpired|ZeroBudget|ZeroAddress|ZeroReason|NoProvider|ProviderAlreadySet/i.test(m)) {
    return m.match(/reverted[^]*?["'](\w+)["']/)?.[1] ?? "Reverted";
  }
  if (/User rejected|denied/i.test(m)) return "Transacción rechazada en la wallet.";
  if (/insufficient funds/i.test(m)) return "Sin fondos para gas. Fondeá la wallet con Sepolia ETH.";
  if (/Unexpected error/i.test(m)) return "Error inesperado al simular. Verificá la red y los fondos.";
  return m.slice(0, 220);
}

function bytes32FromText(text: string): `0x${string}` {
  const trimmed = text.slice(0, 32);
  const hex =
    "0x" +
    Array.from(new TextEncoder().encode(trimmed))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .padEnd(64, "0");
  return hex as `0x${string}`;
}

function isBytes32Like(s: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(s);
}

function TxStatus({
  isWriting,
  isConfirming,
  isConfirmed,
  error,
  label,
}: {
  isWriting: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  error?: Error | null;
  label: string;
}) {
  if (isWriting) return <span className="text-amber-300">Confirm in wallet…</span>;
  if (isConfirming) return <span className="text-blue-300">Tx pending…</span>;
  if (isConfirmed) return <span className="text-emerald-300">✓ {label} confirmed</span>;
  if (error) return <span className="text-rose-300">{humanizeError(error)}</span>;
  return null;
}

function ActionButton({
  disabled,
  onClick,
  busy,
  tone = "primary",
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  busy?: boolean;
  tone?: "primary" | "danger" | "neutral";
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    primary: "bg-indigo-500 hover:bg-indigo-400 disabled:bg-indigo-500/30",
    danger: "bg-rose-500 hover:bg-rose-400 disabled:bg-rose-500/30",
    neutral: "bg-slate-600 hover:bg-slate-500 disabled:bg-slate-600/30",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className={`w-full rounded-md px-3 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

/**
 * Hook that wraps useJobAction with a "snapshot at click" pattern, so the
 * args simulated by wagmi are exactly the args sent to the chain.
 */
function useSnapshotAction(
  action: Parameters<typeof useJobAction>[0],
  buildArgs: () => readonly unknown[] | undefined,
  validate: (args: readonly unknown[]) => boolean = () => true,
) {
  const [snapshot, setSnapshot] = useState<readonly unknown[] | undefined>(undefined);
  const hook = useJobAction(action, snapshot);
  const click = () => {
    const a = buildArgs();
    if (!a || !validate(a)) return;
    setSnapshot(a);
  };
  useEffect(() => {
    if (
      snapshot &&
      hook.canSubmit &&
      !hook.isWriting &&
      !hook.isConfirming &&
      !hook.isConfirmed &&
      !hook.simulationError
    ) {
      hook.submit?.();
      setSnapshot(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hook.canSubmit, snapshot, hook.simulationError]);
  const simulating = snapshot !== undefined && !hook.canSubmit && !hook.simulationError;
  return { ...hook, click, simulating };
}

export function JobActions({ job, jobId, onAfterChange }: { job: JobTuple; jobId: number; onAfterChange: () => void }) {
  // Defensive: if any required field is missing, render a loading state instead
  // of crashing the page (which is what makes the "Detalle" panel go blank).
  const jobReady =
    !!job &&
    job.budget !== undefined &&
    !!job.client &&
    !!job.evaluator &&
    job.status !== undefined;

  const { address } = useAccount();
  const role = useJobRole(job, address);
  const status = STATUS_LABEL[job.status] ?? "Unknown";
  const providerIsZero = !job.provider || job.provider.toLowerCase() === ZERO_ADDR;

  if (!jobReady) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4 text-xs text-slate-400">
        Cargando datos del trabajo #{jobId}…
      </div>
    );
  }

  const [providerInput, setProviderInput] = useState("");
  const [deliverableInput, setDeliverableInput] = useState("");
  const [reasonInput, setReasonInput] = useState("");

  const budget = job.budget;

  // ----- setProvider -----
  const setProviderHook = useSnapshotAction(
    "setProvider",
    () => {
      if (role !== "client" || job.status !== 1 || !providerIsZero) return undefined;
      if (!providerInput.startsWith("0x") || providerInput.length !== 42) return undefined;
      return [BigInt(jobId), providerInput as `0x${string}`];
    },
  );

  // ----- Approve + Fund (client in Open with provider) -----
  const allowance = useTokenAllowance(address);
  const needsApprove = allowance < budget;

  const [pendingApprove, setPendingApprove] = useState<bigint | undefined>(undefined);
  const approveHook = useApproveToken(pendingApprove);
  useEffect(() => {
    if (
      pendingApprove !== undefined &&
      approveHook.canSubmit &&
      !approveHook.isWriting &&
      !approveHook.isConfirming &&
      !approveHook.isConfirmed &&
      !approveHook.simulationError
    ) {
      approveHook.submit?.();
      setPendingApprove(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveHook.canSubmit, pendingApprove, approveHook.simulationError]);

  const fundHook = useSnapshotAction(
    "fund",
    () => (role === "client" && job.status === 1 && !providerIsZero && !needsApprove ? [BigInt(jobId)] : undefined),
  );

  // ----- Submit (provider in Funded) -----
  const submitHook = useSnapshotAction(
    "submit",
    () => {
      if (role !== "provider" || job.status !== 2 || deliverableInput.trim() === "") return undefined;
      const ref = isBytes32Like(deliverableInput.trim())
        ? (deliverableInput.trim() as `0x${string}`)
        : bytes32FromText(deliverableInput.trim());
      return [BigInt(jobId), ref];
    },
  );

  // ----- Complete / Reject (evaluator on Submitted, client on Open) -----
  const reasonBytes = reasonInput.trim() === ""
    ? undefined
    : isBytes32Like(reasonInput.trim())
      ? (reasonInput.trim() as `0x${string}`)
      : bytes32FromText(reasonInput.trim());

  const completeHook = useSnapshotAction(
    "complete",
    () => {
      if (role !== "evaluator" || job.status !== 3 || !reasonBytes) return undefined;
      return [BigInt(jobId), reasonBytes];
    },
  );

  const rejectHook = useSnapshotAction(
    "reject",
    () => {
      if (!reasonBytes) return undefined;
      if (role === "client" && job.status === 1) return [BigInt(jobId), reasonBytes];
      if (role === "evaluator" && (job.status === 2 || job.status === 3)) return [BigInt(jobId), reasonBytes];
      return undefined;
    },
  );

  // ----- claimRefund: anyone, only after expiry. Note: in-memory doesn't auto-warp time,
  // so this is only callable from chain after the deadline has actually passed. -----
  const claimRefundHook = useSnapshotAction(
    "claimRefund",
    () => (job.status === 2 || job.status === 3 ? [BigInt(jobId)] : undefined),
  );

  const renderHeader = () => (
    <div className="flex items-center justify-between text-xs text-slate-400">
      <span>Your role: <strong className="text-slate-200">{role}</strong></span>
      <span className="text-slate-500">Job #{jobId}</span>
    </div>
  );

  const renderErrorBanner = (e: Error | null | undefined) =>
    e ? <p className="text-xs text-rose-300 bg-rose-500/10 rounded px-2 py-1 break-all">{humanizeError(e)}</p> : null;

  // ----- Open, no provider -----
  if (role === "client" && job.status === 1 && providerIsZero) {
    return (
      <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-900/60 p-4">
        {renderHeader()}
        <p className="text-sm text-slate-300">Asignar Proveedor (Open, sin proveedor)</p>
        <input
          value={providerInput}
          onChange={(e) => setProviderInput(e.target.value)}
          placeholder="0xProvider..."
          className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
        />
        <ActionButton
          busy={setProviderHook.isWriting || setProviderHook.isConfirming || setProviderHook.simulating}
          disabled={
            !setProviderHook.canSubmit ||
            setProviderHook.isWriting ||
            setProviderHook.isConfirming ||
            !providerInput.startsWith("0x") ||
            providerInput.length !== 42
          }
          onClick={() => {
            setProviderHook.click();
            setTimeout(onAfterChange, 1500);
          }}
        >
          Asignar Proveedor
        </ActionButton>
        <TxStatus
          isWriting={setProviderHook.isWriting}
          isConfirming={setProviderHook.isConfirming}
          isConfirmed={setProviderHook.isConfirmed}
          error={setProviderHook.writeError || setProviderHook.simulationError || setProviderHook.receiptError}
          label="Provider set"
        />
      </div>
    );
  }

  // ----- Open, has provider (client can fund or reject) -----
  if (role === "client" && job.status === 1) {
    return (
      <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-900/60 p-4">
        {renderHeader()}
        <p className="text-sm text-slate-300">
          Proveedor: <span className="text-slate-100">{shortenAddress(job.provider)}</span>
        </p>
        <p className="text-xs text-slate-400">
          Budget:{" "}
          <strong className="text-slate-100">
            {(Number(job.budget) / 10 ** TOKEN_DECIMALS).toFixed(2)} mUSDC
          </strong>
          {needsApprove ? " · necesitás approve" : " · allowance OK"}
        </p>

        {needsApprove ? (
          <ActionButton
            busy={approveHook.isWriting || approveHook.isConfirming || pendingApprove !== undefined}
            disabled={!approveHook.canSubmit || approveHook.isWriting || approveHook.isConfirming}
            onClick={() => setPendingApprove(budget)}
          >
            {pendingApprove !== undefined ? "Esperando confirmación…" : "Aprobar mUSDC"}
          </ActionButton>
        ) : (
          <ActionButton
            busy={fundHook.isWriting || fundHook.isConfirming || fundHook.simulating}
            disabled={!fundHook.canSubmit || fundHook.isWriting || fundHook.isConfirming}
            onClick={() => {
              fundHook.click();
              setTimeout(onAfterChange, 1500);
            }}
          >
            Fondear Trabajo
          </ActionButton>
        )}

        <div className="border-t border-slate-800 pt-3 space-y-2">
          <input
            value={reasonInput}
            onChange={(e) => setReasonInput(e.target.value)}
            placeholder="Motivo (reason)"
            className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100"
          />
          <ActionButton
            tone="danger"
            busy={rejectHook.isWriting || rejectHook.isConfirming || rejectHook.simulating}
            disabled={!rejectHook.canSubmit || rejectHook.isWriting || rejectHook.isConfirming || reasonInput.trim() === ""}
            onClick={() => {
              rejectHook.click();
              setTimeout(onAfterChange, 1500);
            }}
          >
            Rechazar (Open)
          </ActionButton>
        </div>

        {renderErrorBanner(approveHook.simulationError || approveHook.writeError)}
        {renderErrorBanner(fundHook.simulationError || fundHook.writeError)}
        {renderErrorBanner(rejectHook.simulationError || rejectHook.writeError)}
      </div>
    );
  }

  // ----- Provider sees Funded → Submit -----
  if (role === "provider" && job.status === 2) {
    return (
      <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-900/60 p-4">
        {renderHeader()}
        <p className="text-sm text-slate-300">Enviar Entrega (Funded)</p>
        <input
          value={deliverableInput}
          onChange={(e) => setDeliverableInput(e.target.value)}
          placeholder="hash/IPFS/CID/texto"
          className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
        />
        <ActionButton
          busy={submitHook.isWriting || submitHook.isConfirming || submitHook.simulating}
          disabled={!submitHook.canSubmit || submitHook.isWriting || submitHook.isConfirming || deliverableInput.trim() === ""}
          onClick={() => {
            submitHook.click();
            setTimeout(onAfterChange, 1500);
          }}
        >
          Enviar Entrega
        </ActionButton>
        <TxStatus
          isWriting={submitHook.isWriting}
          isConfirming={submitHook.isConfirming}
          isConfirmed={submitHook.isConfirmed}
          error={submitHook.writeError || submitHook.simulationError || submitHook.receiptError}
          label="Submitted"
        />
      </div>
    );
  }

  // ----- Evaluator on Submitted: approve / reject -----
  if (role === "evaluator" && job.status === 3) {
    return (
      <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-900/60 p-4">
        {renderHeader()}
        <p className="text-sm text-slate-300">Revisar entrega (Submitted)</p>
        <input
          value={reasonInput}
          onChange={(e) => setReasonInput(e.target.value)}
          placeholder="reason bytes32 (p. ej. approved-by-multisig)"
          className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100"
        />
        <div className="grid grid-cols-2 gap-2">
          <ActionButton
            busy={completeHook.isWriting || completeHook.isConfirming || completeHook.simulating}
            disabled={!completeHook.canSubmit || completeHook.isWriting || completeHook.isConfirming || reasonInput.trim() === ""}
            onClick={() => {
              completeHook.click();
              setTimeout(onAfterChange, 1500);
            }}
          >
            Aprobar
          </ActionButton>
          <ActionButton
            tone="danger"
            busy={rejectHook.isWriting || rejectHook.isConfirming || rejectHook.simulating}
            disabled={!rejectHook.canSubmit || rejectHook.isWriting || rejectHook.isConfirming || reasonInput.trim() === ""}
            onClick={() => {
              rejectHook.click();
              setTimeout(onAfterChange, 1500);
            }}
          >
            Rechazar
          </ActionButton>
        </div>
        {renderErrorBanner(completeHook.simulationError || completeHook.writeError)}
        {renderErrorBanner(rejectHook.simulationError || rejectHook.writeError)}
      </div>
    );
  }

  // ----- Anyone with funded/submitted (before expiry) → Claim refund -----
  if (job.status === 2 || job.status === 3) {
    return (
      <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-900/60 p-4">
        {renderHeader()}
        <p className="text-sm text-slate-300">
          Estado: <strong className="text-slate-100">{status}</strong>
        </p>
        <ActionButton
          tone="neutral"
          busy={claimRefundHook.isWriting || claimRefundHook.isConfirming || claimRefundHook.simulating}
          disabled={!claimRefundHook.canSubmit || claimRefundHook.isWriting || claimRefundHook.isConfirming}
          onClick={() => {
            claimRefundHook.click();
            setTimeout(onAfterChange, 1500);
          }}
        >
          Reclamar Reembolso
        </ActionButton>
        <TxStatus
          isWriting={claimRefundHook.isWriting}
          isConfirming={claimRefundHook.isConfirming}
          isConfirmed={claimRefundHook.isConfirmed}
          error={claimRefundHook.writeError || claimRefundHook.simulationError || claimRefundHook.receiptError}
          label="Refund claimed"
        />
      </div>
    );
  }

  // ----- Terminal states -----
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
      {renderHeader()}
      <p>
        Estado terminal: <strong className="text-slate-200">{status}</strong>. No hay acciones disponibles.
      </p>
    </div>
  );
}