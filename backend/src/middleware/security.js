import { fail } from "../lib/http.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF guard.
 *
 * The frontend and the API are served from one Worker, so a legitimate
 * state-changing request always carries an `Origin` header equal to the
 * Worker's own origin — browsers send Origin on every non-GET/HEAD request,
 * same-origin included. Anything else is either cross-site or not a browser.
 *
 * This is a second line of defence: the session cookie is SameSite=Lax, which
 * already stops cross-site POSTs from carrying it.
 */
export async function enforceOrigin(c, next) {
  if (SAFE_METHODS.has(c.req.method)) {
    return next();
  }

  const origin = c.req.header("origin");

  if (!origin || origin !== new URL(c.req.url).origin) {
    throw fail(403, "Request origin is not allowed");
  }

  return next();
}

export async function securityHeaders(c, next) {
  await next();

  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("Referrer-Policy", "same-origin");
  c.res.headers.set("X-Frame-Options", "DENY");
}
