export function newId() {
  return crypto.randomUUID();
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Mongo ObjectIds survive a migration from the old deployment, so accept both
// shapes rather than rejecting every migrated row.
const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;

export function isValidId(value) {
  return typeof value === "string" && (UUID_PATTERN.test(value) || OBJECT_ID_PATTERN.test(value));
}

export function nowIso() {
  return new Date().toISOString();
}
