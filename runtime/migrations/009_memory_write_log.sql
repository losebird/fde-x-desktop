CREATE TABLE IF NOT EXISTS memory_write_log (
  ref TEXT PRIMARY KEY,
  card_id TEXT,
  written_at INTEGER NOT NULL
) STRICT;
