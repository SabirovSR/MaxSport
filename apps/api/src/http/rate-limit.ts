import { createHash } from "node:crypto";
import rateLimit from "@fastify/rate-limit";
import { Redis } from "ioredis";
import type { FastifyInstance, FastifyRequest } from "fastify";

function clientKey(request: FastifyRequest): string {
  const initData = String(request.headers["x-init-data"] ?? "");
  if (initData) {
    return createHash("sha256").update(initData).digest("hex").slice(0, 16);
  }
  return request.ip;
}

export async function registerRateLimit(
  app: FastifyInstance,
  redisUrl: string
) {
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });
  redis.on("error", (error: Error) => {
    app.log.warn({ err: error }, "rate-limit redis");
  });
  void redis.connect().catch(() => undefined);

  await app.register(rateLimit, {
    global: true,
    max: 120,
    timeWindow: "1 minute",
    redis,
    nameSpace: "ms-rl-",
    skipOnError: true,
    keyGenerator: clientKey,
    allowList: (request) => {
      const path = request.url.split("?")[0] ?? "";
      return path === "/healthz" || path === "/webhook" || path === "/open";
    },
  });
}

export const tightLimit = { rateLimit: { max: 20, timeWindow: "1 minute" } };
export const voteLimit = { rateLimit: { max: 40, timeWindow: "1 minute" } };
