interface Bucket {
  tokens: number;
  lastRefill: number;
  usedToday: number;
  dayStart: number;
}

const DAILY_TOKEN_LIMIT = 100000;
const REFILL_RATE_PER_SECOND = 100; // tokens added per second
const BUCKET_CAPACITY = 1000; // max burst size

const buckets = new Map<string, Bucket>();

function getBucket(userId: string): Bucket {
  const now = Date.now();
  let bucket = buckets.get(userId);
  if (!bucket) {
    bucket = {
      tokens: BUCKET_CAPACITY,
      lastRefill: now,
      usedToday: 0,
      dayStart: now,
    };
    buckets.set(userId, bucket);
  }

  const dayMs = 24 * 60 * 60 * 1000;
  if (now - bucket.dayStart >= dayMs) {
    bucket.dayStart = now;
    bucket.usedToday = 0;
  }

  const elapsedSeconds = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(
    BUCKET_CAPACITY,
    bucket.tokens + elapsedSeconds * REFILL_RATE_PER_SECOND
  );
  bucket.lastRefill = now;
  return bucket;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  dailyUsed: number;
  dailyLimit: number;
}

export function checkRateLimit(userId: string): RateLimitResult {
  const bucket = getBucket(userId);
  const allowed = bucket.tokens >= 1 && bucket.usedToday < DAILY_TOKEN_LIMIT;
  return {
    allowed,
    remaining: Math.floor(bucket.tokens),
    dailyUsed: bucket.usedToday,
    dailyLimit: DAILY_TOKEN_LIMIT,
  };
}

export function recordTokenUsage(userId: string, tokens: number): void {
  const bucket = getBucket(userId);
  bucket.tokens = Math.max(0, bucket.tokens - tokens);
  bucket.usedToday += tokens;
}

export function resetRateLimit(userId: string): void {
  buckets.delete(userId);
}
