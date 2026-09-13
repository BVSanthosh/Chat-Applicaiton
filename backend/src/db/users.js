import { newId, nowIso } from "../lib/ids.js";

/**
 * Maps a D1 row to the JSON shape the client already consumes (`_id`,
 * `fullName`, ...). Password material is never part of the output.
 */
export function serializeUser(row) {
  if (!row) {
    return null;
  }

  return {
    _id: row.id,
    email: row.email,
    fullName: row.full_name,
    profilePic: row.profile_pic ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const PUBLIC_COLUMNS = "id, email, full_name, profile_pic, created_at, updated_at";

export async function findUserByEmail(db, email) {
  return db
    .prepare(`SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE email = ? COLLATE NOCASE`)
    .bind(email)
    .first();
}

export async function findUserById(db, id) {
  return db.prepare(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ?`).bind(id).first();
}

export async function userExists(db, id) {
  const row = await db.prepare("SELECT 1 AS present FROM users WHERE id = ?").bind(id).first();

  return Boolean(row);
}

export async function listOtherUsers(db, excludeId) {
  const { results } = await db
    .prepare(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id != ? ORDER BY full_name COLLATE NOCASE ASC`)
    .bind(excludeId)
    .all();

  return results.map(serializeUser);
}

export async function createUser(db, { email, fullName, passwordHash }) {
  const timestamp = nowIso();
  const user = {
    id: newId(),
    email,
    full_name: fullName,
    password_hash: passwordHash,
    profile_pic: "",
    created_at: timestamp,
    updated_at: timestamp,
  };

  await db
    .prepare(
      `INSERT INTO users (id, email, full_name, password_hash, profile_pic, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      user.id,
      user.email,
      user.full_name,
      user.password_hash,
      user.profile_pic,
      user.created_at,
      user.updated_at,
    )
    .run();

  return user;
}

export async function updateProfilePic(db, id, profilePic) {
  const timestamp = nowIso();

  await db
    .prepare("UPDATE users SET profile_pic = ?, updated_at = ? WHERE id = ?")
    .bind(profilePic, timestamp, id)
    .run();

  return findUserById(db, id);
}

export async function updatePasswordHash(db, id, passwordHash) {
  await db
    .prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?")
    .bind(passwordHash, nowIso(), id)
    .run();
}

// SQLite surfaces a unique-index violation as a generic error string; this
// turns the signup race into a clean 400 instead of a 500.
export function isUniqueViolation(error) {
  return /UNIQUE constraint failed/i.test(String(error?.message ?? error));
}
