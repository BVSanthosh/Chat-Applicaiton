import { getCookie } from "hono/cookie";
import { SESSION_COOKIE } from "../lib/config.js";
import { fail } from "../lib/http.js";
import { verifyJwt } from "../lib/jwt.js";
import { findUserById, serializeUser } from "../db/users.js";

/**
 * Rejects unauthenticated requests. Unlike the old middleware this returns 401
 * for every auth failure (the old one leaked "user not found" as a 404 and
 * reported internal errors as 400).
 */
export async function requireAuth(c, next) {
  const token = getCookie(c, SESSION_COOKIE);

  if (!token) {
    throw fail(401, "Unauthorised");
  }

  const payload = await verifyJwt(token, c.env.JWT_SECRET);

  if (!payload?.sub) {
    throw fail(401, "Unauthorised");
  }

  const row = await findUserById(c.env.DB, payload.sub);

  if (!row) {
    throw fail(401, "Unauthorised");
  }

  c.set("user", serializeUser(row));

  await next();
}
