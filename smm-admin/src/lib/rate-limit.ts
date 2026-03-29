// In-memory rate limiter.
// NOTE: For multi-instance deployments, replace this with Redis-based rate limiting.
const rateMap = new Map<string, { count: number; resetAt: number }>();

// Cleanup expired entries every 100 calls
let cleanupCounter = 0;
function cleanupExpired() {
  const now = Date.now();
  for (const [key, entry] of rateMap.entries()) {
    if (now > entry.resetAt) rateMap.delete(key);
  }
}

/**
 * Rate limit by key. Use `endpoint:ip` format to avoid collisions between endpoints.
 * Example: rateLimit("invites:" + ip, 10, 60000)
 */
export function rateLimit(key: string, limit = 5, windowMs = 60000): boolean {
  cleanupCounter++;
  if (cleanupCounter % 100 === 0) cleanupExpired();

  const now = Date.now();
  const entry = rateMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count++;
  if (entry.count > limit) return false;
  return true;
}
