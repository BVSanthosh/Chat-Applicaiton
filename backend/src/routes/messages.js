import { Hono } from "hono";
import { maxUploadBytes } from "../lib/config.js";
import { fail, readJson } from "../lib/http.js";
import { isValidId } from "../lib/ids.js";
import { UploadError, assertValidImageDataUri, uploadImage } from "../lib/cloudinary.js";
import { createMessage, listConversation } from "../db/messages.js";
import { listOtherUsers, userExists } from "../db/users.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { publishToUsers } from "../realtime/client.js";

const MAX_TEXT_LENGTH = 4000;

const messages = new Hono();

messages.use("*", requireAuth);

messages.get("/users", async (c) => {
  return c.json(await listOtherUsers(c.env.DB, c.get("user")._id));
});

messages.get("/:id", async (c) => {
  const otherUserId = c.req.param("id");

  if (!isValidId(otherUserId)) {
    throw fail(400, "Invalid user id");
  }

  return c.json(await listConversation(c.env.DB, c.get("user")._id, otherUserId));
});

messages.post("/send/:id", rateLimit("WRITE_LIMITER", (c) => c.get("user")._id), async (c) => {
  const senderId = c.get("user")._id;
  const receiverId = c.req.param("id");

  if (!isValidId(receiverId)) {
    throw fail(400, "Invalid user id");
  }

  if (receiverId === senderId) {
    throw fail(400, "You cannot message yourself");
  }

  // The old handler took the recipient straight from the URL, so a bad id
  // produced a 500 and wrote an orphan row.
  if (!(await userExists(c.env.DB, receiverId))) {
    throw fail(404, "User not found");
  }

  const body = await readJson(c);
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const hasImage = typeof body.image === "string" && body.image.trim() !== "";

  if (!text && !hasImage) {
    throw fail(400, "Message must contain text or an image");
  }

  if (text.length > MAX_TEXT_LENGTH) {
    throw fail(400, `Message must be at most ${MAX_TEXT_LENGTH} characters`);
  }

  let image = null;

  if (hasImage) {
    try {
      assertValidImageDataUri(body.image, maxUploadBytes(c.env));
      image = await uploadImage(c.env, body.image, "chatcast/messages");
    } catch (error) {
      if (error instanceof UploadError) {
        throw fail(error.status, error.message);
      }

      throw error;
    }
  }

  const message = await createMessage(c.env.DB, { senderId, receiverId, text, image });

  // Delivered to the sender's other sessions as well, so a second tab stays in
  // sync. The client de-duplicates by message id.
  c.executionCtx.waitUntil(
    publishToUsers(c.env, [receiverId, senderId], { type: "newMessage", message }),
  );

  return c.json(message, 201);
});

export default messages;
