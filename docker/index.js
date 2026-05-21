import dotenv from "dotenv";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
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

const bucketNameRaw = process.env.BUCKET_NAME_RAW;
const bucketNameTranscoded = process.env.BUCKET_NAME_TRANSCODED;
const KEY = process.env.KEY;

async function init() {
  console.log(`Downloading s3://${bucketNameRaw}/${KEY}`);

  const result = await s3Client.send(
    new GetObjectCommand({ Bucket: bucketNameRaw, Key: KEY })
  );

  const originalFilePath = path.resolve("original-video.mp4");
  await pipeline(result.Body, fsSync.createWriteStream(originalFilePath)); // Stream download directly to file to handle large videos without memory issues
  console.log("Download complete");

  // Derive a per-video S3 prefix so concurrent jobs never collide
  // e.g. KEY = "videos/my-clip.mp4" → prefix = "videos/my-clip"
  const keyBase = KEY.replace(/\.[^/.]+$/, "");

  const promises = RESOLUTIONS.map((resolution) => {
    const outputFilePath = path.resolve(`output-${resolution.name}.mp4`);
    const s3OutputKey = `${keyBase}/${resolution.name}.mp4`;


    return new Promise((resolve, reject) => {
      ffmpeg(originalFilePath)
        .output(outputFilePath)
        .withVideoCodec(resolution.codec)
        .withAudioCodec('aac')
        .addOption('-b:a', '128k')
        .withSize(`${resolution.width}x${resolution.height}`)
        .addOption('-crf', String(resolution.crf)) 
        .addOption('-preset', 'fast')
        .addOption('-threads', '0')
        .on("end", async () => {
          try {
            // PutObjectCommand with a ReadStream body silently uploads 0 bytes for
            // large files in SDK v3 — Upload handles multipart streaming correctly.
            const upload = new Upload({
              client: s3Client,
              params: {
                Bucket: bucketNameTranscoded,
                Key: s3OutputKey,
                Body: fsSync.createReadStream(outputFilePath),
                ContentType: "video/mp4",
              },
            });

            await upload.done();
            console.log(`Uploaded ${resolution.name} → s3://${bucketNameTranscoded}/${s3OutputKey}`);

            await fs.unlink(outputFilePath);
            resolve();
          } catch (err) {
            reject(err);
          }
        })
        .on("error", (err) => {
          console.error(`ffmpeg error (${resolution.name}):`, err.message);
          reject(err);
        })
        .format("mp4") // If we want to do a stream then it need hls and ts files, but for now we can just write to disk and upload after. This is simpler and more compatible with ffmpeg.
        .run();
    });
  });

  try {
    await Promise.all(promises);
    await fs.unlink(originalFilePath);
    console.log("All resolutions transcoded and uploaded successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Transcoding failed:", error);
    process.exit(1);
  }
}

init();
