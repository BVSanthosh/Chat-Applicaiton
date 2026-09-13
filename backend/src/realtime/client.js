const ROOM_NAME = "global";

// Every connection lives in one instance, so presence is globally consistent.
// Shard on conversation id here if this ever outgrows a single object.
function room(env) {
  return env.PRESENCE.get(env.PRESENCE.idFromName(ROOM_NAME));
}

export function connectSocket(env, request, userId) {
  const url = new URL("https://presence.internal/connect");
  url.searchParams.set("userId", userId);

  return room(env).fetch(new Request(url, request));
}

/**
 * Best-effort fan-out. A realtime delivery failure must not fail the HTTP
 * request that persisted the message — the client still has it, and the
 * recipient will load it on next fetch.
 */
export async function publishToUsers(env, userIds, payload) {
  try {
    await room(env).fetch("https://presence.internal/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userIds, payload }),
    });
  } catch (error) {
    console.error("Realtime publish failed", error);
  }
}
