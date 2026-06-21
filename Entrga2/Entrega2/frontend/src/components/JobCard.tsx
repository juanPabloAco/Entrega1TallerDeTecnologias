import { useMemo, useState } from "react";
import { JobTuple, STATUS_BADGE, STATUS_LABEL } from "@/hooks/useJobs";
import { shortenAddress, TOKEN_DECIMALS } from "@/contracts";
import { JobActions } from "./JobActions";

type Props = { jobId: number; job: JobTuple | undefined };

export function JobCard({ jobId, job }: Props) {
  const [open, setOpen] = useState(false);

  const statusLabel = useMemo(() => (job ? STATUS_LABEL[job.status] : "…"), [job]);
  const badge = useMemo(
    () => (job ? STATUS_BADGE[job.status] : STATUS_BADGE[0]),
    [job],
  );

  if (!job) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-500 animate-pulse">
        Loading job #{jobId}…
      </div>
    );
  }

  const budget = (Number(job.budget) / 10 ** TOKEN_DECIMALS).toFixed(2);

  return (
    <article className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 shadow-sm hover:border-slate-700 transition">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">#{jobId}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${badge}`}>
              {statusLabel}
            </span>
          </div>
          <h3 className="mt-1 truncate text-base font-semibold text-slate-100">
            {job.description || <em className="text-slate-500">(sin descripción)</em>}
          </h3>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Budget</p>
          <p className="text-lg font-semibold text-emerald-300">{budget}</p>
          <p className="text-[10px] text-slate-500">mUSDC</p>
        </div>
      </header>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-slate-500">Cliente</dt>
          <dd className="truncate text-slate-300">{shortenAddress(job.client)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Proveedor</dt>
          <dd className="truncate text-slate-300">
            {job.provider === "0x0000000000000000000000000000000000000000" ? "—" : shortenAddress(job.provider)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Evaluador</dt>
          <dd className="truncate text-slate-300">{shortenAddress(job.evaluator)}</dd>
        </div>
      </dl>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Expira: {new Date(Number(job.expiresAt) * 1000).toLocaleString()}
        </p>
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-xs text-indigo-300 hover:underline"
        >
          {open ? "Ocultar" : "Detalle"}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-3 border-t border-slate-800 pt-3">
          <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <Field label="Client" value={job.client} />
            <Field label="Provider" value={job.provider} />
            <Field label="Evaluator" value={job.evaluator} />
            <Field
              label="Deliverable ref"
              value={job.deliverableRef === "0x0000000000000000000000000000000000000000000000000000000000000000" ? "—" : job.deliverableRef}
            />
          </div>
          <JobActions job={job} jobId={jobId} onAfterChange={() => setOpen((v) => v)} />
        </div>
      )}
    </article>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="break-all text-slate-300">{value}</p>
    </div>
  );
}
