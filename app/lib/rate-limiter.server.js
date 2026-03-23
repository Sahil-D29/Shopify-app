/**
 * In-memory sliding window rate limiter for public API endpoints.
 * Limits requests per shop parameter to prevent abuse.
 */
const windowMs = 60 * 1000; // 1 minute window
const maxRequests = 60; // 60 requests per window

// In-memory store (resets on cold start, which is acceptable for serverless)
const store = new Map();

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.windowStart > windowMs * 2) {
      store.delete(key);
    }
  }
}

/**
 * Check rate limit for a given key (typically "endpoint:shop").
 * Returns { allowed: boolean, remaining: number, retryAfter?: number }
 */
export function checkRateLimit(key) {
  const now = Date.now();

  // Periodic cleanup
  if (Math.random() < 0.01) cleanup();

  let entry = store.get(key);

  if (!entry || now - entry.windowStart > windowMs) {
    entry = { windowStart: now, count: 0 };
    store.set(key, entry);
  }

  entry.count++;

  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.windowStart + windowMs - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  return { allowed: true, remaining: maxRequests - entry.count };
}

/**
 * Create a rate-limited Response if the limit is exceeded.
 * Returns null if the request is allowed.
 */
export function rateLimitResponse(request, endpoint) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "unknown";
  const key = `${endpoint}:${shop}`;

  const result = checkRateLimit(key);

  if (!result.allowed) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded", retryAfter: result.retryAfter }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(result.retryAfter),
          "X-RateLimit-Limit": String(maxRequests),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  return null;
}
