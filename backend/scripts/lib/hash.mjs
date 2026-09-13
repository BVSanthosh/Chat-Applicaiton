import { webcrypto as crypto } from "node:crypto";

const KEY_BYTES = 32;
const SALT_BYTES = 16;

/**
 * Mirrors `src/lib/password.js` so rows written by these scripts verify
 * against the Worker. Keep the two in sync if the format ever changes.
 */
export async function hashPassword(password, iterations = 100_000) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    KEY_BYTES * 8,
  );

  const b64 = (bytes) => Buffer.from(bytes).toString("base64");

  return `pbkdf2$sha256$${iterations}$${b64(salt)}$${b64(new Uint8Array(bits))}`;
}

export function sqlString(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}
