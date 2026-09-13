import { newId, nowIso } from "../lib/ids.js";

export function serializeMessage(row) {
  if (!row) {
    return null;
  }

  return {
    _id: row.id,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    text: row.text ?? "",
    image: row.image ?? null,
    createdAt: row.created_at,
  };
}

const PAGE_LIMIT = 200;

/**
 * Returns the most recent `limit` messages of a conversation in ascending
 * order. The old implementation had no ORDER BY at all and relied on natural
 * insertion order.
 */
export async function listConversation(db, userId, otherUserId, limit = PAGE_LIMIT) {
  const capped = Math.min(Math.max(Number(limit) || PAGE_LIMIT, 1), PAGE_LIMIT);

  const { results } = await db
    .prepare(
      `SELECT * FROM (
         SELECT id, sender_id, receiver_id, text, image, created_at
         FROM messages
         WHERE (sender_id = ?1 AND receiver_id = ?2)
            OR (sender_id = ?2 AND receiver_id = ?1)
         ORDER BY created_at DESC, id DESC
         LIMIT ?3
       ) ORDER BY created_at ASC, id ASC`,
    )
    .bind(userId, otherUserId, capped)
    .all();

  return results.map(serializeMessage);
}

export async function createMessage(db, { senderId, receiverId, text, image }) {
  const row = {
    id: newId(),
    sender_id: senderId,
    receiver_id: receiverId,
    text: text || null,
    image: image || null,
    created_at: nowIso(),
  };

  await db
    .prepare(
      `INSERT INTO messages (id, sender_id, receiver_id, text, image, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(row.id, row.sender_id, row.receiver_id, row.text, row.image, row.created_at)
    .run();

  return serializeMessage(row);
}
