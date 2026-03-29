// In-memory rate limiter.
// NOTE: For multi-instance deployments, replace this with Redis-based rate limiting.
const MAX_MAP_SIZE = 50000;
const rateMap = new Map<string, { count: number; resetAt: number }>();

// Cleanup expired entries every 100 calls or when map exceeds size limit
let cleanupCounter = 0;
function cleanupExpired() {
  const now = Date.now();
  for (const [key, entry] of rateMap.entries()) {
    if (now > entry.resetAt) rateMap.delete(key);
  }
  // If still too large after cleanup, evict oldest entries
  if (rateMap.size > MAX_MAP_SIZE) {
    const toDelete = rateMap.size - MAX_MAP_SIZE;
    const iter = rateMap.keys();
    for (let i = 0; i < toDelete; i++) {
      const k = iter.next().value;
      if (k) rateMap.delete(k);
    }
  }
}

/**
 * Rate limit by key. Use `endpoint:ip` format to avoid collisions between endpoints.
 * Example: rateLimit("invites:" + ip, 10, 60000)
 */
export function rateLimit(key: string, limit = 5, windowMs = 60000): boolean {
  cleanupCounter++;
  if (cleanupCounter % 100 === 0 || rateMap.size > MAX_MAP_SIZE) cleanupExpired();

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
