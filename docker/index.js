import dotenv from "dotenv";
import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import Redis from "ioredis";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import ffmpeg from "fluent-ffmpeg";
import { pipeline } from 'node:stream/promises';

dotenv.config();

const RESOLUTIONS = [
  { name: "720p", width: 1280, height: 720, codec: "libx264", crf: 23 },
  { name: "480p", width: 854,  height: 480, codec: "libx264", crf: 23 },
  { name: "360p", width: 640,  height: 360, codec: "libx264", crf: 23 },
];


// Credentials come from ECS task IAM role automatically — no hardcoding needed
const s3Client = new S3Client({ region: process.env.AWS_REGION });

// Redis holds per-job status so the frontend can poll progress.
const redis = process.env.REDIS_URI ? new Redis(process.env.REDIS_URI) : null;

const bucketNameRaw = process.env.BUCKET_NAME_RAW;
const bucketNameTranscoded = process.env.BUCKET_NAME_TRANSCODED;
const KEY = process.env.KEY;

// Best-effort status write — never let a Redis hiccup abort transcoding.
async function setStatus(status) {
  if (!redis) return;
  try {
    await redis.set(KEY, status);
    console.log(`Status ${KEY} → ${status}`);
  } catch (err) {
    console.error(`Failed to set status ${status}:`, err.message);
  }
}

const outputPath = (resolution) => path.resolve(`output-${resolution.name}.mp4`);

/**
 * Transcode every resolution in a SINGLE ffmpeg process. The source is decoded
 * once and a `split` filter fans it out to N scaled encodes, so we don't pay
 * the (expensive) decode cost per resolution. With one process, `-threads 0`
 * lets ffmpeg use every core without the contention of concurrent jobs.
 */
function transcodeAll(inputPath) {
  return new Promise((resolve, reject) => {
    // Build the filtergraph:
    //   [0:v]split=3[v0in][v1in][v2in];
    //   [v0in]scale=1280:720[v0]; [v1in]scale=854:480[v1]; ...
    const splitOutputs = RESOLUTIONS.map((_, i) => `[v${i}in]`).join("");
    const filters = [
      `[0:v]split=${RESOLUTIONS.length}${splitOutputs}`,
      ...RESOLUTIONS.map(
        (r, i) => `[v${i}in]scale=${r.width}:${r.height}[v${i}]`
      ),
    ];

    const command = ffmpeg(inputPath).complexFilter(filters);

    RESOLUTIONS.forEach((r, i) => {
      command.output(outputPath(r)).outputOptions([
        "-map", `[v${i}]`,     // scaled video for this resolution
        "-map", "0:a?",         // original audio (optional — '?' tolerates none)
        "-c:v", r.codec,
        "-crf", String(r.crf),
        "-preset", "fast",
        "-c:a", "aac",
        "-b:a", "128k",
        "-threads", "0",
        "-movflags", "+faststart", // enable progressive playback on the web
        "-f", "mp4",
      ]);
    });

    command
      .on("start", (cmd) => console.log("ffmpeg:", cmd))
      .on("progress", (p) => {
        if (p.percent != null) console.log(`Encoding… ${Math.round(p.percent)}%`);
      })
      .on("end", () => {
        console.log("All resolutions encoded (single decode).");
        resolve();
      })
      .on("error", (err) => {
        console.error("ffmpeg error:", err.message);
        reject(err);
      })
      .run();
  });
}

// Upload one finished output file to the processed bucket, then delete it locally.
async function uploadOutput(resolution, keyBase) {
  const filePath = outputPath(resolution);
  const s3OutputKey = `${keyBase}/${resolution.name}.mp4`;

  // PutObjectCommand with a ReadStream body silently uploads 0 bytes for large
  // files in SDK v3 — Upload handles multipart streaming correctly.
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: bucketNameTranscoded,
      Key: s3OutputKey,
      Body: fsSync.createReadStream(filePath),
      ContentType: "video/mp4",
    },
  });

  await upload.done();
  console.log(`Uploaded ${resolution.name} → s3://${bucketNameTranscoded}/${s3OutputKey}`);
  await fs.unlink(filePath);
}

async function init() {
  await setStatus("PROCESSING");

  console.log(`Latest Downloading s3://${bucketNameRaw}/${KEY}`);

  const result = await s3Client.send(
    new GetObjectCommand({ Bucket: bucketNameRaw, Key: KEY })
  );

  const originalFilePath = path.resolve("original-video.mp4");
  await pipeline(result.Body, fsSync.createWriteStream(originalFilePath)); // Stream download directly to file to handle large videos without memory issues
  console.log("Download complete");

  // Derive a per-video S3 prefix so concurrent jobs never collide
  // e.g. KEY = "videos/my-clip.mp4" → prefix = "videos/my-clip"
  const keyBase = KEY.replace(/\.[^/.]+$/, "");

  try {
    // 1) One ffmpeg pass produces every resolution locally.
    await transcodeAll(originalFilePath);

    // 2) Upload the outputs in parallel (network-bound, independent files).
    await Promise.all(RESOLUTIONS.map((r) => uploadOutput(r, keyBase)));

    await fs.unlink(originalFilePath);

    // 3) Source is fully transcoded — drop it from the raw bucket to save storage.
    try {
      await s3Client.send(
        new DeleteObjectCommand({ Bucket: bucketNameRaw, Key: KEY })
      );
      console.log(`Deleted source s3://${bucketNameRaw}/${KEY}`);
    } catch (err) {
      console.error("Failed to delete source object:", err.message);
    }

    await setStatus("COMPLETED");
    console.log("All resolutions transcoded and uploaded successfully.");
    if (redis) await redis.quit();
    process.exit(0);
  } catch (error) {
    console.error("Transcoding failed:", error);
    await setStatus("FAILED");
    if (redis) await redis.quit();
    process.exit(1);
  }
}

init();
