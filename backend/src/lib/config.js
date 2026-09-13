import { resolveIterations } from "./password.js";

export const SESSION_COOKIE = "token";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
export const TICKET_TTL_SECONDS = 60;
export const TICKET_AUDIENCE = "ws";

const DEFAULT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Fails fast on missing or obviously weak configuration. A Worker that boots
 * without JWT_SECRET would otherwise mint unverifiable tokens at runtime.
 */
export function assertConfigured(env) {
  if (!env.DB) {
    throw new Error("Missing D1 binding `DB`. Check [[d1_databases]] in wrangler.toml.");
  }

  if (!env.PRESENCE) {
    throw new Error("Missing Durable Object binding `PRESENCE`. Check wrangler.toml.");
  }

  if (typeof env.JWT_SECRET !== "string" || env.JWT_SECRET.length < 32) {
    throw new Error(
      "JWT_SECRET must be set to at least 32 characters. Set it with `wrangler secret put JWT_SECRET`.",
    );
  }
}

export function maxUploadBytes(env) {
  const parsed = Number.parseInt(env.MAX_UPLOAD_BYTES ?? "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_UPLOAD_BYTES;
}

export function pbkdf2Iterations(env) {
  return resolveIterations(env.PBKDF2_ITERATIONS);
}

export function sessionCookieOptions(env) {
  const sameSite = String(env.COOKIE_SAMESITE ?? "lax").toLowerCase();
  const normalized = ["lax", "strict", "none"].includes(sameSite) ? sameSite : "lax";

  return {
    httpOnly: true,
    path: "/",
    sameSite: normalized === "none" ? "None" : normalized === "lax" ? "Lax" : "Strict",
    // SameSite=None is only honoured on secure cookies, so the two travel
    // together regardless of environment.
    secure: normalized === "none" ? true : env.APP_ENV !== "development",
  };
}
