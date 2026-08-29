import Redis from "ioredis";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";

// Reused across warm invocations. This Lambda runs inside the VPC so it can
// reach ElastiCache; keep the connection lazy so a cold start doesn't hang
// if Redis is briefly unreachable.
const redis = new Redis(process.env.REDIS_URI!, {
  lazyConnect: true,
  maxRetriesPerRequest: 2,
  enableOfflineQueue: true,
});

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * GET /status/{key}
 *
 * Returns the transcode status the worker writes to Redis:
 * PROCESSING | COMPLETED | FAILED, or NOT_FOUND if the key is unknown.
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const key = event.pathParameters?.key
    ? decodeURIComponent(event.pathParameters.key)
    : undefined;

  if (!key) {
    return respond(400, { error: "Missing key" });
  }

  try {
    if (redis.status === "wait" || redis.status === "end") {
      await redis.connect();
    }
    const status = await redis.get(key);
    return respond(200, { key, status: status ?? "NOT_FOUND" });
  } catch (err) {
    console.error(`Failed to read status for ${key}:`, err);
    return respond(500, { error: "Failed to read status" });
  }
};

function respond(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    body: JSON.stringify(body),
  };
}
