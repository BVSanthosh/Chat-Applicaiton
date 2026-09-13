import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { assertConfigured } from "./lib/config.js";
import { enforceOrigin, securityHeaders } from "./middleware/security.js";
import authRoutes from "./routes/auth.js";
import messageRoutes from "./routes/messages.js";
import realtimeRoutes from "./routes/realtime.js";

export { PresenceRoom } from "./realtime/PresenceRoom.js";

const app = new Hono();

// A 101 response is immutable and must be returned untouched, so the header
// middleware steps aside for the WebSocket upgrade. Its own ticket check is
// what authorises that request.
const isSocketUpgrade = (c) => c.req.header("upgrade")?.toLowerCase() === "websocket";

app.use("*", async (c, next) => (isSocketUpgrade(c) ? next() : securityHeaders(c, next)));
app.use("*", async (c, next) => (isSocketUpgrade(c) ? next() : enforceOrigin(c, next)));

app.get("/api/health", (c) => c.json({ status: "ok" }));

app.route("/api/auth", authRoutes);
app.route("/api/messages", messageRoutes);
app.route("/api/realtime", realtimeRoutes);

// Only /api/* is routed to the Worker (see `run_worker_first` in
// wrangler.toml); everything else is served from the asset store. So anything
// reaching this point is an unknown API path, not a missing page.
app.notFound(() => Response.json({ message: "Not found" }, { status: 404 }));

app.onError((error) => {
  if (error instanceof HTTPException) {
    return error.getResponse();
  }

  // Never leak internals to the client; the detail goes to the Workers log.
  console.error("Unhandled error", error?.stack ?? error);

  return Response.json({ message: "Internal server error" }, { status: 500 });
});

export default {
  async fetch(request, env, ctx) {
    try {
      assertConfigured(env);
    } catch (error) {
      console.error("Startup configuration error", error.message);

      return Response.json({ message: "Server is not configured correctly" }, { status: 500 });
    }

    return app.fetch(request, env, ctx);
  },
};
