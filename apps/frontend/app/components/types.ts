export type JobStatus = "uploading" | "processing" | "done" | "error";

export type OutputState = {
  resolution: string;
  url: string | null;
};

export type Job = {
  id: string;
  filename: string;
  size: number;
  status: JobStatus;
  /** Upload progress, 0–100. */
  progress: number;
  /** Raw-bucket object key, set once the upload URL is issued. */
  key?: string;
  outputs: OutputState[];
  error?: string;
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
