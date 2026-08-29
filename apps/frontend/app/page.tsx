"use client";

import { useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

type Phase = "idle" | "uploading" | "processing" | "completed" | "failed";

type PresignedPost = {
  url: string;
  fields: Record<string, string>;
  key: string;
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function getPresignedPost(filename: string): Promise<PresignedPost> {
    const res = await fetch(
      `${API_URL}/signedurl?filename=${encodeURIComponent(filename)}`
    );
    if (!res.ok) throw new Error("Could not get an upload URL");
    return res.json();
  }

  // fetch() can't report upload progress, so upload via XHR.
  function uploadToS3(post: PresignedPost, video: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const form = new FormData();
      Object.entries(post.fields).forEach(([k, v]) => form.append(k, v));
      // Must satisfy the presigned "starts-with $Content-Type video/" condition.
      form.append("Content-Type", video.type || "video/mp4");
      form.append("file", video);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", post.url, true);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error(`Upload failed (${xhr.status})`));
      xhr.onerror = () => reject(new Error("Upload network error"));
      xhr.send(form);
    });
  }

  function pollStatus(key: string) {
    const tick = async () => {
      try {
        // Key can contain '/' (videos/<uuid>.mp4); keep the slashes so the
        // greedy {key+} route matches. The segments are already URL-safe.
        const res = await fetch(`${API_URL}/status/${key}`);
        const data = await res.json();
        const status: string = data.status;

        if (status === "COMPLETED") {
          setPhase("completed");
          setMessage("Transcoding complete — all resolutions are ready.");
          return;
        }
        if (status === "FAILED") {
          setPhase("failed");
          setMessage("Transcoding failed. Please try again.");
          return;
        }
        // PROCESSING or NOT_FOUND (task not started yet) → keep waiting.
        setMessage(
          status === "PROCESSING"
            ? "Transcoding your video…"
            : "Waiting for the transcoder to pick up your video…"
        );
      } catch {
        setMessage("Checking status…");
      }
      pollTimer.current = setTimeout(tick, 2500);
    };
    tick();
  }

  async function handleUpload() {
    if (!file) return;
    if (!API_URL) {
      setPhase("failed");
      setMessage("NEXT_PUBLIC_API_URL is not configured.");
      return;
    }

    if (pollTimer.current) clearTimeout(pollTimer.current);
    setProgress(0);
    setPhase("uploading");
    setMessage("Requesting upload URL…");

    try {
      const post = await getPresignedPost(file.name);
      setMessage("Uploading…");
      await uploadToS3(post, file);

      setPhase("processing");
      setMessage("Upload complete. Starting transcode…");
      pollStatus(post.key);
    } catch (err) {
      setPhase("failed");
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  const busy = phase === "uploading" || phase === "processing";

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Video Transcoder</h1>
        <p className="text-sm text-gray-500">
          Upload a video and we&apos;ll transcode it to 1080p, 720p, 480p and 360p.
        </p>
      </div>

      <input
        type="file"
        accept="video/*"
        disabled={busy}
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setPhase("idle");
          setProgress(0);
          setMessage("");
        }}
        className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-white hover:file:bg-blue-700"
      />

      <button
        onClick={handleUpload}
        disabled={!file || busy}
        className="rounded-md bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50 hover:bg-blue-700"
      >
        {busy ? "Working…" : "Upload & Transcode"}
      </button>

      {phase === "uploading" && (
        <div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-right text-xs text-gray-500">{progress}%</p>
        </div>
      )}

      {message && (
        <p
          className={
            phase === "failed"
              ? "text-sm text-red-600"
              : phase === "completed"
                ? "text-sm text-green-600"
                : "text-sm text-gray-600"
          }
        >
          {message}
        </p>
      )}
    </main>
  );
}
