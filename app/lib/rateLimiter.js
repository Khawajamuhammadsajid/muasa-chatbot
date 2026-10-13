/**
 * Sliding Window Rate Limiter
 * Per-IP and Per-Shop rate limiting for App Proxy endpoints
 */

const ipBuckets = new Map();
const shopBuckets = new Map();

// Default limits
const LIMITS = {
  IP: { maxRequests: 30, windowMs: 60 * 1000 },       // 30 req/min per IP
  SHOP: { maxRequests: 180, windowMs: 60 * 1000 }     // 180 req/min per Shop
};

// Periodic memory purge every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of ipBuckets.entries()) {
    if (now - record.firstRequest > LIMITS.IP.windowMs * 2) {
      ipBuckets.delete(key);
    }
  }
  for (const [key, record] of shopBuckets.entries()) {
    if (now - record.firstRequest > LIMITS.SHOP.windowMs * 2) {
      shopBuckets.delete(key);
    }
  }
}, 5 * 60 * 1000);

function checkLimit(buckets, key, config) {
  if (!key) return { allowed: true, remaining: config.maxRequests };

  const now = Date.now();
  let record = buckets.get(key);

  if (!record || now - record.firstRequest > config.windowMs) {
    record = { firstRequest: now, count: 1 };
    buckets.set(key, record);
    return { allowed: true, remaining: config.maxRequests - 1 };
  }

  if (record.count >= config.maxRequests) {
    const retryAfter = Math.ceil((record.firstRequest + config.windowMs - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.max(1, retryAfter)
    };
  }

  record.count += 1;
  return { allowed: true, remaining: config.maxRequests - record.count };
}

/**
 * Checks rate limits for a given IP and shop domain
 * @param {string} ip
 * @param {string} shopDomain
 * @returns {{ allowed: boolean, reason?: string, retryAfter?: number }}
 */
export function checkRateLimit(ip, shopDomain) {
  const ipCheck = checkLimit(ipBuckets, ip, LIMITS.IP);
  if (!ipCheck.allowed) {
    return {
      allowed: false,
      reason: `Too many requests from your IP. Please try again in ${ipCheck.retryAfter}s.`,
      retryAfter: ipCheck.retryCheck || ipCheck.retryAfter
    };
  }

  const shopCheck = checkLimit(shopBuckets, shopDomain, LIMITS.SHOP);
  if (!shopCheck.allowed) {
    return {
      allowed: false,
      reason: `High store traffic volume. Please try again in ${shopCheck.retryAfter}s.`,
      retryAfter: shopCheck.retryAfter
    };
  }

  return { allowed: true };
}
