import { randomUUID } from "node:crypto";
import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";

const s3 = new S3Client({ region: process.env.AWS_REGION });

const RAW_BUCKET = process.env.BUCKET_NAME_RAW!;
const MAX_BYTES = 20_000_000_000; // 20 GB
const EXPIRES_SECONDS = 300;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * GET /signedurl?filename=my-clip.mp4
 *
 * Returns a presigned POST the browser uses to upload directly to the raw
 * bucket. We mint a flat, slash-free object key (`<uuid>.<ext>`) so it can
 * later be echoed straight into the `/status/{key}` path without any
 * URL-encoding surprises.
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const filename = event.queryStringParameters?.filename ?? "";
    const extMatch = filename.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : "mp4";
    // Store uploads under a videos/ prefix. The worker derives the processed
    // output prefix from this key, so outputs land under videos/<uuid>/ too.
    const key = `videos/${randomUUID()}.${ext}`;

    // `Key` pins the object name and is echoed back in `fields.key`, so the
    // client can't rename the upload.
    const { url, fields } = await createPresignedPost(s3, {
      Bucket: RAW_BUCKET,
      Key: key,
      Conditions: [
        ["starts-with", "$Content-Type", "video/"],
        ["content-length-range", 0, MAX_BYTES],
      ],
      Expires: EXPIRES_SECONDS,
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      body: JSON.stringify({ url, fields, key }),
    };
  } catch (err) {
    console.error("Failed to create presigned POST:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      body: JSON.stringify({ error: "Failed to create upload URL" }),
    };
  }
};
