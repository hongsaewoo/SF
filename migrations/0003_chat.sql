CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author TEXT NOT NULL CHECK(length(author) BETWEEN 1 AND 30),
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 500),
  client_id TEXT NOT NULL CHECK(length(client_id)=36),
  created_at TEXT NOT NULL,
  UNIQUE(user_id,client_id)
);
