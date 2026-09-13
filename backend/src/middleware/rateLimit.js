import { fail } from "../lib/http.js";

/**
 * Cloudflare's native rate-limiting binding. Counters are per-colo rather than
 * global, so the effective limit is a brute-force brake, not a hard quota — it
 * must never be the only guard on a destructive operation.
 *
 * The middleware no-ops when the binding is absent so the Worker still boots on
 * a config that has not declared one.
 */
export function rateLimit(bindingName, keyFor) {
  return async function rateLimitMiddleware(c, next) {
    const limiter = c.env[bindingName];

    if (!limiter?.limit) {
      return next();
    }

    const key = keyFor(c);

    if (!key) {
      return next();
    }

    const { success } = await limiter.limit({ key });

    if (!success) {
      throw fail(429, "Too many requests. Please try again shortly.");
    }

    return next();
  };
}

export function clientIp(c) {
  return c.req.header("cf-connecting-ip") ?? "unknown";
}
