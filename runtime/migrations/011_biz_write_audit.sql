PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS biz_write_audit (
  id TEXT PRIMARY KEY,
  workspace_cwd TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  action TEXT NOT NULL,
  record_no TEXT NOT NULL DEFAULT '',
  receipt_id TEXT NOT NULL DEFAULT '',
  session_id TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'workstation',
  changes_json TEXT NOT NULL DEFAULT '[]',
  columns_json TEXT NOT NULL DEFAULT '[]',
  written_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_biz_write_audit_trace ON biz_write_audit(trace_id);
CREATE INDEX IF NOT EXISTS idx_biz_write_audit_ws ON biz_write_audit(workspace_cwd, written_at DESC);
