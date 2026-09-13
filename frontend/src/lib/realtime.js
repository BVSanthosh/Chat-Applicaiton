import { axiosInstance } from "./axios.js";
import { websocketUrl } from "./config.js";

const PING_INTERVAL_MS = 25000;
const BASE_RETRY_MS = 1000;
const MAX_RETRY_MS = 30000;

/**
 * Replaces socket.io-client with a plain WebSocket against the Durable Object.
 *
 * Socket.IO's reconnection, heartbeat and event API are the parts that
 * actually mattered, so they are reimplemented here: exponential backoff with
 * jitter, an application-level ping the DO answers while hibernating, and a
 * small emitter. Every connection uses a freshly minted short-lived ticket,
 * because a cached one would be expired by the time a long outage ends.
 */
class RealtimeClient {
  #socket = null;
  #listeners = new Map();
  #pingTimer = null;
  #retryTimer = null;
  #attempt = 0;
  #wantsConnection = false;
  #hasConnectedBefore = false;

  on(event, handler) {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, new Set());
    }

    this.#listeners.get(event).add(handler);

    return () => {
      this.#listeners.get(event)?.delete(handler);
    };
  }

  #emit(event, payload) {
    for (const handler of this.#listeners.get(event) ?? []) {
      try {
        handler(payload);
      } catch (error) {
        console.error(`Realtime listener for "${event}" failed`, error);
      }
    }
  }

  get isConnected() {
    return this.#socket?.readyState === WebSocket.OPEN;
  }

  connect() {
    this.#wantsConnection = true;

    if (this.#socket || this.#retryTimer) {
      return;
    }

    this.#open();
  }

  async #open() {
    if (!this.#wantsConnection) {
      return;
    }

    let ticket;

    try {
      const { data } = await axiosInstance.get("/realtime/ticket");
      ticket = data.ticket;
    } catch {
      // Usually means the session expired; back off and let checkAuth decide.
      this.#scheduleRetry();
      return;
    }

    if (!this.#wantsConnection) {
      return;
    }

    let socket;

    try {
      socket = new WebSocket(websocketUrl(ticket));
    } catch (error) {
      console.error("Failed to open realtime socket", error);
      this.#scheduleRetry();
      return;
    }

    this.#socket = socket;

    socket.addEventListener("open", () => {
      this.#attempt = 0;
      this.#startPing();
      this.#emit("status", { connected: true });

      // Anything sent while the socket was down was missed, so consumers get a
      // chance to resynchronise.
      if (this.#hasConnectedBefore) {
        this.#emit("reconnected");
      }

      this.#hasConnectedBefore = true;
    });

    socket.addEventListener("message", (event) => {
      let frame;

      try {
        frame = JSON.parse(event.data);
      } catch {
        return;
      }

      if (frame?.type === "pong") {
        return;
      }

      if (frame?.type === "onlineUsers" && Array.isArray(frame.users)) {
        this.#emit("onlineUsers", frame.users);
        return;
      }

      if (frame?.type === "newMessage" && frame.message) {
        this.#emit("newMessage", frame.message);
      }
    });

    socket.addEventListener("close", () => {
      if (this.#socket === socket) {
        this.#socket = null;
      }

      this.#stopPing();
      this.#emit("status", { connected: false });
      this.#emit("onlineUsers", []);
      this.#scheduleRetry();
    });

    socket.addEventListener("error", () => {
      // "error" is always followed by "close"; reconnect is handled there.
      socket.close();
    });
  }

  #scheduleRetry() {
    if (!this.#wantsConnection || this.#retryTimer) {
      return;
    }

    const backoff = Math.min(BASE_RETRY_MS * 2 ** this.#attempt, MAX_RETRY_MS);
    // Jitter keeps every client from reconnecting in lockstep after an outage.
    const delay = backoff / 2 + Math.random() * (backoff / 2);

    this.#attempt += 1;
    this.#retryTimer = setTimeout(() => {
      this.#retryTimer = null;
      this.#open();
    }, delay);
  }

  #startPing() {
    this.#stopPing();
    this.#pingTimer = setInterval(() => {
      if (this.isConnected) {
        this.#socket.send(JSON.stringify({ type: "ping" }));
      }
    }, PING_INTERVAL_MS);
  }

  #stopPing() {
    if (this.#pingTimer) {
      clearInterval(this.#pingTimer);
      this.#pingTimer = null;
    }
  }

  disconnect() {
    this.#wantsConnection = false;
    this.#hasConnectedBefore = false;
    this.#attempt = 0;
    this.#stopPing();

    if (this.#retryTimer) {
      clearTimeout(this.#retryTimer);
      this.#retryTimer = null;
    }

    if (this.#socket) {
      const socket = this.#socket;
      this.#socket = null;
      socket.close();
    }

    this.#emit("onlineUsers", []);
    this.#emit("status", { connected: false });
  }
}

export const realtime = new RealtimeClient();
