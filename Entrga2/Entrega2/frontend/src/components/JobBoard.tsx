import { useJobs } from "@/hooks/useJobs";
import { JobCard } from "./JobCard";
import { MARKETPLACE_ADDRESS } from "@/contracts";

export function JobBoard() {
  const { jobs, count, isLoading } = useJobs();

  if (MARKETPLACE_ADDRESS === "0x0000000000000000000000000000000000000000") {
    return (
      <div className="rounded-lg border border-amber-700/40 bg-amber-500/10 p-4 text-sm text-amber-200">
        Falta configurar <code>VITE_MARKETPLACE_ADDRESS</code> en <code>frontend/.env</code>.
      </div>
    );
  }

  if (count === 0 && !isLoading) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 text-center text-sm text-slate-400">
        Aún no hay trabajos. Publicá uno desde el formulario superior.
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <header className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-slate-100">Tablero de Trabajos</h2>
        <p className="text-xs text-slate-500">{count} en total</p>
      </header>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: count }, (_, i) => (
          <JobCard key={i} jobId={i} job={jobs[i]} />
        ))}
      </div>
    </section>
  );
}
