import { base64UrlDecode, base64UrlEncode, timingSafeEqual, utf8 } from "./encoding.js";

const HEADER = base64UrlEncode(utf8(JSON.stringify({ alg: "HS256", typ: "JWT" })));

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    utf8(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/**
 * Signs an HS256 JWT. `ttlSeconds` is required so no token is ever minted
 * without an expiry.
 */
export async function signJwt(payload, secret, ttlSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + ttlSeconds };
  const encodedBody = base64UrlEncode(utf8(JSON.stringify(body)));
  const data = `${HEADER}.${encodedBody}`;
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), utf8(data));

  return `${data}.${base64UrlEncode(signature)}`;
}

/**
 * Verifies signature, expiry and (when given) the `aud` claim.
 * Returns the payload, or null for any failure — callers must not be able to
 * distinguish "bad signature" from "expired" from "wrong audience".
 */
export async function verifyJwt(token, secret, expectedAudience) {
  if (typeof token !== "string") {
    return null;
  }

  const parts = token.split(".");

  if (parts.length !== 3) {
    return null;
  }

  const [header, body, signature] = parts;

  try {
    const expected = await crypto.subtle.sign("HMAC", await hmacKey(secret), utf8(`${header}.${body}`));

    if (!timingSafeEqual(base64UrlDecode(signature), new Uint8Array(expected))) {
      return null;
    }

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body)));
    const now = Math.floor(Date.now() / 1000);

    if (typeof payload.exp !== "number" || payload.exp <= now) {
      return null;
    }

    if (expectedAudience && payload.aud !== expectedAudience) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
