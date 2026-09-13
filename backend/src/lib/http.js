import { HTTPException } from "hono/http-exception";

/**
 * All error responses use `{ message }`. The old API mixed `{ message }` and
 * `{ error }`, which made the client render "undefined" for half its failures.
 */
export function fail(status, message) {
  return new HTTPException(status, {
    res: Response.json({ message }, { status }),
  });
}

export async function readJson(c) {
  const contentType = c.req.header("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    throw fail(415, "Expected Content-Type: application/json");
  }

  try {
    const body = await c.req.json();

    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      throw fail(400, "Request body must be a JSON object");
    }

    return body;
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    throw fail(400, "Request body must be valid JSON");
  }
}

/**
 * `trim: false` is for secrets. Trimming a password would silently change what
 * the user typed, and any mismatch between the trim rules at signup and at
 * login would lock the account out. Whitespace-only input is still rejected.
 */
export function requireString(body, field, { min = 1, max = 1000, label = field, trim = true } = {}) {
  const value = body[field];

  if (typeof value !== "string") {
    throw fail(400, `${label} is required`);
  }

  const result = trim ? value.trim() : value;

  if (value.trim().length === 0) {
    throw fail(400, `${label} is required`);
  }

  if (result.length < min) {
    throw fail(400, min === 1 ? `${label} is required` : `${label} must be at least ${min} characters`);
  }

  if (result.length > max) {
    throw fail(400, `${label} must be at most ${max} characters`);
  }

  return result;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function requireEmail(body, field = "email") {
  const value = requireString(body, field, { max: 254, label: "Email" });

  if (!EMAIL_PATTERN.test(value)) {
    throw fail(400, "Invalid email format");
  }

  return value.toLowerCase();
}
