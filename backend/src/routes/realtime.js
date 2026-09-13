import { Hono } from "hono";
import { TICKET_AUDIENCE, TICKET_TTL_SECONDS } from "../lib/config.js";
import { fail } from "../lib/http.js";
import { signJwt, verifyJwt } from "../lib/jwt.js";
import { requireAuth } from "../middleware/auth.js";
import { connectSocket } from "../realtime/client.js";

const realtime = new Hono();

/**
 * Browsers cannot attach headers to a WebSocket handshake, and relying on the
 * session cookie surviving a cross-site upgrade is fragile. Instead the client
 * exchanges its session for a single-purpose, 60-second ticket and puts that in
 * the socket URL.
 */
realtime.get("/ticket", requireAuth, async (c) => {
  const ticket = await signJwt(
    { sub: c.get("user")._id, aud: TICKET_AUDIENCE },
    c.env.JWT_SECRET,
    TICKET_TTL_SECONDS,
  );

  return c.json({ ticket, expiresIn: TICKET_TTL_SECONDS });
});

realtime.get("/", async (c) => {
  if (c.req.header("upgrade")?.toLowerCase() !== "websocket") {
    throw fail(426, "Expected a WebSocket upgrade");
  }

  const payload = await verifyJwt(c.req.query("ticket"), c.env.JWT_SECRET, TICKET_AUDIENCE);

  if (!payload?.sub) {
    // 401 on an upgrade surfaces to the client as a failed handshake, which the
    // client treats as "fetch a fresh ticket and retry".
    throw fail(401, "Invalid or expired ticket");
  }

  return connectSocket(c.env, c.req.raw, payload.sub);
});

export default realtime;
