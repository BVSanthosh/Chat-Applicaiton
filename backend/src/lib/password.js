import { base64Decode, base64Encode, timingSafeEqual, utf8 } from "./encoding.js";

const KEY_BYTES = 32;
const SALT_BYTES = 16;
const DEFAULT_ITERATIONS = 100_000;

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", utf8(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    KEY_BYTES * 8,
  );

  return new Uint8Array(bits);
}

export function resolveIterations(raw) {
  const parsed = Number.parseInt(raw ?? "", 10);

  // Guard against a typo in config silently weakening every new password.
  if (!Number.isFinite(parsed) || parsed < 10_000) {
    return DEFAULT_ITERATIONS;
  }

  return parsed;
}

export async function hashPassword(password, iterations = DEFAULT_ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const derived = await pbkdf2(password, salt, iterations);

  return `pbkdf2$sha256$${iterations}$${base64Encode(salt)}$${base64Encode(derived)}`;
}

/**
 * Verifies a password against either the current PBKDF2 format or a bcrypt
 * hash carried over from the old MongoDB deployment.
 *
 * Returns `{ valid, needsRehash }`. `needsRehash` is true for legacy bcrypt
 * hashes so the caller can transparently upgrade them on successful login —
 * bcryptjs is pure JS and burns far more Worker CPU than PBKDF2.
 */
export async function verifyPassword(password, stored) {
  if (typeof stored !== "string" || stored.length === 0) {
    return { valid: false, needsRehash: false };
  }

  if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
    const { default: bcrypt } = await import("bcryptjs");
    const valid = await bcrypt.compare(password, stored);

    return { valid, needsRehash: valid };
  }

  const parts = stored.split("$");

  if (parts.length !== 5 || parts[0] !== "pbkdf2" || parts[1] !== "sha256") {
    return { valid: false, needsRehash: false };
  }

  const iterations = Number.parseInt(parts[2], 10);

  if (!Number.isFinite(iterations) || iterations <= 0) {
    return { valid: false, needsRehash: false };
  }

  try {
    const salt = base64Decode(parts[3]);
    const expected = base64Decode(parts[4]);
    const derived = await pbkdf2(password, salt, iterations);

    return { valid: timingSafeEqual(derived, expected), needsRehash: false };
  } catch {
    return { valid: false, needsRehash: false };
  }
}
