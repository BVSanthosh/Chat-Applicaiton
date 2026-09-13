#!/usr/bin/env node
/**
 * One-off migration from the old MongoDB deployment into D1.
 *
 * It reads `mongoexport` output rather than talking to Atlas directly, so it
 * needs no driver dependency and can be run against a dump taken anywhere:
 *
 *   mongoexport --uri "$MONGODB_URI" --collection users    --jsonArray --out users.json
 *   mongoexport --uri "$MONGODB_URI" --collection messages --jsonArray --out messages.json
 *
 *   node scripts/migrate-from-mongo.js --users users.json --messages messages.json --out migration.sql
 *   npx wrangler d1 execute chatcast --remote --file migration.sql
 *
 * Mongo ObjectIds are kept as the D1 primary keys so message references stay
 * intact. bcrypt password hashes are carried over as-is; the Worker verifies
 * them and transparently rehashes to PBKDF2 on each user's next login.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { sqlString } from "./lib/hash.mjs";

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);

  return index === -1 ? fallback : process.argv[index + 1];
}

const usersPath = arg("users");
const messagesPath = arg("messages");
const outPath = arg("out", "migration.sql");

if (!usersPath) {
  console.error("Usage: node scripts/migrate-from-mongo.js --users users.json [--messages messages.json] [--out migration.sql]");
  process.exit(1);
}

// mongoexport writes either a JSON array (--jsonArray) or newline-delimited JSON.
function readDocs(path) {
  const raw = readFileSync(path, "utf8").trim();

  if (!raw) {
    return [];
  }

  if (raw.startsWith("[")) {
    return JSON.parse(raw);
  }

  return raw.split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

// Extended JSON wraps values: {"$oid": "..."} / {"$date": "..."}.
function id(value) {
  if (value && typeof value === "object") {
    return value.$oid ?? value.toString();
  }

  return value;
}

function isoDate(value, fallback) {
  if (value && typeof value === "object" && value.$date) {
    const inner = typeof value.$date === "object" ? Number(value.$date.$numberLong) : value.$date;

    return new Date(inner).toISOString();
  }

  if (typeof value === "string" || typeof value === "number") {
    return new Date(value).toISOString();
  }

  return fallback;
}

const now = new Date().toISOString();
const lines = ["BEGIN TRANSACTION;"];
const knownUserIds = new Set();

for (const doc of readDocs(usersPath)) {
  const userId = id(doc._id);

  if (!userId || !doc.email || !doc.password) {
    console.warn(`Skipping user with missing id/email/password: ${JSON.stringify(doc).slice(0, 120)}`);
    continue;
  }

  knownUserIds.add(userId);

  const createdAt = isoDate(doc.createdAt, now);

  lines.push(
    "INSERT OR IGNORE INTO users (id, email, full_name, password_hash, profile_pic, created_at, updated_at) VALUES (" +
      [
        sqlString(userId),
        sqlString(String(doc.email).toLowerCase()),
        sqlString(doc.fullName ?? doc.email),
        sqlString(doc.password),
        sqlString(doc.profilePic ?? ""),
        sqlString(createdAt),
        sqlString(isoDate(doc.updatedAt, createdAt)),
      ].join(", ") +
      ");",
  );
}

let skippedMessages = 0;

if (messagesPath) {
  for (const doc of readDocs(messagesPath)) {
    const messageId = id(doc._id);
    const senderId = id(doc.senderId);
    const receiverId = id(doc.receiverId);

    // The messages table has FKs onto users; an orphan row would abort the
    // whole transaction, so drop it here with a count instead.
    if (!messageId || !knownUserIds.has(senderId) || !knownUserIds.has(receiverId)) {
      skippedMessages += 1;
      continue;
    }

    lines.push(
      "INSERT OR IGNORE INTO messages (id, sender_id, receiver_id, text, image, created_at) VALUES (" +
        [
          sqlString(messageId),
          sqlString(senderId),
          sqlString(receiverId),
          doc.text ? sqlString(doc.text) : "NULL",
          doc.image ? sqlString(doc.image) : "NULL",
          sqlString(isoDate(doc.createdAt, now)),
        ].join(", ") +
        ");",
    );
  }
}

lines.push("COMMIT;");
writeFileSync(outPath, lines.join("\n"), "utf8");

console.log(`Wrote ${outPath}`);
console.log(`  users:    ${knownUserIds.size}`);
console.log(`  messages: ${lines.length - knownUserIds.size - 3}${skippedMessages ? ` (skipped ${skippedMessages} with unknown sender/receiver)` : ""}`);
console.log(`\nApply with: npx wrangler d1 execute chatcast --remote --file ${outPath}`);
