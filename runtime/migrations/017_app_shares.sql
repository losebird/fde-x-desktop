PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_shares (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL REFERENCES business_apps(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  workspace_cwd TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT NOT NULL DEFAULT ''
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS app_shares_live_app
  ON app_shares(app_id)
  WHERE revoked_at = '';
