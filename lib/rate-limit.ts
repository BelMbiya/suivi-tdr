import { getRedis } from "@/lib/redis";

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
};

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const redis = getRedis();
  const resetAt = new Date(Date.now() + windowSeconds * 1000);

  if (!redis) {
    return { allowed: true, remaining: limit, resetAt };
  }

  try {
    const current = await redis.incr(key);

    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }

    return {
      allowed: current <= limit,
      remaining: Math.max(limit - current, 0),
      resetAt,
    };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `Rate limit skipped because Redis is unavailable: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    }

    return { allowed: true, remaining: limit, resetAt };
  }
}
