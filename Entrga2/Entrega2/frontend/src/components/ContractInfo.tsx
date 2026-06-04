import { useMultisigInfo } from "@/hooks/useMultisigInfo";
import { MULTISIG_ADDRESS, SEPOLIA_EXPLORER } from "@/contracts";
import { truncateAddress } from "@/utils/format";

export function ContractInfo() {
  const { signers, threshold, isLoading, isError } = useMultisigInfo();

  const configured = MULTISIG_ADDRESS !== "0x0000000000000000000000000000000000000000";

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
        Contract info
      </h2>

      {!configured ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          No contract address configured. Set <code className="font-mono">VITE_MULTISIG_ADDRESS</code>{" "}
          in <code className="font-mono">frontend/.env</code> after deploying.
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-xs text-slate-400">Address</p>
            <a
              href={`${SEPOLIA_EXPLORER}/address/${MULTISIG_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              className="break-all font-mono text-sm text-indigo-300 hover:underline"
            >
              {MULTISIG_ADDRESS}
            </a>
          </div>

          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-slate-400">Threshold</p>
              <p className="text-2xl font-semibold text-white">
                {isLoading ? "…" : String(threshold)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Signers</p>
              <p className="text-2xl font-semibold text-white">
                {isLoading ? "…" : signers.length}
              </p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs text-slate-400">Signers list</p>
            {isError ? (
              <p className="text-sm text-rose-400">Failed to load signers.</p>
            ) : signers.length === 0 && !isLoading ? (
              <p className="text-sm text-slate-500">No signers found.</p>
            ) : (
              <ul className="space-y-1.5">
                {signers.map((s) => (
                  <li key={s} className="flex items-center justify-between rounded-md bg-slate-800/60 px-3 py-1.5 text-sm">
                    <a
                      href={`${SEPOLIA_EXPLORER}/address/${s}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-slate-200 hover:text-indigo-300"
                    >
                      {truncateAddress(s, 8, 6)}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
