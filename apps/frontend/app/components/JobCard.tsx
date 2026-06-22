import { type Job, formatBytes } from "./types";
import { AlertIcon, CheckIcon, DownloadIcon, FilmIcon, SpinnerIcon, UploadCloudIcon } from "./icons";

const STEPS = ["Upload", "Transcode", "Ready"] as const;

function currentStep(status: Job["status"]): number {
  switch (status) {
    case "uploading":
      return 0;
    case "processing":
      return 1;
    case "done":
      return 2;
    default:
      return 0;
  }
}

function StatusBadge({ job }: { job: Job }) {
  const map: Record<Job["status"], { label: string; className: string; icon: React.ReactNode }> = {
    uploading: { label: "Uploading", className: "bg-sky-500/15 text-sky-300", icon: <UploadCloudIcon className="size-3.5" /> },
    processing: { label: "Transcoding", className: "bg-amber-500/15 text-amber-300", icon: <SpinnerIcon className="size-3.5" /> },
    done: { label: "Ready", className: "bg-emerald-500/15 text-emerald-300", icon: <CheckIcon className="size-3.5" /> },
    error: { label: "Failed", className: "bg-rose-500/15 text-rose-300", icon: <AlertIcon className="size-3.5" /> },
  };
  const { label, className, icon } = map[job.status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      {icon}
      {label}
    </span>
  );
}

function Stepper({ status }: { status: Job["status"] }) {
  const active = currentStep(status);
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((step, i) => {
        const done = i < active || status === "done";
        const isActive = i === active && status !== "done";
        return (
          <div key={step} className="flex flex-1 items-center gap-2">
            <div className="flex items-center gap-2">
              <span
                className={[
                  "flex size-6 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors",
                  done
                    ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-300"
                    : isActive
                      ? "border-amber-400/40 bg-amber-500/20 text-amber-300"
                      : "border-white/10 bg-white/5 text-white/40",
                ].join(" ")}
              >
                {done ? <CheckIcon className="size-3.5" /> : i + 1}
              </span>
              <span className={`text-xs ${done || isActive ? "text-white/80" : "text-white/40"}`}>{step}</span>
            </div>
            {i < STEPS.length - 1 && (
              <span className={`h-px flex-1 ${i < active ? "bg-emerald-400/40" : "bg-white/10"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function JobCard({ job }: { job: Job }) {
  return (
    <li className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/70">
            <FilmIcon />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{job.filename}</p>
            <p className="text-xs text-white/40">{formatBytes(job.size)}</p>
          </div>
        </div>
        <StatusBadge job={job} />
      </div>

      {job.status === "uploading" && (
        <div className="mt-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-400 transition-[width] duration-200"
              style={{ width: `${job.progress}%` }}
            />
          </div>
          <p className="mt-1.5 text-right text-xs text-white/40">{job.progress}%</p>
        </div>
      )}

      {job.status === "error" && (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-rose-500/10 p-3 text-xs text-rose-300">
          <AlertIcon className="mt-px size-4 shrink-0" />
          {job.error ?? "Something went wrong."}
        </p>
      )}

      {(job.status === "processing" || job.status === "done") && (
        <>
          <div className="mt-5">
            <Stepper status={job.status} />
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2.5">
            {job.outputs.map((output) => {
              const ready = output.url !== null;
              return (
                <div
                  key={output.resolution}
                  className={[
                    "rounded-xl border p-3 text-center transition-colors",
                    ready ? "border-emerald-400/30 bg-emerald-500/[0.07]" : "border-white/10 bg-white/[0.02]",
                  ].join(" ")}
                >
                  <p className={`text-sm font-semibold ${ready ? "text-white" : "text-white/50"}`}>
                    {output.resolution}
                  </p>
                  {ready ? (
                    <a
                      href={output.url ?? undefined}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-300 hover:text-emerald-200"
                    >
                      <DownloadIcon className="size-3.5" />
                      Download
                    </a>
                  ) : (
                    <span className="mt-2 inline-flex items-center gap-1 text-xs text-white/40">
                      <SpinnerIcon className="size-3.5" />
                      Encoding
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </li>
  );
}
