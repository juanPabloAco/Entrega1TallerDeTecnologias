import { useJobs } from "@/hooks/useJobs";
import { JobCard } from "./JobCard";
import { MARKETPLACE_ADDRESS } from "@/contracts";

export function JobBoard() {
  const { count, isLoading, isFetching, isError, error, refetch, refetchTick } = useJobs();

  if (MARKETPLACE_ADDRESS === "0x0000000000000000000000000000000000000000") {
    return (
      <div className="rounded-lg border border-amber-700/40 bg-amber-500/10 p-4 text-sm text-amber-200">
        Falta configurar <code>VITE_MARKETPLACE_ADDRESS</code> en <code>frontend/.env</code>.
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-rose-700/40 bg-rose-500/10 p-4 text-sm text-rose-200">
        <p className="font-semibold">No pude leer el marketplace.</p>
        <p className="mt-1 text-xs text-rose-300/80 break-all">
          {error instanceof Error ? error.message : String(error)}
        </p>
        <button
          onClick={() => refetch()}
          className="mt-2 rounded bg-rose-600/30 px-2 py-1 text-xs hover:bg-rose-600/50"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100">
          Tablero de Trabajos
          {isFetching && !isLoading && (
            <span className="ml-2 inline-block animate-pulse text-xs text-slate-500">
              sincronizando…
            </span>
          )}
        </h2>
        <div className="flex items-center gap-3">
          <p className="text-xs text-slate-500">{count} en total</p>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-50"
          >
            {isFetching ? "..." : "Refrescar"}
          </button>
        </div>
      </header>

      {count === 0 && !isLoading ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 text-center text-sm text-slate-400">
          Aún no hay trabajos. Publicá uno desde el formulario superior.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: count }, (_, i) => (
            <JobCard key={i} jobId={i} refetchTrigger={refetchTick} />
          ))}
        </div>
      )}
    </section>
  );
}