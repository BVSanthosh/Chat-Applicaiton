-- Users. `email` is stored lowercased by the application and additionally
-- guarded by a case-insensitive unique index so "A@b.com" and "a@b.com"
-- cannot both register.
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  profile_pic   TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_users_email ON users (email COLLATE NOCASE);

CREATE TABLE messages (
  id          TEXT PRIMARY KEY,
  sender_id   TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  receiver_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  text        TEXT,
  image       TEXT,
  created_at  TEXT NOT NULL
);

-- The conversation query filters on both directions of a pair, so index both.
CREATE INDEX idx_messages_sender_receiver ON messages (sender_id, receiver_id, created_at);
CREATE INDEX idx_messages_receiver_sender ON messages (receiver_id, sender_id, created_at);
