"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type Job } from "./types";
import JobCard from "./JobCard";
import { UploadCloudIcon } from "./icons";

const POLL_INTERVAL_MS = 4000;

export default function Uploader() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timers = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  const patchJob = useCallback((id: string, patch: Partial<Job>) => {
    setJobs((prev) => prev.map((job) => (job.id === id ? { ...job, ...patch } : job)));
  }, []);

  // Poll the result endpoint until every resolution is ready, then stop.
  const startPolling = useCallback(
    (id: string, key: string) => {
      const tick = async () => {
        try {
          const res = await fetch(`/api/result?key=${encodeURIComponent(key)}`, { cache: "no-store" });
          if (!res.ok) return;
          const data: { done: boolean; outputs: Job["outputs"] } = await res.json();
          patchJob(id, { outputs: data.outputs, status: data.done ? "done" : "processing" });
          if (data.done) {
            const timer = timers.current.get(id);
            if (timer) clearInterval(timer);
            timers.current.delete(id);
          }
        } catch {
          // Transient network error — keep polling.
        }
      };
      void tick();
      const timer = setInterval(tick, POLL_INTERVAL_MS);
      timers.current.set(id, timer);
    },
    [patchJob],
  );

  const uploadToS3 = useCallback(
    (id: string, file: File, uploadUrl: string) =>
      new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            patchJob(id, { progress: Math.round((event.loaded / event.total) * 100) });
          }
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`Upload failed (HTTP ${xhr.status}).`));
        xhr.onerror = () => reject(new Error("Network error during upload."));
        xhr.send(file);
      }),
    [patchJob],
  );

  const handleFiles = useCallback(
    async (fileList: FileList) => {
      const files = Array.from(fileList).filter((f) => f.type.startsWith("video/"));

      for (const file of files) {
        const id = crypto.randomUUID();
        setJobs((prev) => [
          { id, filename: file.name, size: file.size, status: "uploading", progress: 0, outputs: [] },
          ...prev,
        ]);

        try {
          const res = await fetch("/api/upload-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Could not start the upload.");

          patchJob(id, { key: data.key });
          await uploadToS3(id, file, data.uploadUrl);
          patchJob(id, { status: "processing", progress: 100 });
          startPolling(id, data.key);
        } catch (err) {
          patchJob(id, {
            status: "error",
            error: err instanceof Error ? err.message : "Upload failed.",
          });
        }
      }
    },
    [patchJob, startPolling, uploadToS3],
  );

  // Clear any live polling timers when the component unmounts.
  useEffect(() => {
    const map = timers.current;
    return () => map.forEach(clearInterval);
  }, []);

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length) void handleFiles(event.dataTransfer.files);
  };

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        className={[
          "group flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-14 text-center transition-colors",
          dragging
            ? "border-indigo-400 bg-indigo-500/10"
            : "border-white/15 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]",
        ].join(" ")}
      >
        <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-sky-500/20 text-indigo-300 transition-transform group-hover:scale-105">
          <UploadCloudIcon className="size-7" />
        </span>
        <p className="mt-4 text-base font-medium text-white">
          Drop a video here, or <span className="text-indigo-300">browse</span>
        </p>
        <p className="mt-1 text-sm text-white/40">MP4, MOV, WebM and more — up to 2 GB</p>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {jobs.length > 0 && (
        <ul className="mt-6 space-y-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </ul>
      )}
    </div>
  );
}
