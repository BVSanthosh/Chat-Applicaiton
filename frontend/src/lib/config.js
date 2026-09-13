/**
 * The frontend and the API are served by the same Worker, so every call is
 * same-origin and there is no build-time API URL to configure.
 */
export const API_BASE_URL = "/api";

export function websocketUrl(ticket) {
  const url = new URL("/api/realtime", window.location.origin);

  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("ticket", ticket);

  return url.toString();
}
