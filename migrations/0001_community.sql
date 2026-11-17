PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 100),
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 10000),
  author TEXT NOT NULL CHECK(length(author) BETWEEN 1 AND 30),
  category TEXT NOT NULL CHECK(category IN ('OBSERVATION','THOUGHT','DISCOVERY')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS posts_created ON posts(created_at DESC,id DESC);
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author TEXT NOT NULL CHECK(length(author) BETWEEN 1 AND 30),
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS comments_post ON comments(post_id,created_at,id);
CREATE TABLE IF NOT EXISTS write_limits (key TEXT PRIMARY KEY,last_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS write_limits_time ON write_limits(last_at);
