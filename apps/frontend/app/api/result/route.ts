import { NextResponse } from "next/server";
import { RESOLUTIONS, presignOutputIfReady } from "@/app/lib/s3";

// Polls live S3 state on every request — never cache.
export const dynamic = "force-dynamic";

/**
 * Given the raw upload key (?key=videos/...), reports which transcoded outputs
 * have landed in the processed bucket and returns presigned download URLs for the
 * ones that are ready. The client polls this until all resolutions appear.
 */
export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "A `key` query parameter is required." }, { status: 400 });
  }

  try {
    const outputs = await Promise.all(
      RESOLUTIONS.map(async (resolution) => ({
        resolution,
        url: await presignOutputIfReady(key, resolution),
      })),
    );

    return NextResponse.json({
      key,
      done: outputs.every((o) => o.url !== null),
      outputs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to check transcoding results.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
