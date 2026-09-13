/**
 * Replaces the Socket.IO server.
 *
 * A single instance holds every live WebSocket. Each socket is tagged with its
 * user id, so presence is just "which tags are currently connected" and message
 * delivery is a tag lookup — no in-memory user->socket map to drift out of sync
 * the way the old `userSocketMap` did across restarts.
 *
 * Uses the hibernation API: the object can be evicted between events without
 * dropping connections, so idle chats cost nothing.
 */
export class PresenceRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;

    // Answered by the runtime while hibernating, so keepalives never wake us.
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair(JSON.stringify({ type: "ping" }), JSON.stringify({ type: "pong" })),
    );
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/connect") {
      return this.#connect(request, url);
    }

    if (url.pathname === "/publish") {
      return this.#publish(request);
    }

    return new Response("Not found", { status: 404 });
  }

  #connect(request, url) {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected a WebSocket upgrade", { status: 426 });
    }

    const userId = url.searchParams.get("userId");

    if (!userId) {
      return new Response("Missing userId", { status: 400 });
    }

    const { 0: client, 1: server } = new WebSocketPair();

    this.ctx.acceptWebSocket(server, [userId]);

    // The joining socket needs the roster immediately; everyone else only
    // needs to hear about the change.
    server.send(JSON.stringify({ type: "onlineUsers", users: this.#onlineUserIds() }));
    this.#broadcastPresence({ skipRecipient: server });

    return new Response(null, { status: 101, webSocket: client });
  }

  async #publish(request) {
    let body;

    try {
      body = await request.json();
    } catch {
      return new Response("Invalid body", { status: 400 });
    }

    const userIds = Array.isArray(body?.userIds) ? body.userIds : [];
    const payload = JSON.stringify(body?.payload ?? null);
    let delivered = 0;

    for (const userId of new Set(userIds)) {
      for (const socket of this.ctx.getWebSockets(String(userId))) {
        try {
          socket.send(payload);
          delivered += 1;
        } catch {
          // Socket died between lookup and send; the close handler will clean up.
        }
      }
    }

    return Response.json({ delivered });
  }

  webSocketMessage(ws, message) {
    // Clients are not trusted to originate chat traffic — messages are created
    // through the authenticated HTTP API. Only keepalives are honoured here.
    if (typeof message !== "string") {
      return;
    }

    try {
      if (JSON.parse(message)?.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      }
    } catch {
      // Ignore anything unparseable.
    }
  }

  webSocketClose(ws) {
    this.#broadcastPresence({ skipRecipient: ws, skipRoster: ws });
  }

  webSocketError(ws) {
    this.#broadcastPresence({ skipRecipient: ws, skipRoster: ws });
  }

  #onlineUserIds(exclude) {
    const ids = new Set();

    for (const socket of this.ctx.getWebSockets()) {
      if (socket === exclude) {
        continue;
      }

      const [userId] = this.ctx.getTags(socket);

      if (userId) {
        ids.add(userId);
      }
    }

    return [...ids];
  }

  /**
   * `skipRecipient` is a socket that should not receive this broadcast — the
   * one that just joined already got the roster directly, and a closing one
   * cannot receive anything.
   *
   * `skipRoster` is a socket to leave out of the roster itself. A closing
   * socket is still listed by `getWebSockets()` inside the close handler, so it
   * has to be filtered out explicitly or the user appears online after leaving.
   * A user with another tab open stays online, because only that one socket is
   * dropped and the remaining one still carries the tag.
   */
  #broadcastPresence({ skipRecipient, skipRoster } = {}) {
    const users = this.#onlineUserIds(skipRoster);
    const payload = JSON.stringify({ type: "onlineUsers", users });

    for (const socket of this.ctx.getWebSockets()) {
      if (socket === skipRecipient) {
        continue;
      }

      try {
        socket.send(payload);
      } catch {
        // Ignore sockets that are already gone.
      }
    }
  }
}
