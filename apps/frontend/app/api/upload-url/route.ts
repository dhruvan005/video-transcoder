import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { presignUpload } from "@/app/lib/s3";

// Presigning hits AWS at request time, so this handler must never be cached.
export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

/** Turn an arbitrary filename into a safe, lowercase S3-friendly slug. */
function slugify(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "mp4";
  const cleanBase =
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "video";
  const cleanExt = ext.replace(/[^a-z0-9]/g, "") || "mp4";
  return `${cleanBase}.${cleanExt}`;
}

export async function POST(request: Request) {
  let body: { filename?: unknown; contentType?: unknown; size?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const { filename, contentType, size } = body;

  if (typeof filename !== "string" || !filename.trim()) {
    return NextResponse.json({ error: "A filename is required." }, { status: 400 });
  }
  if (typeof contentType !== "string" || !contentType.startsWith("video/")) {
    return NextResponse.json({ error: "Only video files are accepted." }, { status: 400 });
  }
  if (typeof size === "number" && size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds the 2 GB limit." }, { status: 413 });
  }

  // `videos/<uuid>-<slug>` keeps uploads collision-free and groups them under one prefix.
  const key = `videos/${randomUUID()}-${slugify(filename)}`;

  try {
    const uploadUrl = await presignUpload(key, contentType);
    return NextResponse.json({ key, uploadUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create an upload URL.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
