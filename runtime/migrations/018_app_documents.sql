PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_documents (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL REFERENCES business_apps(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  workspace_cwd TEXT NOT NULL,
  doc_key TEXT NOT NULL,
  json TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS app_documents_live
  ON app_documents(app_id, workspace_cwd, doc_key);
