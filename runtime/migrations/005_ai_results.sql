CREATE TABLE IF NOT EXISTS ai_results (
  request_id TEXT PRIMARY KEY,
  workspace_cwd TEXT NOT NULL,
  session_id TEXT,
  kind TEXT NOT NULL,
  data_json TEXT NOT NULL,
  summary TEXT,
  created_at INTEGER NOT NULL
);
