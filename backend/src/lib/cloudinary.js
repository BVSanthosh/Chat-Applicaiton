import { toHex, utf8 } from "./encoding.js";

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const DATA_URI = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([a-z0-9+/=]+)$/i;

export class UploadError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function isConfigured(env) {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

/**
 * Validates a browser-produced `data:` URI before it is sent anywhere.
 * Rejecting here keeps unbounded base64 out of both the upload and the DB.
 */
export function assertValidImageDataUri(value, maxBytes) {
  if (typeof value !== "string") {
    throw new UploadError("Image must be a base64 data URI");
  }

  const match = DATA_URI.exec(value.trim());

  if (!match) {
    throw new UploadError("Image must be a base64 data URI");
  }

  const [, mime, base64] = match;

  if (!ALLOWED_MIME.has(mime.toLowerCase())) {
    throw new UploadError("Unsupported image type. Use PNG, JPEG, WebP or GIF");
  }

  // 4 base64 chars encode 3 bytes; subtract padding for the exact size.
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const bytes = Math.floor((base64.length * 3) / 4) - padding;

  if (bytes > maxBytes) {
    throw new UploadError(`Image is too large. Maximum size is ${Math.floor(maxBytes / 1024 / 1024)}MB`);
  }

  return { mime, bytes };
}

async function sign(params, apiSecret) {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return toHex(await crypto.subtle.digest("SHA-1", utf8(`${toSign}${apiSecret}`)));
}

/**
 * Uploads via Cloudinary's REST API with a signed request. The official Node
 * SDK depends on Node's http stack and does not run on Workers.
 */
export async function uploadImage(env, dataUri, folder) {
  if (!isConfigured(env)) {
    throw new UploadError("Image uploads are not configured on this server", 503);
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signedParams = { folder, timestamp };
  const signature = await sign(signedParams, env.CLOUDINARY_API_SECRET);

  const body = new FormData();
  body.set("file", dataUri);
  body.set("api_key", env.CLOUDINARY_API_KEY);
  body.set("folder", folder);
  body.set("timestamp", String(timestamp));
  body.set("signature", signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Cloudinary upload failed", response.status, detail.slice(0, 500));

    throw new UploadError("Failed to upload image", 502);
  }

  const result = await response.json();

  if (!result.secure_url) {
    throw new UploadError("Failed to upload image", 502);
  }

  return result.secure_url;
}
