PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS biz_surfaces (
  id TEXT PRIMARY KEY,
  workspace_cwd TEXT NOT NULL,
  connection_id TEXT,
  kind TEXT NOT NULL,
  action TEXT NOT NULL,
  preview_id TEXT,
  session_id TEXT,
  row_count INTEGER,
  columns_json TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_biz_surfaces_ws ON biz_surfaces(workspace_cwd, created_at DESC);
