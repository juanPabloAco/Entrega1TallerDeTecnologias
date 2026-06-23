import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useJobAction } from "@/hooks/useJobActions";
import { MULTISIG_ADDRESS, TOKEN_DECIMALS } from "@/contracts";

const PRESETS = [
  { label: "1 day", seconds: 86_400 },
  { label: "7 days", seconds: 86_400 * 7 },
  { label: "30 days", seconds: 86_400 * 30 },
];

function humanizeError(e: Error | null | undefined): string {
  if (!e) return "";
  const m = e.message || "";
  const revertMatch = m.match(/reverted with(?: custom error)? ['"]?([^'"]+)['"]?/);
  if (revertMatch) return `Contrato revirtió: ${revertMatch[1]}`;
  if (/DeadlineInPast/i.test(m)) {
    return "El deadline ya pasó al momento del minado. Elegí una duración mayor (7+ días).";
  }
  if (/ZeroBudget/i.test(m)) return "El budget debe ser > 0.";
  if (/ZeroAddress/i.test(m)) return "El evaluador no puede ser address 0.";
  if (/insufficient funds/i.test(m)) {
    return "Sin fondos para pagar gas. Fondeá tu wallet con Sepolia ETH.";
  }
  if (/User rejected|denied/i.test(m)) return "Transacción rechazada en la wallet.";
  if (/Unexpected error/i.test(m)) {
    return "Error inesperado al simular. Verificá que estés en Sepolia y la wallet tenga ETH.";
  }
  return m.slice(0, 240);
}

export function CreateJobForm() {
  const { isConnected } = useAccount();
  const [description, setDescription] = useState("");
  const [budgetStr, setBudgetStr] = useState("100");
  const [evaluator, setEvaluator] = useState<string>(MULTISIG_ADDRESS);
  const [provider, setProvider] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(86_400 * 7);

  // Snapshot at click time: this guarantees the simulated args and the
  // submitted args are identical (avoiding stale-args reverts).
  const [snapshot, setSnapshot] = useState<readonly unknown[] | undefined>(undefined);

  const parsedBudget = (() => {
    const n = Number(budgetStr);
    if (!Number.isFinite(n) || n <= 0) return undefined;
    try {
      return BigInt(Math.round(n * 10 ** TOKEN_DECIMALS));
    } catch {
      return undefined;
    }
  })();

  const validAddress = (a: string) => a.startsWith("0x") && a.length === 42;
  const formValid =
    description.trim().length > 0 &&
    parsedBudget !== undefined &&
    validAddress(evaluator) &&
    (provider === "" || validAddress(provider));

  // Hook always simulates against `snapshot` if available; otherwise undefined.
  const hook = useJobAction("createJob", snapshot as readonly unknown[] | undefined);

  const handleClick = () => {
    if (!formValid || parsedBudget === undefined) return;
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = BigInt(now + durationSeconds);
    const providerArg =
      provider !== "" && validAddress(provider)
        ? (provider as `0x${string}`)
        : ("0x0000000000000000000000000000000000000000" as `0x${string}`);
    setSnapshot([
      description.trim(),
      parsedBudget,
      evaluator as `0x${string}`,
      providerArg,
      expiresAt,
    ] as const);
  };

  // When simulation succeeds, open the wallet modal exactly once.
  useEffect(() => {
    if (
      snapshot !== undefined &&
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

  const error = hook.simulationError || hook.writeError || hook.receiptError;
  const simulating = snapshot !== undefined && !hook.canSubmit && !hook.simulationError;

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold text-slate-100">Publicar Trabajo</h2>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Descripción</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Build a landing page with responsive design"
            className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Budget (mUSDC)</label>
            <input
              type="number"
              value={budgetStr}
              onChange={(e) => setBudgetStr(e.target.value)}
              min="0"
              step="0.01"
              className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Duración</label>
            <select
              value={durationSeconds}
              onChange={(e) => setDurationSeconds(Number(e.target.value))}
              className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
            >
              {PRESETS.map((p) => (
                <option key={p.seconds} value={p.seconds}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
            <span>Evaluador (obligatorio)</span>
            {MULTISIG_ADDRESS !== "0x0000000000000000000000000000000000000000" &&
              evaluator.toLowerCase() === MULTISIG_ADDRESS.toLowerCase() && (
                <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-indigo-300 ring-1 ring-indigo-500/40">
                  Multisig desplegada
                </span>
              )}
          </label>
          <input
            value={evaluator}
            onChange={(e) => setEvaluator(e.target.value)}
            placeholder="0x… (podés pegar la dirección de la Multisig)"
            className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-2 text-xs font-mono text-slate-100"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            La Multisig desplegada actúa como evaluador M-de-N. Pegá otra address si querés un evaluador EOA.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
            Proveedor (opcional)
          </label>
          <input
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            placeholder="0xProvider… (puede asignarse después)"
            className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-2 text-xs font-mono text-slate-100"
          />
          <p className="mt-1 text-[11px] text-amber-300/80">
            ⚠ Si lo dejás vacío, el job queda en estado <strong>Open</strong> y nadie puede entregar
            hasta que vos (cliente) asignes proveedor con <code>setProvider</code>.
          </p>
        </div>

        <button
          onClick={handleClick}
          disabled={
            !isConnected ||
            !formValid ||
            hook.isWriting ||
            hook.isConfirming ||
            simulating
          }
          className="w-full rounded-md bg-indigo-500 hover:bg-indigo-400 disabled:bg-indigo-500/30 px-3 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed"
        >
          {hook.isWriting
            ? "Confirm in wallet…"
            : hook.isConfirming
              ? "Tx pending…"
              : simulating
                ? "Simulando…"
                : "Publicar Trabajo (createJob)"}
        </button>

        {hook.isConfirmed && (
          <p className="text-xs text-emerald-300">✓ Trabajo creado. Aparecerá en el tablero en unos segundos.</p>
        )}
        {error && (
          <p className="rounded bg-rose-500/10 px-3 py-2 text-xs text-rose-300 break-all">
            {humanizeError(error as Error)}
          </p>
        )}
        {!isConnected && (
          <p className="text-xs text-amber-300">Conectá una wallet para publicar.</p>
        )}
      </div>
    </section>
  );
}