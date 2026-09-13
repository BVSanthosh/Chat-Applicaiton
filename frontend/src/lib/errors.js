/**
 * Pulls a displayable message out of an axios failure.
 *
 * Every call site used to read `error.response.data.message` directly, which
 * throws a second time whenever the request never got a response (offline, DNS
 * failure, CORS rejection, timeout) — turning a network blip into a blank
 * screen instead of a toast.
 */
export function getErrorMessage(error, fallback = "Something went wrong") {
  if (error?.code === "ECONNABORTED") {
    return "The request timed out. Please try again.";
  }

  if (error?.response) {
    const data = error.response.data;

    if (typeof data === "string" && data.trim()) {
      return data;
    }

    if (typeof data?.message === "string" && data.message.trim()) {
      return data.message;
    }

    return fallback;
  }

  if (error?.request) {
    return "Cannot reach the server. Check your connection and try again.";
  }

  return error?.message || fallback;
}

// A 401 from /auth/check is the normal "not signed in" path, not an error
// worth logging or surfacing.
export function isUnauthorized(error) {
  return error?.response?.status === 401;
}
