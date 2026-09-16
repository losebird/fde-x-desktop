PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS business_connections (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  connection_kind TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('connected', 'disconnected', 'pending', 'error')),
  config_json TEXT NOT NULL DEFAULT '{}',
  credential_ref TEXT,
  capabilities_json TEXT NOT NULL DEFAULT '[]',
  last_health_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS business_apps (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  app_kind TEXT NOT NULL CHECK (app_kind IN ('generated', 'connected', 'system')),
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  current_revision INTEGER NOT NULL DEFAULT 1 CHECK (current_revision > 0),
  definition_json TEXT NOT NULL,
  created_by TEXT REFERENCES actors(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS business_app_revisions (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL REFERENCES business_apps(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL CHECK (revision > 0),
  definition_json TEXT NOT NULL,
  change_note TEXT,
  created_by TEXT REFERENCES actors(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  UNIQUE (app_id, revision)
) STRICT;

CREATE TABLE IF NOT EXISTS operations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id TEXT REFERENCES business_connections(id) ON DELETE SET NULL,
  app_id TEXT REFERENCES business_apps(id) ON DELETE SET NULL,
  requested_by TEXT NOT NULL REFERENCES actors(id) ON DELETE RESTRICT,
  target_ref TEXT NOT NULL,
  action TEXT NOT NULL,
  operation_kind TEXT NOT NULL CHECK (operation_kind IN ('read', 'write')),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  execution_mode TEXT NOT NULL DEFAULT 'dry_run' CHECK (execution_mode IN ('dry_run', 'live')),
  state TEXT NOT NULL CHECK (state IN (
    'draft', 'awaiting_approval', 'approved', 'executing', 'succeeded', 'failed', 'uncertain',
    'compensating', 'compensated', 'compensation_failed', 'cancelled'
  )),
  idempotency_key TEXT NOT NULL,
  expected_version TEXT,
  input_json TEXT NOT NULL,
  plan_json TEXT NOT NULL DEFAULT '{}',
  correlation_id TEXT NOT NULL,
  causation_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  UNIQUE (connection_id, idempotency_key)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_operations_workspace_time ON operations(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operations_state ON operations(state, updated_at);
CREATE INDEX IF NOT EXISTS idx_operations_correlation ON operations(correlation_id);

CREATE TABLE IF NOT EXISTS operation_steps (
  id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  sequence_no INTEGER NOT NULL CHECK (sequence_no >= 0),
  step_kind TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('queued', 'running', 'succeeded', 'failed', 'skipped', 'uncertain')),
  tool_ref TEXT,
  input_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT,
  error_json TEXT,
  started_at TEXT,
  finished_at TEXT,
  UNIQUE (operation_id, sequence_no)
) STRICT;

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  requested_from TEXT NOT NULL REFERENCES actors(id) ON DELETE RESTRICT,
  decision TEXT NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
  decision_note TEXT,
  policy_json TEXT NOT NULL DEFAULT '{}',
  requested_at TEXT NOT NULL,
  decided_at TEXT
) STRICT;

CREATE TABLE IF NOT EXISTS operation_snapshots (
  id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  snapshot_kind TEXT NOT NULL CHECK (snapshot_kind IN ('before', 'after', 'verification', 'recovery')),
  source_authority TEXT NOT NULL CHECK (source_authority IN ('workstation', 'external')),
  object_ref TEXT NOT NULL,
  version_token TEXT,
  data_json TEXT NOT NULL,
  captured_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS operation_receipts (
  id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  receipt_kind TEXT NOT NULL CHECK (receipt_kind IN ('accepted', 'executed', 'verified', 'failed', 'unknown')),
  external_request_id TEXT,
  external_receipt_ref TEXT,
  result_json TEXT NOT NULL DEFAULT '{}',
  received_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS compensations (
  id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  strategy TEXT NOT NULL CHECK (strategy IN ('native_rollback', 'inverse_action', 'restore_snapshot', 'manual')),
  state TEXT NOT NULL CHECK (state IN ('planned', 'awaiting_approval', 'executing', 'succeeded', 'failed', 'manual_required', 'cancelled')),
  reason TEXT NOT NULL,
  plan_json TEXT NOT NULL,
  result_json TEXT,
  approved_by TEXT REFERENCES actors(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT
) STRICT;

CREATE TABLE IF NOT EXISTS operation_artifacts (
  operation_id TEXT NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  object_ref TEXT NOT NULL,
  relation TEXT NOT NULL CHECK (relation IN ('input', 'output', 'evidence', 'recovery', 'semantic_context')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (operation_id, object_ref, relation)
) STRICT;
