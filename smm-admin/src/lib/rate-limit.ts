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

export function rateLimit(ip: string, limit = 5, windowMs = 60000): boolean {
  cleanupCounter++;
  if (cleanupCounter % 100 === 0) cleanupExpired();

  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count++;
  if (entry.count > limit) return false;
  return true;
}
