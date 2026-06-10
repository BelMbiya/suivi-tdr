import Redis from "ioredis";
import { env } from "@/lib/env";

const globalForRedis = globalThis as unknown as {
  redis?: Redis;
};

export function getRedis() {
  if (!env.REDIS_URL) {
    return null;
  }

  if (!globalForRedis.redis) {
    globalForRedis.redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      retryStrategy(times) {
        return times > 3 ? null : Math.min(times * 200, 1_000);
      },
    });

    globalForRedis.redis.on("error", (error) => {
      if (process.env.NODE_ENV === "development") {
        console.warn(`Redis unavailable: ${error.message}`);
      }
    });
  }

  return globalForRedis.redis;
}
