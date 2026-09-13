import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  maxUploadBytes,
  pbkdf2Iterations,
  sessionCookieOptions,
} from "../lib/config.js";
import { fail, readJson, requireEmail, requireString } from "../lib/http.js";
import { signJwt } from "../lib/jwt.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { UploadError, assertValidImageDataUri, uploadImage } from "../lib/cloudinary.js";
import {
  createUser,
  findUserByEmail,
  isUniqueViolation,
  serializeUser,
  updatePasswordHash,
  updateProfilePic,
} from "../db/users.js";
import { requireAuth } from "../middleware/auth.js";
import { clientIp, rateLimit } from "../middleware/rateLimit.js";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

async function startSession(c, userId) {
  const token = await signJwt({ sub: userId }, c.env.JWT_SECRET, SESSION_TTL_SECONDS);

  setCookie(c, SESSION_COOKIE, token, {
    ...sessionCookieOptions(c.env),
    maxAge: SESSION_TTL_SECONDS,
  });
}

const auth = new Hono();

const byIp = rateLimit("AUTH_LIMITER", clientIp);

auth.post("/signup", byIp, async (c) => {
  const body = await readJson(c);
  const fullName = requireString(body, "fullName", { max: 80, label: "Full name" });
  const email = requireEmail(body);
  const password = requireString(body, "password", {
    min: MIN_PASSWORD_LENGTH,
    max: MAX_PASSWORD_LENGTH,
    label: "Password",
    trim: false,
  });

  if (await findUserByEmail(c.env.DB, email)) {
    throw fail(409, "Email already exists");
  }

  const passwordHash = await hashPassword(password, pbkdf2Iterations(c.env));
  let user;

  try {
    user = await createUser(c.env.DB, { email, fullName, passwordHash });
  } catch (error) {
    // Two concurrent signups for the same address: the loser gets a clean 409.
    if (isUniqueViolation(error)) {
      throw fail(409, "Email already exists");
    }

    throw error;
  }

  // The cookie is only issued after the row is durably written. The old code
  // set it first, so a failed insert left the browser holding a valid session
  // for a user that did not exist.
  await startSession(c, user.id);

  return c.json(serializeUser(user), 201);
});

auth.post("/login", byIp, async (c) => {
  const body = await readJson(c);
  const email = requireEmail(body);
  const password = requireString(body, "password", {
    max: MAX_PASSWORD_LENGTH,
    label: "Password",
    trim: false,
  });

  const row = await findUserByEmail(c.env.DB, email);

  if (!row) {
    throw fail(401, "Invalid credentials");
  }

  const { valid, needsRehash } = await verifyPassword(password, row.password_hash);

  if (!valid) {
    throw fail(401, "Invalid credentials");
  }

  // Transparently migrate bcrypt hashes carried over from the MongoDB
  // deployment onto PBKDF2, which is far cheaper on Worker CPU.
  if (needsRehash) {
    c.executionCtx.waitUntil(
      hashPassword(password, pbkdf2Iterations(c.env)).then((hash) =>
        updatePasswordHash(c.env.DB, row.id, hash),
      ),
    );
  }

  await startSession(c, row.id);

  return c.json(serializeUser(row));
});

auth.post("/logout", (c) => {
  // Clearing must repeat the attributes the cookie was set with, otherwise the
  // browser treats it as a different cookie and the session survives logout.
  deleteCookie(c, SESSION_COOKIE, sessionCookieOptions(c.env));

  return c.json({ message: "Logged out successfully" });
});

auth.get("/check", requireAuth, (c) => c.json(c.get("user")));

auth.put("/update-profile", requireAuth, rateLimit("WRITE_LIMITER", (c) => c.get("user")._id), async (c) => {
  const body = await readJson(c);

  if (typeof body.profilePic !== "string" || body.profilePic.trim() === "") {
    throw fail(400, "Profile picture required");
  }

  let secureUrl;

  try {
    assertValidImageDataUri(body.profilePic, maxUploadBytes(c.env));
    secureUrl = await uploadImage(c.env, body.profilePic, "chatcast/avatars");
  } catch (error) {
    if (error instanceof UploadError) {
      throw fail(error.status, error.message);
    }

    throw error;
  }

  const updated = await updateProfilePic(c.env.DB, c.get("user")._id, secureUrl);

  // Returned unwrapped. The old handler responded `{ updatedUser }`, which the
  // client stored directly as the auth user and so lost `_id`/`fullName`.
  return c.json(serializeUser(updated));
});

export default auth;
