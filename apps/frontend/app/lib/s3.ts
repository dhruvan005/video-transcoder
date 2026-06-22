import "server-only";

import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Server-side S3 helpers. Credentials and bucket names live in env vars and are
 * never shipped to the client — every call here runs inside a Route Handler.
 *
 * The transcoding pipeline keys are derived the same way the worker derives them
 * (see docker/index.js): a raw upload at `videos/<id>-<name>.mp4` produces outputs
 * at `videos/<id>-<name>/<resolution>.mp4` in the processed bucket.
 */

export const RESOLUTIONS = ["720p", "480p", "360p"] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

// 6 hours — long enough for an upload + a few minutes of Fargate transcoding.
const URL_TTL_SECONDS = 60 * 60 * 6;

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export function rawBucket(): string {
  return required("RAW_BUCKET");
}

export function processedBucket(): string {
  return required("PROCESSED_BUCKET");
}

let client: S3Client | null = null;

export function s3(): S3Client {
  if (!client) {
    client = new S3Client({ region: required("AWS_REGION") });
  }
  return client;
}

/** Strip the extension to get the per-video prefix, mirroring the worker. */
export function keyBase(rawKey: string): string {
  return rawKey.replace(/\.[^/.]+$/, "");
}

/** Build the processed-bucket key for one resolution of a raw upload. */
export function outputKey(rawKey: string, resolution: Resolution): string {
  return `${keyBase(rawKey)}/${resolution}.mp4`;
}

/** Presigned PUT URL the browser uses to upload directly to the raw bucket. */
export async function presignUpload(key: string, contentType: string): Promise<string> {
  return getSignedUrl(
    s3(),
    new PutObjectCommand({ Bucket: rawBucket(), Key: key, ContentType: contentType }),
    { expiresIn: URL_TTL_SECONDS },
  );
}

/** Presigned GET URL for a finished output, or null if it isn't in S3 yet. */
export async function presignOutputIfReady(rawKey: string, resolution: Resolution): Promise<string | null> {
  const key = outputKey(rawKey, resolution);
  try {
    await s3().send(new HeadObjectCommand({ Bucket: processedBucket(), Key: key }));
  } catch {
    // 404 / NotFound — output not produced yet.
    return null;
  }
  return getSignedUrl(
    s3(),
    new GetObjectCommand({ Bucket: processedBucket(), Key: key }),
    { expiresIn: URL_TTL_SECONDS },
  );
}
