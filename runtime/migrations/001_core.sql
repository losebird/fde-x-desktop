PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS actors (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'agent', 'service', 'system')),
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES actors(id) ON DELETE CASCADE,
  namespace TEXT NOT NULL,
  value_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at TEXT NOT NULL,
  UNIQUE (workspace_id, actor_id, namespace)
) STRICT;

CREATE TABLE IF NOT EXISTS object_links (
  id TEXT PRIMARY KEY,
  source_ref TEXT NOT NULL,
  relation TEXT NOT NULL,
  target_ref TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  UNIQUE (source_ref, relation, target_ref)
) STRICT;

CREATE TABLE IF NOT EXISTS audit_entries (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
  actor_id TEXT REFERENCES actors(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_ref TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('accepted', 'rejected', 'succeeded', 'failed', 'unknown')),
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  correlation_id TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  occurred_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS idx_audit_workspace_time ON audit_entries(workspace_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_correlation ON audit_entries(correlation_id);

CREATE TABLE IF NOT EXISTS outbox_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  schema_version INTEGER NOT NULL CHECK (schema_version > 0),
  source_ref TEXT NOT NULL,
  subject_ref TEXT,
  correlation_id TEXT NOT NULL,
  causation_id TEXT,
  payload_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  available_at TEXT NOT NULL,
  published_at TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error TEXT
) STRICT;

CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_events(published_at, available_at);

CREATE TABLE IF NOT EXISTS projector_checkpoints (
  projector_name TEXT PRIMARY KEY,
  last_event_id TEXT,
  last_occurred_at TEXT,
  updated_at TEXT NOT NULL
) STRICT;
